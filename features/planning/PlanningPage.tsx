import { useState, type DragEvent } from "react";
import { Check, Info, RotateCcw, Save } from "lucide-react";
import { projects } from "../../data/demo-data";
import type { PlannedItem } from "../../lib/planning";
import { PeopleByWeek } from "./PeopleByWeek";
import { ProjectsByWeek } from "./ProjectsByWeek";
import { useDragAutoScroll } from "./useDragAutoScroll";

type BoardView = "people" | "projects";

const boardViews: ReadonlyArray<{ key: BoardView; label: string }> = [
  { key: "people", label: "Pessoas × semanas" },
  { key: "projects", label: "Projetos × semanas" },
];

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
  const [boardView, setBoardView] = useState<BoardView>("people");
  const [selectedProject, setSelectedProject] = useState("all");
  // Falls back to "all" if the chosen project disappears after the source is refreshed.
  const projectFilter = projects.some((project) => project.id === selectedProject) ? selectedProject : "all";
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
          {boardView === "people" ? (
            <><strong>Como usar:</strong> mova os cartões para testar uma nova distribuição. As mudanças só são gravadas ao salvar.</>
          ) : (
            <><strong>Visão resumida:</strong> mostra quanto cada projeto consome da equipe por semana. Para mover atividades, volte para Pessoas × semanas.</>
          )}
        </p>
        <span>{hasPendingChanges ? "Não salvo" : `${changeCount} salvas`}</span>
      </div>

      <div className="surface planning-surface">
        <div className="section-heading">
          <div>
            <div className="section-kicker">
              {boardView === "people" ? "QUADRO DE REALOCAÇÃO" : "RESUMO POR PROJETO"}
            </div>
            <div className="planning-view-controls">
              <div className="planning-view-tabs" role="tablist" aria-label="Foco do quadro">
                {boardViews.map(({ key, label }) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={boardView === key}
                    className={boardView === key ? "active" : ""}
                    onClick={() => setBoardView(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {boardView === "people" && (
                <label className="planning-project-filter">
                  <span>Filtrar pessoas pelo(s) projeto(s)</span>
                  <select value={projectFilter} onChange={(event) => setSelectedProject(event.target.value)}>
                    <option value="all">Todos os projetos</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
          {boardView === "people" && (
            <div className="legend">
              <span><i className="legend-dot good" /> Espaço livre</span>
              <span><i className="legend-dot danger" /> Acima do limite</span>
            </div>
          )}
        </div>

        {boardView === "people" ? (
          <PeopleByWeek
            items={items}
            projectFilter={projectFilter}
            draggedTask={draggedTask}
            onOpenTask={onOpenTask}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
          />
        ) : (
          <ProjectsByWeek items={items} />
        )}
      </div>
    </>
  );
}
