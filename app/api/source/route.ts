import { env } from "cloudflare:workers";
import { AzureDevOpsError, getAzureSource } from "../../../lib/azure-devops";

export const dynamic = "force-dynamic";

export async function GET() {
  const { AZURE_DEVOPS_ORGANIZATION, AZURE_DEVOPS_PROJECT, AZURE_DEVOPS_PAT } = env as typeof env & {
    AZURE_DEVOPS_ORGANIZATION?: string;
    AZURE_DEVOPS_PROJECT?: string;
    AZURE_DEVOPS_PAT?: string;
  };
  if (!AZURE_DEVOPS_ORGANIZATION || !AZURE_DEVOPS_PROJECT || !AZURE_DEVOPS_PAT) {
    return Response.json({ error: "A integração Azure DevOps ainda não está configurada no servidor." }, { status: 503 });
  }

  try {
    const source = await getAzureSource({
      organization: AZURE_DEVOPS_ORGANIZATION,
      project: AZURE_DEVOPS_PROJECT,
      pat: AZURE_DEVOPS_PAT,
    });
    return Response.json({
      mode: "azure-devops",
      source: "Azure DevOps",
      projectCount: source.projects.length,
      workItemCount: source.workItems.length,
      ...source,
    });
  } catch (error) {
    if (error instanceof AzureDevOpsError) {
      const status = error.status === 404 ? 404 : 502;
      const message = error.status === 404
        ? "Organização ou projeto não encontrado no Azure DevOps."
        : "Não foi possível consultar os Work Items no Azure DevOps. Verifique o PAT e as permissões.";
      return Response.json({ error: message }, { status });
    }
    return Response.json({ error: "Não foi possível comunicar com o Azure DevOps." }, { status: 502 });
  }
}
