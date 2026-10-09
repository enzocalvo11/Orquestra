import {
  internalPeople as localPeople,
  supplementalProjects as localProjects,
  weeks,
  supplementalWorkItems,
  UNASSIGNED_PERSON_ID,
  type Person,
  type Project,
  type WorkItem,
} from "../data/demo-data.ts";

interface AzureDevOpsConfig {
  organization: string;
  project: string;
  pat: string;
}

export interface AzurePlanningUpdate {
  personId?: string;
  dueDate?: string;
}

export interface AzureWorkItemSnapshot {
  id: number;
  title: string;
  tags: string[];
}

export interface AzureSourceData {
  workItems: WorkItem[];
  projects: Project[];
  people: Person[];
  syncedAt: string;
}

interface AzureWorkItemRecord {
  id: number;
  fields: Record<string, unknown>;
}

export class AzureDevOpsError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Azure DevOps request failed");
    this.name = "AzureDevOpsError";
    this.status = status;
  }
}

export function updateResponsibleTag(currentTags: string, personId: string): string {
  return replaceTagType(currentTags, "responsavel", `responsavel:${personId}`);
}

export function updateDueDateTag(currentTags: string, dueDate: string): string {
  return replaceTagType(currentTags, "prazo", `prazo:${dueDate}`);
}

function tagType(tag: string): "responsavel" | "prazo" | "demo" | undefined {
  const match = tag.trim().match(/^(responsavel|prazo|demo)(?=[:\-]|$)/i);
  return match?.[1].toLowerCase() as "responsavel" | "prazo" | "demo" | undefined;
}

export function replaceTagType(currentTags: string, type: "responsavel" | "prazo" | "demo", nextTag: string): string {
  if (tagType(nextTag) !== type) throw new Error(`Tag must use the ${type} type.`);

  const keptTypes = new Set<string>();
  const keptTags = new Set<string>();
  const tags = currentTags.split(";").map(tag => tag.trim()).filter(Boolean).filter(tag => {
    const currentType = tagType(tag);
    if (currentType === type) return false;
    if (currentType && keptTypes.has(currentType)) return false;
    const normalizedTag = tag.toLowerCase();
    if (keptTags.has(normalizedTag)) return false;
    keptTags.add(normalizedTag);
    if (currentType) keptTypes.add(currentType);
    return true;
  });
  tags.push(nextTag);
  return tags.join("; ");
}

function getWorkItemUrl(config: AzureDevOpsConfig, workItemId: number): string {
  return `https://dev.azure.com/${encodeURIComponent(config.organization)}/${encodeURIComponent(config.project)}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
}

function getHeaders(config: AzureDevOpsConfig): HeadersInit {
  return {
    Authorization: `Basic ${btoa(`:${config.pat}`)}`,
    Accept: "application/json",
  };
}

async function getWorkItem(
  config: AzureDevOpsConfig,
  workItemId: number,
  fetcher: typeof fetch = fetch,
): Promise<AzureWorkItemSnapshot> {
  const response = await fetcher(getWorkItemUrl(config, workItemId), { headers: getHeaders(config) });
  if (!response.ok) throw new AzureDevOpsError(response.status);

  const workItem = await response.json() as { id?: unknown; fields?: Record<string, unknown> };
  const title = workItem.fields?.["System.Title"];
  const currentTags = workItem.fields?.["System.Tags"];
  if (typeof workItem.id !== "number" || (title !== undefined && typeof title !== "string") ||
    (currentTags !== undefined && typeof currentTags !== "string")) {
    throw new AzureDevOpsError(502);
  }

  return {
    id: workItem.id,
    title: typeof title === "string" ? title : "Work Item",
    tags: (currentTags ?? "").split(";").map(tag => tag.trim()).filter(Boolean),
  };
}

export async function updateWorkItemPlanning(
  config: AzureDevOpsConfig,
  workItemId: number,
  update: AzurePlanningUpdate,
  fetcher: typeof fetch = fetch,
): Promise<AzureWorkItemSnapshot> {
  if (update.personId === undefined && update.dueDate === undefined) {
    throw new Error("At least one planning field must be updated.");
  }

  const currentWorkItem = await getWorkItem(config, workItemId, fetcher);
  let tags = currentWorkItem.tags.join("; ");
  if (update.personId !== undefined) tags = updateResponsibleTag(tags, update.personId);
  if (update.dueDate !== undefined) tags = updateDueDateTag(tags, update.dueDate);
  const tagsOperation = currentWorkItem.tags.length > 0 ? "replace" : "add";
  const response = await fetcher(getWorkItemUrl(config, workItemId), {
    method: "PATCH",
    headers: {
      ...getHeaders(config),
      "Content-Type": "application/json-patch+json",
    },
    body: JSON.stringify([{ op: tagsOperation, path: "/fields/System.Tags", value: tags }]),
  });
  if (!response.ok) throw new AzureDevOpsError(response.status);

  const updatedWorkItem = await getWorkItem(config, workItemId, fetcher);
  const expectedTags: Array<{ type: "responsavel" | "prazo"; value: string }> = [];
  if (update.personId !== undefined) {
    expectedTags.push({ type: "responsavel", value: `responsavel:${update.personId}` });
  }
  if (update.dueDate !== undefined) {
    expectedTags.push({ type: "prazo", value: `prazo:${update.dueDate}` });
  }
  for (const expected of expectedTags) {
    const matchingTags = updatedWorkItem.tags.filter(tag => tagType(tag) === expected.type);
    if (matchingTags.length !== 1 || matchingTags[0].toLowerCase() !== expected.value.toLowerCase()) {
      throw new AzureDevOpsError(502);
    }
  }

  return updatedWorkItem;
}

function getTagValue(tags: string[], prefix: string): string | undefined {
  const tag = tags.find(value => value.toLowerCase().startsWith(prefix.toLowerCase()));
  return tag?.slice(prefix.length);
}

function toId(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "azure-project";
}

function mapAzureItem(record: AzureWorkItemRecord): WorkItem {
  const fields = record.fields;
  const tags = typeof fields["System.Tags"] === "string"
    ? (fields["System.Tags"] as string).split(";").map(tag => tag.trim()).filter(Boolean)
    : [];
  const demoTag = tags.find(tag => /^demo[-:]/i.test(tag));
  const demoId = demoTag?.match(/^demo[-:](\d+)$/i)?.[1];
  const supplemental = supplementalWorkItems.find(item => item.externalId === Number(demoId));
  const areaPath = typeof fields["System.AreaPath"] === "string" ? fields["System.AreaPath"] : "";
  const projectName = areaPath.split("\\").filter(Boolean)[1] ??
    (typeof fields["System.TeamProject"] === "string" ? fields["System.TeamProject"] : "Azure DevOps");
  const projectId = toId(projectName);
  const tagsResponsavel = getTagValue(tags, "responsavel:") ?? getTagValue(tags, "responsavel-");
  const taggedPerson = tagsResponsavel?.trim().toLowerCase();
  const personId = taggedPerson && localPeople.some(person => person.id === taggedPerson)
    ? taggedPerson : UNASSIGNED_PERSON_ID;
  const skillValue = getTagValue(tags, "habilidade-") ?? getTagValue(tags, "habilidade:");
  const skill = ["frontend", "backend", "qa", "design"].includes(skillValue ?? "")
    ? skillValue as WorkItem["skill"] : supplemental?.skill ?? "backend";
  const iterationPath = typeof fields["System.IterationPath"] === "string" ? fields["System.IterationPath"] : "";
  const iterationMatch = iterationPath.match(/(?:^|\\)S([1-4])$/i);
  const week = iterationMatch ? Number(iterationMatch[1]) - 1 : supplemental?.week ?? 0;
  const dueTag = getTagValue(tags, "prazo-") ?? getTagValue(tags, "prazo:");
  const adoDueDate = fields["Microsoft.VSTS.Scheduling.DueDate"];
  const dueDate = dueTag?.match(/^\d{4}-\d{2}-\d{2}$/) ? dueTag
    : typeof adoDueDate === "string" ? adoDueDate.slice(0, 10) : undefined;
  const dueWeekFromTag = dueDate ? weeks.findIndex(period => period.start <= dueDate && dueDate <= period.end) : -1;
  const remainingWork = fields["Microsoft.VSTS.Scheduling.RemainingWork"];
  const estimate = fields["Microsoft.VSTS.Scheduling.OriginalEstimate"];
  const rawType = fields["System.WorkItemType"];
  const rawState = fields["System.State"];
  const rawPriority = fields["Microsoft.VSTS.Common.Priority"];
  const rawTitle = fields["System.Title"];
  const rawDescription = fields["System.Description"];
  const status = typeof rawState === "string" && /^(closed|done|resolved|completed)$/i.test(rawState)
    ? "Concluído" : typeof rawState === "string" && /^(active|in progress|committed)$/i.test(rawState)
      ? "Em andamento" : "Pendente";
  const priority = rawPriority === 1 ? "Alta" : rawPriority === 3 || rawPriority === 4 ? "Baixa" : "Média";
  const title = typeof rawTitle === "string" ? rawTitle : `Work Item ${record.id}`;
  const description = typeof rawDescription === "string"
    ? rawDescription.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    : supplemental?.description ?? "";
  return {
    id: `AZURE-${record.id}`,
    externalId: record.id,
    projectId,
    feature: supplemental?.feature ?? "Sem feature cadastrada",
    pbi: supplemental?.pbi ?? "Sem PBI cadastrado",
    title,
    type: rawType === "Bug" ? "Bug" : rawType === "Test" ? "Test" : "Task",
    status,
    personId,
    week,
    dueWeek: dueWeekFromTag >= 0 ? dueWeekFromTag : supplemental?.dueWeek ?? week,
    hours: typeof remainingWork === "number" ? remainingWork
      : typeof estimate === "number" ? estimate : supplemental?.hours ?? 0,
    skill,
    priority,
    description,
  };
}

export async function getAzureSource(
  config: AzureDevOpsConfig,
  fetcher: typeof fetch = fetch,
): Promise<AzureSourceData> {
  const baseUrl = `https://dev.azure.com/${encodeURIComponent(config.organization)}/${encodeURIComponent(config.project)}`;
  const headers = getHeaders(config);
  const wiqlResponse = await fetcher(`${baseUrl}/_apis/wit/wiql?api-version=7.1`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.State] <> 'Removed' AND [System.WorkItemType] IN ('Task', 'Bug', 'Test') ORDER BY [System.Id]",
    }),
  });
  if (!wiqlResponse.ok) throw new AzureDevOpsError(wiqlResponse.status);
  const queryResult = await wiqlResponse.json() as { workItems?: Array<{ id?: number }> };
  const ids = (queryResult.workItems ?? []).map(item => item.id).filter((id): id is number => Number.isSafeInteger(id));
  const records: AzureWorkItemRecord[] = [];
  for (let index = 0; index < ids.length; index += 200) {
    const batch = ids.slice(index, index + 200);
    if (!batch.length) continue;
    const url = new URL(`${baseUrl}/_apis/wit/workitems`);
    url.searchParams.set("ids", batch.join(","));
    url.searchParams.set("fields", [
      "System.Title", "System.WorkItemType", "System.State", "System.AreaPath", "System.TeamProject",
      "System.IterationPath", "System.Tags", "System.Description",
      "Microsoft.VSTS.Scheduling.DueDate",
      "Microsoft.VSTS.Scheduling.RemainingWork", "Microsoft.VSTS.Scheduling.OriginalEstimate",
      "Microsoft.VSTS.Common.Priority",
    ].join(","));
    url.searchParams.set("api-version", "7.1");
    const response = await fetcher(url.toString(), { headers });
    if (!response.ok) throw new AzureDevOpsError(response.status);
    const result = await response.json() as { value?: AzureWorkItemRecord[] };
    records.push(...(result.value ?? []));
  }

  const projectById = new Map<string, Project>();
  for (const record of records) {
    const areaPath = typeof record.fields["System.AreaPath"] === "string" ? record.fields["System.AreaPath"] : "";
    const projectName = areaPath.split("\\").filter(Boolean)[1] ?? config.project;
    const id = toId(projectName);
    if (projectById.has(id)) continue;
    const localProject = localProjects.find(project => project.name.toLowerCase() === projectName.toLowerCase());
    projectById.set(id, {
      id,
      name: projectName,
      product: localProject?.product ?? config.project,
      description: localProject?.description ?? `Area Path do Azure DevOps: ${areaPath || config.project}`,
      color: localProject?.color ?? ["#8161d7", "#239c97", "#e3a14f"][projectById.size % 3],
    });
  }
  const projects = [...projectById.values()];
  const workItems = records.map(record => mapAzureItem(record));
  return { workItems, projects, people: localPeople, syncedAt: new Date().toISOString() };
}
