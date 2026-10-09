import type { CSSProperties, DragEvent } from "react";
import { Avatar } from "../../components/common/Avatar";
import { WorkCard } from "../../components/common/WorkCard";
import { holidayDays, people, projects, weeks } from "../../data/demo-data";
import { formatHours, loadFor, type PlannedItem } from "../../lib/planning";

// Projects where the person has at least one activity in the current scenario.
function projectsOf(items: PlannedItem[], personId: string) {
  const projectIds = new Set(
    items.filter((task) => task.plannedPersonId === personId).map((task) => task.projectId),
  );
  return projects.filter((project) => projectIds.has(project.id));
}

interface PeopleByWeekProps {
  items: PlannedItem[];
  // "all" or a project id: only people with an activity in that project are listed.
  projectFilter: string;
  draggedTask: PlannedItem | undefined;
  onOpenTask: (taskId: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLElement>, personId: string, week: number) => void;
}

export function PeopleByWeek({
  items,
  projectFilter,
  draggedTask,
  onOpenTask,
  onDragStart,
  onDragEnd,
  onDrop,
}: PeopleByWeekProps) {
  // The filter only chooses who is listed; each person keeps the load from every project.
  const visiblePeople = projectFilter === "all"
    ? people
    : people.filter((person) =>
      items.some((task) => task.plannedPersonId === person.id && task.projectId === projectFilter),
    );

  return (
    <div className="planning-scroll">
      <div className="planning-grid">
        <div className="planning-grid-head">
          <div>PROFISSIONAL</div>
          {weeks.map((week, index) => (
            <div key={week.label}>
              {week.label}
              <small>{holidayDays[index] ? "Feriado · 12/10" : "Semana de trabalho"}</small>
            </div>
          ))}
        </div>

        {!visiblePeople.length && (
          <p className="planning-empty">Nenhuma pessoa tem atividades neste projeto.</p>
        )}

        {visiblePeople.map((person) => (
          <div className="planning-grid-row" key={person.id}>
            <div className="planning-person">
              <Avatar personId={person.id} />
              <strong>{person.name}</strong>
              <small>{person.role}</small>
              <ul className="planning-person-projects" aria-label={`Projetos de ${person.name}`}>
                {projectsOf(items, person.id).map((project) => (
                  <li key={project.id} style={{ "--project-color": project.color } as CSSProperties}>
                    <i aria-hidden="true" />
                    {project.name}
                  </li>
                ))}
              </ul>
            </div>
            {weeks.map((_, week) => {
              const cell = loadFor(items, person.id, week);
              const canDrop = person.id !== "sem-responsavel" &&
                (!draggedTask || person.skills.includes(draggedTask.skill));

              return (
                <div
                  key={week}
                  className={`planning-cell ${cell.planned > cell.capacity ? "overloaded" : ""} ${!canDrop ? "drop-disabled" : ""}`}
                  // Blocked cells still accept the drop so the dashboard can explain why it was refused.
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onDrop(event, person.id, week)}
                >
                  <div className="planning-cell-head">
                    <span>{cell.planned} / {formatHours(cell.capacity)}h</span>
                    <span className={cell.percent > 100 ? "percent-danger" : ""}>{cell.percent}%</span>
                  </div>
                  <div className="planning-bar">
                    <i style={{ width: `${Math.min(cell.percent, 100)}%` }} />
                  </div>
                  <div className="planning-tasks">
                    {cell.tasks.map((task) => (
                      <WorkCard
                        key={task.id}
                        task={task}
                        draggable
                        onOpen={onOpenTask}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                      />
                    ))}
                  </div>
                  {!cell.tasks.length && <span className="drop-hint">Solte uma atividade aqui</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
