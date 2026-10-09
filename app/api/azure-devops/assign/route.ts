import { env } from "cloudflare:workers";
import { people } from "../../../../data/demo-data";
import { assignWorkItem, AzureDevOpsError } from "../../../../lib/azure-devops";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { workItemId?: unknown; personId?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "O corpo da solicitação deve ser um JSON válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body) ||
    !Number.isSafeInteger(body.workItemId) || (body.workItemId as number) <= 0 || typeof body.personId !== "string") {
    return Response.json({ error: "Informe um ID de Work Item válido e um responsável fictício." }, { status: 400 });
  }
  const person = people.find(candidate => candidate.id === body.personId);
  if (!person) {
    return Response.json({ error: "O responsável fictício informado não existe." }, { status: 400 });
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
    const workItem = await assignWorkItem({
      organization: AZURE_DEVOPS_ORGANIZATION,
      project: AZURE_DEVOPS_PROJECT,
      pat: AZURE_DEVOPS_PAT,
    }, body.workItemId as number, person.id);
    return Response.json({ success: true, personId: person.id, workItem });
  } catch (error) {
    if (error instanceof AzureDevOpsError) {
      const status = error.status === 401 || error.status === 403 ? 502
        : error.status === 404 ? 404 : 502;
      const message = error.status === 404
        ? "Work Item não encontrado no projeto configurado."
        : "Não foi possível atualizar o responsável no Azure DevOps.";
      return Response.json({ error: message }, { status });
    }
    return Response.json({ error: "Não foi possível comunicar com o Azure DevOps." }, { status: 502 });
  }
}
