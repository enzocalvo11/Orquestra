import { useEffect, type CSSProperties, type DragEvent } from "react";
import { Avatar } from "../../components/common/Avatar";
import { WorkCard } from "../../components/common/WorkCard";
import { holidayDays, people, projects, UNASSIGNED_PERSON_ID, weeks } from "../../data/demo-data";
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
  highlightedTaskId: string | null;
  highlightedCell: { personId: string; week: number } | null;
  highlightedCellKind: "alert" | "recommendation" | null;
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
  highlightedTaskId,
  highlightedCell,
  highlightedCellKind,
  projectFilter,
  draggedTask,
  onOpenTask,
  onDragStart,
  onDragEnd,
  onDrop,
}: PeopleByWeekProps) {
  useEffect(() => {
    if (!highlightedTaskId && !highlightedCell) return;
    const target = highlightedTaskId
      ? document.getElementById(`planning-task-${highlightedTaskId}`)
      : highlightedCell
        ? document.getElementById(`planning-cell-${highlightedCell.personId}-${highlightedCell.week}`)
        : null;
    target?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  }, [highlightedTaskId, highlightedCell, items]);

  // The filter only chooses who is listed; each person keeps the load from every project.
  const visiblePeople = projectFilter === "all"
    ? people
    : people.filter((person) =>
      items.some((task) => task.plannedPersonId === person.id && task.projectId === projectFilter),
    );
  const unassignedByWeek = weeks.map((_, week) => items.filter((task) =>
    task.plannedPersonId === UNASSIGNED_PERSON_ID && task.plannedWeek === week &&
    (task.status !== "Concluído" || task.id === highlightedTaskId) &&
    (projectFilter === "all" || task.projectId === projectFilter),
  ));
  const unassignedCount = unassignedByWeek.reduce((sum, tasks) => sum + tasks.length, 0);

  return (
    <div className="planning-scroll">
      {unassignedCount > 0 && (
        <section className="unassigned-queue" aria-labelledby="unassigned-queue-title">
          <div className="unassigned-queue-heading">
            <div>
              <h3 id="unassigned-queue-title">Atividades sem responsável</h3>
              <p>Esses itens não ocupam a capacidade de nenhum profissional. Arraste um cartão para atribuí-lo.</p>
            </div>
            <span>{unassignedCount} {unassignedCount === 1 ? "atividade" : "atividades"}</span>
          </div>
          <div className="unassigned-queue-weeks">
            {unassignedByWeek.map((tasks, week) => tasks.length > 0 && (
              <div className="unassigned-queue-week" key={week}>
                <strong>{weeks[week].label}</strong>
                <div className="planning-tasks">
                  {tasks.map((task) => (
                    <WorkCard key={task.id} task={task} draggable={task.status !== "Concluído"} highlighted={task.id === highlightedTaskId} onOpen={onOpenTask} onDragStart={onDragStart} onDragEnd={onDragEnd} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
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
              const visibleTasks = items.filter((task) =>
                task.plannedPersonId === person.id && task.plannedWeek === week &&
                (task.status !== "Concluído" || task.id === highlightedTaskId),
              );
              const canDrop = !draggedTask || person.skills.includes(draggedTask.skill);

              return (
                <div
                  key={week}
                  id={`planning-cell-${person.id}-${week}`}
                  className={`planning-cell ${cell.planned > cell.capacity ? "overloaded" : ""} ${!canDrop ? "drop-disabled" : ""} ${highlightedCell?.personId === person.id && highlightedCell.week === week ? highlightedCellKind === "recommendation" ? "planning-cell-recommendation" : "planning-cell-highlighted" : ""}`}
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
                    {visibleTasks.map((task) => (
                      <WorkCard
                        key={task.id}
                        task={task}
                        draggable={task.status !== "Concluído"}
                        highlighted={task.id === highlightedTaskId}
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
