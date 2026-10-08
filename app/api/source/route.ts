import { projects, workItems } from "../../../data/demo-data";

// The initial milestone uses a clearly labelled fictional Azure DevOps-style source.
export async function GET() {
  return Response.json({
    mode: "demonstracao",
    source: "Conjunto fictício estruturado como work items do Azure DevOps",
    syncedAt: new Date().toISOString(),
    projectCount: projects.length,
    workItemCount: workItems.length,
  });
}
