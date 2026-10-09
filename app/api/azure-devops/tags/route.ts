import { env } from "cloudflare:workers";
import { internalPeople, weeks } from "../../../../data/demo-data";
import { AzureDevOpsError, updateWorkItemTag, type AzureTagType } from "../../../../lib/azure-devops";

export const dynamic = "force-dynamic";

const tagTypes = new Set<AzureTagType>(["responsavel", "prazo", "demo"]);

export async function POST(request: Request) {
  let body: { workItemId?: unknown; tagType?: unknown; value?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "O corpo da solicitação deve ser um JSON válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body) ||
    !Number.isSafeInteger(body.workItemId) || (body.workItemId as number) <= 0 ||
    typeof body.tagType !== "string" || !tagTypes.has(body.tagType as AzureTagType) ||
    typeof body.value !== "string") {
    return Response.json({ error: "Informe um Work Item e um valor de tag válidos." }, { status: 400 });
  }

  const tagType = body.tagType as AzureTagType;
  const value = body.value.trim();
  if (tagType === "responsavel" && !internalPeople.some(person => person.id === value)) {
    return Response.json({ error: "O responsável informado não existe." }, { status: 400 });
  }
  if (tagType === "prazo" && !weeks.some(week => week.end === value)) {
    return Response.json({ error: "Escolha uma das semanas de prazo disponíveis." }, { status: 400 });
  }
  if (tagType === "demo" && !/^\d+$/.test(value)) {
    return Response.json({ error: "A tag demo deve conter um identificador numérico." }, { status: 400 });
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
    const workItem = await updateWorkItemTag({
      organization: AZURE_DEVOPS_ORGANIZATION,
      project: AZURE_DEVOPS_PROJECT,
      pat: AZURE_DEVOPS_PAT,
    }, body.workItemId as number, tagType, value);
    return Response.json({ success: true, tagType, value, workItem });
  } catch (error) {
    if (error instanceof AzureDevOpsError) {
      const status = error.status === 404 ? 404 : 502;
      const message = error.status === 404
        ? "Work Item não encontrado no projeto configurado."
        : "Não foi possível confirmar a atualização da tag no Azure DevOps.";
      return Response.json({ error: message }, { status });
    }
    return Response.json({ error: "Não foi possível comunicar com o Azure DevOps." }, { status: 502 });
  }
}
