import type { CSSProperties } from "react";
import { holidayDays, people, projects, UNASSIGNED_PERSON_ID, weeks } from "../../data/demo-data";
import { capacityFor, formatHours, loadFor, type PlannedItem } from "../../lib/planning";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

interface ProjectWeekCell {
  hours: number;
  taskCount: number;
  peopleCount: number;
  overloadedCount: number;
}

// Read-only summary: how much of each week every project consumes.
function projectCell(items: PlannedItem[], projectId: string, week: number): ProjectWeekCell {
  const tasks = items.filter((task) =>
    task.projectId === projectId && task.plannedWeek === week && task.status !== "Concluído",
  );
  const personIds = [...new Set(tasks.map((task) => task.plannedPersonId))]
    .filter((personId) => personId !== UNASSIGNED_PERSON_ID);
  const overloadedCount = personIds.filter((personId) => {
    const load = loadFor(items, personId, week);
    return load.planned > load.capacity;
  }).length;

  return {
    hours: tasks.reduce((sum, task) => sum + task.hours, 0),
    taskCount: tasks.length,
    peopleCount: personIds.length,
    overloadedCount,
  };
}

export function ProjectsByWeek({ items }: { items: PlannedItem[] }) {
  const team = people.filter((person) => person.id !== UNASSIGNED_PERSON_ID);
  const rows = projects.map((project) => ({
    project,
    cells: weeks.map((_, week) => projectCell(items, project.id, week)),
  }));
  const maxHours = Math.max(1, ...rows.flatMap((row) => row.cells.map((cell) => cell.hours)));
  const totals = weeks.map((_, week) => ({
    hours: rows.reduce((sum, row) => sum + row.cells[week].hours, 0),
    capacity: team.reduce((sum, person) => sum + capacityFor(person, week), 0),
  }));

  return (
    <div className="planning-scroll">
      <div className="projects-grid">
        <div className="projects-grid-head">
          <div>PROJETO</div>
          {weeks.map((week, index) => (
            <div key={week.label}>
              {week.label}
              <small>{holidayDays[index] ? "Feriado · 12/10" : "Semana de trabalho"}</small>
            </div>
          ))}
        </div>

        {rows.map(({ project, cells }) => {
          const totalHours = cells.reduce((sum, cell) => sum + cell.hours, 0);
          const totalTasks = cells.reduce((sum, cell) => sum + cell.taskCount, 0);

          return (
            <div
              className="projects-grid-row"
              key={project.id}
              style={{ "--project-color": project.color } as CSSProperties}
            >
              <div className="projects-name">
                <span className="projects-name-title"><i aria-hidden="true" />{project.name}</span>
                <small>{project.product}</small>
                <small>{formatHours(totalHours)}h · {plural(totalTasks, "tarefa", "tarefas")}</small>
              </div>
              {cells.map((cell, week) => (
                <div className="projects-cell" key={week}>
                  {cell.taskCount ? (
                    <>
                      <div className="projects-cell-main">
                        <strong>{formatHours(cell.hours)}h</strong>
                        <span className="projects-cell-share" title="Parte da carga planejada da semana">
                          {Math.round((cell.hours / totals[week].hours) * 100)}% da semana
                        </span>
                      </div>
                      <div className="projects-bar">
                        <i style={{ width: `${Math.round((cell.hours / maxHours) * 100)}%` }} />
                      </div>
                      <small>
                        {plural(cell.taskCount, "tarefa", "tarefas")} · {plural(cell.peopleCount, "pessoa", "pessoas")}
                      </small>
                      {cell.overloadedCount > 0 && (
                        <span className="projects-cell-alert">
                          {plural(cell.overloadedCount, "pessoa acima do limite", "pessoas acima do limite")}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="projects-cell-empty">Sem atividades</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        <div className="projects-grid-row projects-total-row">
          <div className="projects-name">
            <span className="projects-name-title">Total da equipe</span>
            <small>Horas planejadas / capacidade</small>
          </div>
          {totals.map((total, week) => (
            <div className="projects-cell" key={week}>
              <strong className={total.hours > total.capacity ? "percent-danger" : ""}>
                {formatHours(total.hours)} / {formatHours(total.capacity)}h
              </strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
