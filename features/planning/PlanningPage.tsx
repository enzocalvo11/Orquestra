import type { DragEvent } from "react";
import { Info, RotateCcw } from "lucide-react";
import { Avatar } from "../../components/common/Avatar";
import { WorkCard } from "../../components/common/WorkCard";
import { holidayDays, people, weeks } from "../../data/demo-data";
import { formatHours, loadFor, type PlannedItem } from "../../lib/planning";

interface PlanningPageProps {
  items: PlannedItem[];
  changeCount: number;
  busy: boolean;
  dragTaskId: string | null;
  onReset: () => void;
  onOpenTask: (taskId: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLElement>, personId: string, week: number) => void;
}

export function PlanningPage({
  items,
  changeCount,
  busy,
  dragTaskId,
  onReset,
  onOpenTask,
  onDragStart,
  onDragEnd,
  onDrop,
}: PlanningPageProps) {
  const draggedTask = items.find((task) => task.id === dragTaskId);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CENÁRIO DE ALOCAÇÃO</div>
          <h1>Planeje antes de decidir.</h1>
          <p>Arraste uma atividade para outra pessoa ou semana. As mudanças ficam salvas como propostas.</p>
        </div>
        <button
          className="secondary-button"
          onClick={onReset}
          disabled={changeCount === 0 || busy}
        >
          <RotateCcw size={16} /> Restaurar plano inicial
        </button>
      </div>

      <div className="planning-banner">
        <span><Info size={18} /></span>
        <p>
          <strong>Como usar:</strong> arraste um cartão para uma célula ou clique nele para escolher responsável e período. A pessoa de destino deve ter a habilidade necessária. Prazos ultrapassados geram um alerta.
        </p>
        <span>{changeCount} {changeCount === 1 ? "alteração" : "alterações"}</span>
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
                </div>
                {weeks.map((_, week) => {
                  const cell = loadFor(items, person.id, week);
                  const canDrop = !draggedTask || person.skills.includes(draggedTask.skill);

                  return (
                    <div
                      key={week}
                      className={`planning-cell ${cell.planned > cell.capacity ? "overloaded" : ""} ${!canDrop ? "drop-disabled" : ""}`}
                      onDragOver={(event) => {
                        if (canDrop) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        if (canDrop) onDrop(event, person.id, week);
                      }}
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
