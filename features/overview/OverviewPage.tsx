import { useState } from "react";
import type { CSSProperties } from "react";
import {
  Activity, AlertCircle, ArrowRight, CalendarDays,
  Cloud, Layers3, RefreshCw, UsersRound,
} from "lucide-react";
import { Avatar } from "../../components/common/Avatar";
import { AlertCard } from "../../components/common/AlertCard";
import { MetricCard } from "../../components/common/MetricCard";
import { absences, people, projects, weeks } from "../../data/demo-data";
import {
  formatHours, getPerson, getProject, overviewPeriod,
  type Alert, type LoadCell, type PlannedItem, type Suggestion,
} from "../../lib/planning";
import type { CapacitySelection, SourceInfo } from "../dashboard/types";

interface OverviewPageProps {
  items: PlannedItem[];
  loads: LoadCell[];
  alerts: Alert[];
  suggestions: Suggestion[];
  selectedCell: CapacitySelection;
  sourceInfo: SourceInfo | null;
  sourceError: string;
  syncing: boolean;
  onSelectCell: (selection: CapacitySelection) => void;
  onOpenTask: (taskId: string) => void;
  onReviewSuggestion: (suggestion: Suggestion) => void;
  onAlertSelect: (alert: Alert) => void;
  onRefresh: () => void;
  onNavigatePlanning: () => void;
}

const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const heatStops = [
  { at: 0, color: [31, 152, 89] },
  { at: 60, color: [147, 201, 78] },
  { at: 78, color: [227, 200, 62] },
  { at: 100, color: [231, 131, 69] },
] as const;

function colorAt(percent: number): number[] {
  const value = Math.min(Math.max(percent, 0), 100);
  const upperIndex = heatStops.findIndex(stop => stop.at >= value);
  const upper = heatStops[upperIndex < 0 ? heatStops.length - 1 : upperIndex];
  const lower = heatStops[Math.max(upperIndex - 1, 0)];
  const progress = upper.at === lower.at ? 0 : (value - lower.at) / (upper.at - lower.at);

  return upper.color.map((channel, index) =>
    Math.round(lower.color[index] + (channel - lower.color[index]) * progress),
  );
}

function toHex(color: number[]): string {
  return `#${color.map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
}

function mixWithWhite(color: number[], amount: number): string {
  return toHex(color.map(channel => Math.round(channel + (255 - channel) * amount)));
}

function darken(color: number[], amount: number): string {
  return toHex(color.map(channel => Math.round(channel * (1 - amount))));
}

function heatStyle(cell: LoadCell): CSSProperties {
  const color = cell.planned > cell.capacity ? [182, 75, 84] : colorAt(cell.percent);

  return {
    "--heat-bg": mixWithWhite(color, 0.46),
    "--heat-border": mixWithWhite(color, 0.25),
    "--heat-accent": darken(color, 0.4),
  } as CSSProperties;
}

function loadLabel(cell: LoadCell): string {
  if (cell.planned > cell.capacity) return `${formatHours(cell.planned - cell.capacity)}h acima da capacidade`;
  if (cell.planned === 0) return "Livre nesta semana";
  if (cell.percent >= 80) return "Próximo do limite";
  return `${formatHours(cell.capacity - cell.planned)}h livres`;
}

function CapacityHeatmap({
  cells, selectedPersonId, week, alertWeeks, onSelect, onWeekChange, onNavigatePlanning,
}: {
  cells: LoadCell[];
  selectedPersonId: string;
  week: number;
  alertWeeks: Set<number>;
  onSelect: (selection: CapacitySelection) => void;
  onWeekChange: (week: number) => void;
  onNavigatePlanning: () => void;
}) {
  return (
    <section className="surface overview-heatmap" aria-labelledby="overview-heatmap-title">
      <div className="section-heading">
        <div>
          <div className="section-kicker">CAPACIDADE DA EQUIPE</div>
          <h2 id="overview-heatmap-title">Mapa de ocupação semanal</h2>
          <p>Carga e capacidade por pessoa na semana selecionada.</p>
        </div>
        <div className="overview-week-selector" role="group" aria-label="Semana exibida no mapa de ocupação">
          {weeks.map((option, index) => (
            <button
              key={option.label}
              className={`${week === index ? "selected" : ""} ${alertWeeks.has(index) ? "has-alerts" : ""}`}
              onClick={() => onWeekChange(index)}
              aria-pressed={week === index}
              aria-label={`${option.label}${alertWeeks.has(index) ? ", há alertas" : ""}`}
              title={alertWeeks.has(index) ? "Há alertas nesta semana" : undefined}
            >
              {option.label}
              {alertWeeks.has(index) && <span className="overview-week-alert" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
      <div className="overview-heatmap-grid">
        {cells.map((cell) => {
          const person = getPerson(cell.personId)!;
          return (
            <button
              key={person.id}
              className={`overview-heat-tile ${selectedPersonId === person.id ? "is-selected" : ""}`}
              style={heatStyle(cell)}
              onClick={() => onSelect({ personId: person.id, week })}
              aria-pressed={selectedPersonId === person.id}
              aria-controls="overview-capacity-detail"
              aria-label={`${person.name}: ${formatHours(cell.planned)} de ${formatHours(cell.capacity)} horas na semana de ${weeks[week].range}, ${cell.percent}% de ocupação. ${loadLabel(cell)}`}
            >
              <span className="overview-heat-tile-top">
                <Avatar personId={person.id} small />
                <span className="overview-heat-name">{person.name}<small>{person.role}</small></span>
              </span>
              <span className="overview-heat-value">{cell.percent}%</span>
              <span className="overview-heat-track"><i style={{ width: `${Math.min(cell.percent, 100)}%` }} /></span>
              <span className="overview-heat-caption">{loadLabel(cell)}</span>
            </button>
          );
        })}
      </div>
      <div className="overview-heatmap-footer">
        <div className="overview-scale" aria-label="Escala contínua de verde a amarelo e laranja conforme a ocupação aumenta; vermelho escuro indica carga acima da capacidade">
          <span>Livre</span><i /><span>No limite</span><span>Excesso</span>
        </div>
        <button onClick={onNavigatePlanning}>Ver planejamento completo <ArrowRight size={15} /></button>
      </div>
    </section>
  );
}

function CapacityDetail({
  cell, suggestion, week, onReviewSuggestion, onOpenTask, onNavigatePlanning,
}: {
  cell: LoadCell;
  suggestion?: Suggestion;
  week: number;
  onReviewSuggestion: (suggestion: Suggestion) => void;
  onOpenTask: (taskId: string) => void;
  onNavigatePlanning: () => void;
}) {
  const person = getPerson(cell.personId)!;
  const absence = absences[person.id]?.[week] ?? 0;
  const status = cell.planned > cell.capacity ? "danger" : cell.percent >= 80 ? "caution" : "good";
  const tasks = [...cell.tasks].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  return (
    <aside id="overview-capacity-detail" className="surface overview-detail" aria-live="polite">
      <div className="section-kicker">DETALHE DA CAPACIDADE</div>
      <div className="insight-person">
        <Avatar personId={person.id} />
        <div><h3>{person.name}</h3><p>{person.role}</p></div>
      </div>
      <div className="insight-period"><CalendarDays size={15} /> Semana de {weeks[week].short}</div>
      <div className="insight-numbers">
        <div><strong>{formatHours(cell.planned)}h</strong><span>Planejadas</span></div>
        <div><strong>{formatHours(cell.capacity)}h</strong><span>Disponíveis</span></div>
      </div>
      <div className="overview-capacity-notes">
        <div className={`insight-status ${status}`}>
          <AlertCircle size={17} /> {loadLabel(cell)}
        </div>
        {absence > 0 && (
          <p className="absence-note">
            <CalendarDays size={17} />
            <span>Ausência de {absence}h considerada no cálculo.</span>
          </p>
        )}
      </div>
      <div className="insight-divider" />
      <strong className="detail-title">Atividades nesta semana</strong>
      {tasks.length ? (
        <div className="insight-tasks">
          {tasks.map((task) => {
            const project = getProject(task.projectId);
            return (
              <button key={task.id} onClick={() => onOpenTask(task.id)} aria-label={`Abrir atividade: ${task.title}`}>
                <i style={{ background: project?.color ?? "#cbd5e1" }} />
                <span>{task.title}<small>{project?.name ?? "Projeto"}</small></span>
                <b>{formatHours(task.hours)}h</b>
              </button>
            );
          })}
        </div>
      ) : <p className="empty-message">Nenhuma atividade atribuída nesta semana.</p>}
      {suggestion ? (
        <div className="insight-suggestion">
          <span>AJUSTE POSSÍVEL</span>
          <p>{suggestion.reason}</p>
          <button onClick={() => onReviewSuggestion(suggestion)}>
            Revisar sugestão <ArrowRight size={15} />
          </button>
        </div>
      ) : cell.planned > cell.capacity ? (
        <div className="overview-no-suggestion">
          <strong>Sem sugestão automática viável</strong>
          <p>Compare pessoas e semanas no planejamento antes de realocar uma atividade.</p>
          <button onClick={onNavigatePlanning}>Abrir planejamento <ArrowRight size={15} /></button>
        </div>
      ) : null}
    </aside>
  );
}

function WeekActivities({
  items, week, onOpenTask,
}: {
  items: PlannedItem[];
  week: number;
  onOpenTask: (taskId: string) => void;
}) {
  const assignments = people.map((person) => ({
    person,
    tasks: items
      .filter((task) => task.plannedWeek === week && task.plannedPersonId === person.id && task.status !== "Concluído")
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
  }));

  return (
    <section className="surface overview-week-activities" aria-labelledby="overview-week-activities-title">
      <div className="section-heading">
        <div>
          <div className="section-kicker">SEMANA ATUAL</div>
          <h2 id="overview-week-activities-title">Atividades propostas para esta semana</h2>
        </div>
        <span className="overview-week-chip"><CalendarDays size={15} /> {weeks[week].label}</span>
      </div>
      <div className="overview-week-table-scroll" role="region" aria-label="Tabela de atividades por profissional" tabIndex={0}>
        <table className="overview-week-table">
          <thead>
            <tr>
              {assignments.map(({ person }) => (
                <th scope="col" key={person.id}>
                  <Avatar personId={person.id} small />
                  <span>{person.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {assignments.map(({ person, tasks }) => (
                <td key={person.id}>
                  {tasks.length ? tasks.map((task) => {
                    const project = getProject(task.projectId);
                    return (
                      <button className="overview-week-task" key={task.id} onClick={() => onOpenTask(task.id)}>
                        <strong>{task.title}</strong>
                        <span><i style={{ background: project?.color }} />{project?.name ?? "Projeto"}</span>
                      </button>
                    );
                  }) : <span className="overview-week-no-tasks">—</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function OverviewPage({
  items, loads, alerts, suggestions, selectedCell, sourceInfo, sourceError, syncing,
  onSelectCell, onOpenTask, onReviewSuggestion, onAlertSelect, onRefresh,
  onNavigatePlanning,
}: OverviewPageProps) {
  const { week: currentWeek } = overviewPeriod();
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const weekLoads = loads.filter(cell => cell.week === selectedWeek);
  const alertWeeks = new Set(alerts.map((alert) => alert.week));
  const selectedLoad = weekLoads.find(cell => cell.personId === selectedCell.personId) ?? weekLoads[0];
  const weekAlerts = alerts.filter(alert => alert.week === selectedWeek);
  const overloaded = weekLoads.filter(cell => cell.planned > cell.capacity);
  const totalPlanned = items
    .filter((item) => item.plannedWeek === selectedWeek && item.status !== "Concluído")
    .reduce((sum, item) => sum + item.hours, 0);
  const unassignedHours = items
    .filter((item) => item.plannedWeek === selectedWeek && item.plannedPersonId === "sem-responsavel" && item.status !== "Concluído")
    .reduce((sum, item) => sum + item.hours, 0);
  const availableHours = weekLoads.reduce((sum, cell) => sum + cell.capacity, 0);
  const selectedSuggestion = suggestions.find(suggestion =>
    suggestion.fromPersonId === selectedLoad.personId && suggestion.fromWeek === selectedWeek);

  function selectWeek(week: number) {
    setSelectedWeek(week);
    onSelectCell({ personId: selectedLoad.personId, week });
  }

  function selectAlert(alert: Alert) {
    setSelectedWeek(alert.week);
    onAlertSelect(alert);
  }

  return (
    <>
      <div className="page-heading overview-page-heading">
        <div>
          <div className="eyebrow">VISÃO GERAL</div>
          <h1>Onde a equipe precisa de atenção?</h1>
          <p>Escolha uma semana para analisar a ocupação da equipe e revisar possíveis ajustes.</p>
        </div>
        <button className="primary-button" onClick={onRefresh} disabled={syncing}>
          <RefreshCw size={16} className={syncing ? "spinning" : ""} />
          {syncing ? "Atualizando..." : "Atualizar dados"}
        </button>
      </div>

      <div className="source-banner">
        <span className="source-icon"><Cloud size={19} /></span>
        <div>
          <strong>{sourceInfo?.source ?? "Azure DevOps"}</strong>
          <span>{sourceInfo
            ? `${sourceInfo.workItemCount} Work Items atuais em ${sourceInfo.projectCount} projetos. Equipe e capacidade permanecem como dados internos.`
            : sourceError || (syncing ? "Consultando Work Items no Azure DevOps..." : "Aguardando consulta ao Azure DevOps.")}</span>
        </div>
        <span className="source-status"><i /> {sourceInfo ? `Atualizado ${timeLabel(sourceInfo.syncedAt)}` : sourceError ? "Falha na consulta" : "Conectando"}</span>
      </div>

      <div className="section-kicker overview-metrics-title">
        {selectedWeek === currentWeek ? "SEMANA ATUAL" : "SEMANA SELECIONADA"} · {weeks[selectedWeek].label.toUpperCase()}
      </div>
      <div className="metric-grid">
        <MetricCard icon={Layers3} tone="violet" label="Projetos ativos" value={String(projects.length)} detail="Em 2 produtos" />
        <MetricCard icon={UsersRound} tone="teal" label="Profissionais" value={String(people.length)} detail="Capacidade da equipe" />
        <MetricCard icon={Activity} tone="amber" label="Carga na semana" value={`${formatHours(totalPlanned)}h`} detail={`de ${formatHours(availableHours)}h disponíveis${unassignedHours ? ` · ${formatHours(unassignedHours)}h sem responsável` : ""}`} />
        <MetricCard icon={AlertCircle} tone="red" label="Pessoas sobrecarregadas" value={String(overloaded.length)} detail={overloaded.length ? "Na semana selecionada" : "Nenhuma nesta semana"} />
      </div>

      {weekAlerts.length > 0 && (
        <AlertCard
          className="overview-priorities"
          alerts={weekAlerts}
          eyebrow={`PRIORIDADES · ${weeks[selectedWeek].label.toUpperCase()}`}
          emptyMessage="Nenhum conflito detectado nesta semana."
          maxVisible={4}
          onAlertSelect={selectAlert}
        />
      )}

      <div className="overview-focus-grid">
        <CapacityHeatmap
          cells={weekLoads}
          selectedPersonId={selectedLoad.personId}
          week={selectedWeek}
          alertWeeks={alertWeeks}
          onSelect={onSelectCell}
          onWeekChange={selectWeek}
          onNavigatePlanning={onNavigatePlanning}
        />
        <CapacityDetail
          cell={selectedLoad}
          suggestion={selectedSuggestion}
          week={selectedWeek}
          onReviewSuggestion={onReviewSuggestion}
          onOpenTask={onOpenTask}
          onNavigatePlanning={onNavigatePlanning}
        />
      </div>

      <WeekActivities items={items} week={currentWeek} onOpenTask={onOpenTask} />
    </>
  );
}
