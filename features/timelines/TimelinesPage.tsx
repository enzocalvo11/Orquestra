import { Layers3 } from "lucide-react";
import { Avatar } from "../../components/common/Avatar";
import { projects, weeks, type WorkItem } from "../../data/demo-data";
import { getPerson, type PlannedItem } from "../../lib/planning";

const typeName: Record<WorkItem["type"], string> = {
  Task: "Tarefa",
  Bug: "Bug",
  Test: "Teste",
};

interface TimelinesPageProps {
  selectedProject: string;
  items: PlannedItem[];
  onProjectChange: (projectId: string) => void;
  onOpenTask: (taskId: string) => void;
}

export function TimelinesPage({
  selectedProject,
  items,
  onProjectChange,
  onOpenTask,
}: TimelinesPageProps) {
  const visibleProjects = projects.filter(
    (project) => selectedProject === "all" || project.id === selectedProject,
  );

  return (
    <>
      <div className="page-heading timelines-page-heading">
        <div>
          <div className="eyebrow">PROJETOS E ENTREGAS</div>
          <h1>Timelines dos projetos</h1>
          <p>Atividades, responsáveis e prazos organizados por semana.</p>
        </div>
        <span className="subtle-badge"><Layers3 size={16} /> {projects.length} projetos</span>
      </div>

      <div className="filter-row">
        <button
          className={selectedProject === "all" ? "selected" : ""}
          onClick={() => onProjectChange("all")}
        >
          Todos os projetos
        </button>
        {projects.map((project) => (
          <button
            key={project.id}
            className={selectedProject === project.id ? "selected" : ""}
            onClick={() => onProjectChange(project.id)}
          >
            <i style={{ background: project.color }} />
            {project.name}
          </button>
        ))}
      </div>

      <div className="timeline-stack">
        {visibleProjects.map((project) => {
          const projectItems = items.filter((item) => item.projectId === project.id);

          return (
            <section className="surface timeline-project" key={project.id}>
              <div className="timeline-project-head">
                <div className="project-icon" style={{ background: project.color }}>
                  <Layers3 size={21} />
                </div>
                <div>
                  <span className="product-name">{project.product}</span>
                  <h2>{project.name}</h2>
                  <p>{project.description}</p>
                </div>
                <span className="project-item-count">{projectItems.length} itens</span>
              </div>

              <div className="timeline-scroll">
                <div className="timeline-grid">
                  {weeks.map((week, weekIndex) => {
                    const weekItems = projectItems.filter((item) => item.plannedWeek === weekIndex);

                    return (
                      <div className="timeline-week" key={weekIndex}>
                        <div className="timeline-week-head">
                          <strong>{week.label}</strong>
                          <small>{weekItems.length} atividades</small>
                        </div>
                        <div className="timeline-items">
                          {weekItems.map((task) => (
                            <div className="timeline-task" key={task.id}>
                              <button onClick={() => onOpenTask(task.id)}>
                                <span className="timeline-task-type">{typeName[task.type]} · {task.id}</span>
                                <strong>{task.title}</strong>
                                <span className="timeline-task-meta">
                                  <Avatar personId={task.plannedPersonId} small />
                                  {getPerson(task.plannedPersonId)?.name ?? "Sem responsável"}
                                  <b>{task.hours}h</b>
                                </span>
                              </button>
                            </div>
                          ))}
                          {!weekItems.length && <span className="timeline-empty">Sem atividades</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
