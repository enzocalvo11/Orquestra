import { getProject } from "../../lib/planning";

export function ProjectTag({ projectId }: { projectId: string }) {
  const project = getProject(projectId);

  if (!project) return null;

  return (
    <span className="project-tag">
      <i style={{ background: project.color }} />
      {project.name}
    </span>
  );
}
