import { env } from "cloudflare:workers";
import { internalPeople, weeks } from "../../../../data/demo-data";
import { AzureDevOpsError, updateWorkItemPlanning } from "../../../../lib/azure-devops";

export const dynamic = "force-dynamic";

interface PlanningRequestBody {
  workItemId?: unknown;
  personId?: unknown;
  dueWeek?: unknown;
}

export async function POST(request: Request) {
  let body: PlanningRequestBody;
  try {
    body = await request.json() as PlanningRequestBody;
  } catch {
    return Response.json({ error: "O corpo da solicitação deve ser um JSON válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body) ||
    !Number.isSafeInteger(body.workItemId) || (body.workItemId as number) <= 0) {
    return Response.json({ error: "Informe um Work Item e ao menos uma alteração válida." }, { status: 400 });
  }

  const hasPersonUpdate = body.personId !== undefined;
  const hasDeadlineUpdate = body.dueWeek !== undefined;
  if (!hasPersonUpdate && !hasDeadlineUpdate) {
    return Response.json({ error: "Informe um Work Item e ao menos uma alteração válida." }, { status: 400 });
  }

  const person = hasPersonUpdate && typeof body.personId === "string"
    ? internalPeople.find(candidate => candidate.id === body.personId)
    : undefined;
  if (hasPersonUpdate && !person) {
    return Response.json({ error: "O responsável informado não existe." }, { status: 400 });
  }

  const dueWeek = hasDeadlineUpdate && Number.isInteger(body.dueWeek)
    ? body.dueWeek as number
    : -1;
  if (hasDeadlineUpdate && (dueWeek < 0 || dueWeek >= weeks.length)) {
    return Response.json({ error: "Escolha uma das semanas de prazo disponíveis." }, { status: 400 });
  }

  const { AZURE_DEVOPS_ORGANIZATION, AZURE_DEVOPS_PROJECT, AZURE_DEVOPS_PAT } = env as typeof env & {
    AZURE_DEVOPS_ORGANIZATION?: string;
    AZURE_DEVOPS_PROJECT?: string;
    AZURE_DEVOPS_PAT?: string;
  };
  if (!AZURE_DEVOPS_ORGANIZATION || !AZURE_DEVOPS_PROJECT || !AZURE_DEVOPS_PAT) {
    return Response.json({ error: "A integração Azure DevOps ainda não está configurada no servidor." }, { status: 503 });
  }

  try {
    const workItem = await updateWorkItemPlanning({
      organization: AZURE_DEVOPS_ORGANIZATION,
      project: AZURE_DEVOPS_PROJECT,
      pat: AZURE_DEVOPS_PAT,
    }, body.workItemId as number, {
      personId: person?.id,
      dueDate: hasDeadlineUpdate ? weeks[dueWeek].end : undefined,
    });
    return Response.json({
      success: true,
      personId: person?.id,
      dueWeek: hasDeadlineUpdate ? dueWeek : undefined,
      workItem,
    });
  } catch (error) {
    if (error instanceof AzureDevOpsError) {
      const status = error.status === 404 ? 404 : 502;
      const message = error.status === 404
        ? "Work Item não encontrado no projeto configurado."
        : "Não foi possível confirmar a atualização no Azure DevOps.";
      return Response.json({ error: message }, { status });
    }
    return Response.json({ error: "Não foi possível comunicar com o Azure DevOps." }, { status: 502 });
  }
}
