import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Cloud,
  Info,
  Layers3,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { Avatar } from "../../components/common/Avatar";
import { MetricCard } from "../../components/common/MetricCard";
import {
  absences,
  holidayDays,
  people,
  projects,
  weeks,
} from "../../data/demo-data";
import {
  capacityFor,
  formatHours,
  getPerson,
  getProject,
  loadFor,
  type Alert,
  type LoadCell,
  type PlannedItem,
  type Suggestion,
} from "../../lib/planning";
import type { CapacitySelection, SourceInfo } from "../dashboard/types";

const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

interface OverviewPageProps {
  items: PlannedItem[];
  loads: LoadCell[];
  alerts: Alert[];
  suggestions: Suggestion[];
  selectedCell: CapacitySelection;
  sourceInfo: SourceInfo | null;
  syncing: boolean;
  onSelectCell: (selection: CapacitySelection) => void;
  onOpenTask: (taskId: string) => void;
  onApplySuggestion: (suggestion: Suggestion) => void;
  onAlertSelect: (alert: Alert) => void;
  onRefresh: () => void;
}

export function OverviewPage({
  items,
  loads,
  alerts,
  suggestions,
  selectedCell,
  sourceInfo,
  syncing,
  onSelectCell,
  onOpenTask,
  onApplySuggestion,
  onAlertSelect,
  onRefresh,
}: OverviewPageProps) {
  const overloaded = loads.filter((cell) => cell.planned > cell.capacity);
  const totalHours = items
    .filter((task) => task.status !== "Concluído")
    .reduce((sum, task) => sum + task.hours, 0);
  const availableHours = people.reduce((sum, person) => sum + capacityFor(person, 0), 0);
  const selectedLoad = loadFor(items, selectedCell.personId, selectedCell.week);
  const selectedPerson = getPerson(selectedCell.personId);
  const selectedSuggestion = suggestions.find(
    (suggestion) =>
      suggestion.fromPersonId === selectedCell.personId &&
      suggestion.fromWeek === selectedCell.week,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">VISÃO CONSOLIDADA <span>·</span> SEMANA DE 05 OUT</div>
          <h1>Uma visão clara de toda a operação.</h1>
          <p>Acompanhe a capacidade da equipe e antecipe conflitos entre projetos.</p>
        </div>
        <button className="primary-button" onClick={onRefresh} disabled={syncing}>
          <RefreshCw size={16} className={syncing ? "spinning" : ""} />
          {syncing ? "Atualizando..." : "Atualizar dados"}
        </button>
      </div>

      <div className="source-banner">
        <span className="source-icon"><Cloud size={19} /></span>
        <div>
          <strong>Fonte de demonstração: Azure DevOps</strong>
          <span>22 work items fictícios em 3 projetos · tarefas, bugs e testes</span>
        </div>
        <span className="source-status">
          <i />
          {sourceInfo
            ? `Atualizado às ${timeLabel(sourceInfo.syncedAt)}`
            : "Pronto para consultar"}
        </span>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Layers3} tone="violet" label="Projetos ativos" value={String(projects.length)} detail="Em 2 produtos" />
        <MetricCard icon={UsersRound} tone="teal" label="Equipe alocada" value={String(people.length)} detail="2 squads conectados" />
        <MetricCard
          icon={Activity}
          tone="amber"
          label="Carga nesta semana"
          value={`${loads.filter((cell) => cell.week === 0).reduce((sum, cell) => sum + cell.planned, 0)}h`}
          detail={`de ${formatHours(availableHours)}h disponíveis`}
        />
        <MetricCard
          icon={AlertCircle}
          tone="red"
          label="Sobrecargas"
          value={String(overloaded.length)}
          detail={`${new Set(overloaded.map((cell) => cell.personId)).size} profissionais afetados`}
        />
      </div>

      <div className="overview-grid">
        <section className="surface capacity-panel">
          <div className="section-heading">
            <div>
              <div className="section-kicker">PLANEJAMENTO</div>
              <h2>Mapa de capacidade</h2>
              <p>Carga somada de todos os projetos por pessoa e semana</p>
            </div>
            <div className="legend">
              <span><i className="legend-dot good" /> Disponível</span>
              <span><i className="legend-dot caution" /> Atenção</span>
              <span><i className="legend-dot danger" /> Sobrecarga</span>
            </div>
          </div>

          <div className="capacity-scroll">
            <div className="capacity-table">
              <div className="capacity-head">
                <span>PROFISSIONAL</span>
                {weeks.map((week, index) => (
                  <span key={index}>
                    {week.label}
                    {holidayDays[index] ? <small>Feriado · 12/10</small> : null}
                  </span>
                ))}
              </div>
              {people.map((person) => (
                <div className="capacity-row" key={person.id}>
                  <div className="capacity-person">
                    <Avatar personId={person.id} small />
                    <span><strong>{person.name}</strong><small>{person.role}</small></span>
                  </div>
                  {weeks.map((_, week) => {
                    const cell = loadFor(items, person.id, week);
                    const tone = cell.percent > 100
                      ? "danger"
                      : cell.percent >= 80
                        ? "caution"
                        : "good";

                    return (
                      <button
                        key={week}
                        className={`capacity-cell ${tone} ${selectedCell.personId === person.id && selectedCell.week === week ? "selected" : ""}`}
                        onClick={() => onSelectCell({ personId: person.id, week })}
                        aria-label={`${person.name}, ${weeks[week].range}: ${cell.planned} de ${formatHours(cell.capacity)} horas`}
                      >
                        <span><strong>{cell.planned}h</strong><small>/ {formatHours(cell.capacity)}h</small></span>
                        <div className="cell-track"><i style={{ width: `${Math.min(cell.percent, 100)}%` }} /></div>
                        <em>{cell.percent}%</em>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="capacity-foot">
            <span><Info size={15} /> Selecione uma célula para ver os projetos que compõem a carga.</span>
            <span>{totalHours}h planejadas no período</span>
          </div>
        </section>

        <aside className="surface insight-panel">
          <div className="section-kicker">DETALHE DA CAPACIDADE</div>
          {selectedPerson && (
            <>
              <div className="insight-person">
                <Avatar personId={selectedPerson.id} />
                <div><h3>{selectedPerson.name}</h3><p>{selectedPerson.role}</p></div>
              </div>
              <div className="insight-period"><CalendarDays size={15} /> Semana de {weeks[selectedCell.week].short}</div>
              <div className="insight-numbers">
                <div><strong>{selectedLoad.planned}h</strong><span>Planejadas</span></div>
                <div><strong>{formatHours(selectedLoad.capacity)}h</strong><span>Disponíveis</span></div>
              </div>
              <div className={`insight-status ${selectedLoad.percent > 100 ? "danger" : selectedLoad.percent >= 80 ? "caution" : "good"}`}>
                <AlertCircle size={17} />
                {selectedLoad.percent > 100
                  ? `${formatHours(selectedLoad.planned - selectedLoad.capacity)}h acima da capacidade`
                  : selectedLoad.percent >= 80
                    ? "Capacidade próxima do limite"
                    : `${formatHours(selectedLoad.capacity - selectedLoad.planned)}h disponíveis`}
              </div>
              <div className="insight-divider" />
              <strong className="detail-title">Atividades nesta semana</strong>
              {selectedLoad.tasks.length ? (
                <div className="insight-tasks">
                  {selectedLoad.tasks.map((task) => (
                    <button key={task.id} onClick={() => onOpenTask(task.id)}>
                      <i style={{ background: getProject(task.projectId)?.color }} />
                      <span>{task.title}<small>{getProject(task.projectId)?.name}</small></span>
                      <b>{task.hours}h</b>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="empty-message">Nenhuma atividade planejada.</p>
              )}
              {(absences[selectedPerson.id]?.[selectedCell.week] ?? 0) > 0 && (
                <p className="absence-note">
                  Ausência de {absences[selectedPerson.id][selectedCell.week]}h considerada no cálculo.
                </p>
              )}
              {selectedSuggestion && (
                <div className="insight-suggestion">
                  <span>AJUSTE POSSÍVEL</span>
                  <p>{selectedSuggestion.reason}</p>
                  <button onClick={() => onApplySuggestion(selectedSuggestion)}>
                    Aplicar sugestão <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <section className="surface alert-panel">
        <div className="section-heading">
          <div>
            <div className="section-kicker">ATENÇÃO AGORA</div>
            <h2>Conflitos detectados</h2>
            <p>Alertas gerados a partir da carga, disponibilidade e prazos</p>
          </div>
          <span className="alert-count">{alerts.length} alertas</span>
        </div>
        <div className="alert-list">
          {alerts.slice(0, 5).map((alert) => (
            <button className="alert-row" key={alert.id} onClick={() => onAlertSelect(alert)}>
              <span className={`alert-icon ${alert.severity}`}><AlertCircle size={17} /></span>
              <span><strong>{alert.title}</strong><small>{alert.detail}</small></span>
              <em>{weeks[alert.week].label}</em>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
