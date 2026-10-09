import type { CSSProperties, DragEvent } from "react";
import { Check, Info, RotateCcw, Save } from "lucide-react";
import { Avatar } from "../../components/common/Avatar";
import { WorkCard } from "../../components/common/WorkCard";
import { holidayDays, people, projects, weeks } from "../../data/demo-data";
import { formatHours, loadFor, type PlannedItem } from "../../lib/planning";
import { useDragAutoScroll } from "./useDragAutoScroll";

// Projects where the person has at least one activity in the current scenario.
function projectsOf(items: PlannedItem[], personId: string) {
  const projectIds = new Set(
    items.filter((task) => task.plannedPersonId === personId).map((task) => task.projectId),
  );
  return projects.filter((project) => projectIds.has(project.id));
}

interface PlanningPageProps {
  items: PlannedItem[];
  changeCount: number;
  pendingChangeCount: number;
  hasPendingChanges: boolean;
  showSavedIndicator: boolean;
  busy: boolean;
  dragTaskId: string | null;
  onReset: () => void;
  onCancelChanges: () => void;
  onSaveChanges: () => void;
  onOpenTask: (taskId: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLElement>, personId: string, week: number) => void;
}

export function PlanningPage({
  items,
  changeCount,
  pendingChangeCount,
  hasPendingChanges,
  showSavedIndicator,
  busy,
  dragTaskId,
  onReset,
  onCancelChanges,
  onSaveChanges,
  onOpenTask,
  onDragStart,
  onDragEnd,
  onDrop,
}: PlanningPageProps) {
  const draggedTask = items.find((task) => task.id === dragTaskId);
  useDragAutoScroll(dragTaskId !== null);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CENÁRIO DE ALOCAÇÃO</div>
          <h1>Planeje antes de decidir.</h1>
          <p>Arraste uma atividade ou abra o cartão para escolher o destino. Salve quando terminar.</p>
        </div>
        <div className="planning-actions">
          {hasPendingChanges ? (
            <>
              <span className="planning-pending-indicator">
                {pendingChangeCount} {pendingChangeCount === 1 ? "alteração pendente" : "alterações pendentes"}
              </span>
              <button className="secondary-button" onClick={onCancelChanges} disabled={busy}>Cancelar</button>
              <button className="primary-button" onClick={onSaveChanges} disabled={busy}>
                <Save size={16} /> {busy ? "Salvando..." : "Salvar Alterações"}
              </button>
            </>
          ) : (
            <>
              {showSavedIndicator && (
                <span className="planning-saved-indicator" role="status"><Check size={15} /> Alterações salvas</span>
              )}
              <button
                className="secondary-button"
                onClick={onReset}
                disabled={changeCount === 0 || busy}
              >
                <RotateCcw size={16} /> Restaurar plano inicial
              </button>
            </>
          )}
        </div>
      </div>

      <div className="planning-banner">
        <span><Info size={18} /></span>
        <p>
          <strong>Como usar:</strong> mova os cartões para testar uma nova distribuição. As mudanças só são gravadas ao salvar.
        </p>
        <span>{hasPendingChanges ? "Não salvo" : `${changeCount} salvas`}</span>
      </div>

      <div className="surface planning-surface">
        <div className="section-heading">
          <div>
            <div className="section-kicker">QUADRO DE REALOCAÇÃO</div>
            <h2>Pessoas × semanas</h2>
          </div>
          <div className="legend">
            <span><i className="legend-dot good" /> Espaço livre</span>
            <span><i className="legend-dot danger" /> Acima do limite</span>
          </div>
        </div>

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

            {people.map((person) => (
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
                  const canDrop = !draggedTask || person.skills.includes(draggedTask.skill);

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
      </div>
    </>
  );
}
