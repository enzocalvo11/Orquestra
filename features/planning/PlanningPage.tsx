import { useState, type DragEvent } from "react";
import { Check, ChevronDown, Info, RotateCcw, Save } from "lucide-react";
import { AlertCard } from "../../components/common/AlertCard";
import { projects } from "../../data/demo-data";
import type { Alert, PlannedItem } from "../../lib/planning";
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
  highlightedTaskId: string | null;
  highlightedCell: { personId: string; week: number } | null;
  highlightedCellKind: "alert" | "recommendation" | null;
  alerts: Alert[];
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
  onAlertSelect: (alert: Alert) => void;
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLElement>, personId: string, week: number) => void;
}

export function PlanningPage({
  items,
  highlightedTaskId,
  highlightedCell,
  highlightedCellKind,
  alerts,
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
  onAlertSelect,
  onDragStart,
  onDragEnd,
  onDrop,
}: PlanningPageProps) {
  const [boardView, setBoardView] = useState<BoardView>("people");
  const [selectedProject, setSelectedProject] = useState("all");
  const [helpExpanded, setHelpExpanded] = useState(false);
  // Falls back to "all" if the chosen project disappears after the source is refreshed.
  const projectFilter = projects.some((project) => project.id === selectedProject) ? selectedProject : "all";
  const draggedTask = items.find((task) => task.id === dragTaskId);
  const planningAlerts = alerts.filter((alert) => alert.kind === "overload" || alert.kind === "deadline");
  useDragAutoScroll(dragTaskId !== null);

  return (
    <>
      <div className="page-heading planning-page-heading">
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

      <div
        className={`planning-banner ${helpExpanded ? "planning-banner-expanded" : "planning-banner-collapsed"}`}
        role="button"
        tabIndex={0}
        aria-expanded={helpExpanded}
        aria-controls="planning-help-details"
        onClick={() => setHelpExpanded((expanded) => !expanded)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setHelpExpanded((expanded) => !expanded);
          }
        }}
      >
        <span className="planning-banner-icon"><Info size={18} /></span>
        <div className="planning-banner-content">
          <strong>{boardView === "people" ? "Como usar:" : "Visão resumida:"}</strong>
          {boardView === "people" ? (
            <ul className="planning-instructions" id="planning-help-details" hidden={!helpExpanded}>
              <li>Arraste uma atividade ou clique no cartão para testar uma nova distribuição.</li>
              <li>As mudanças só são gravadas ao <strong>SALVAR</strong>.</li>
            </ul>
          ) : (
            <p id="planning-help-details" hidden={!helpExpanded}>Mostra quanto cada projeto consome da equipe por semana. Para mover atividades, volte para Pessoas × semanas.</p>
          )}
        </div>
        <ChevronDown className={`planning-banner-chevron ${helpExpanded ? "is-expanded" : ""}`} size={18} aria-hidden="true" />
      </div>

      {planningAlerts.length > 0 && (
        <AlertCard
          className="planning-alerts"
          alerts={planningAlerts}
          eyebrow="ALERTAS DE SOBRECARGA E PRAZO"
          onAlertSelect={onAlertSelect}
        />
      )}

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
              {highlightedCellKind === "recommendation" && (
                <span><i className="legend-dot recommendation" /> Destino recomendado</span>
              )}
            </div>
          )}
        </div>

        {boardView === "people" ? (
          <PeopleByWeek
            items={items}
            highlightedTaskId={highlightedTaskId}
            highlightedCell={highlightedCell}
            highlightedCellKind={highlightedCellKind}
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
