"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { NoticeToast } from "../../components/feedback/NoticeToast";
import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import { people, type PlanChange } from "../../data/demo-data";
import { OverviewPage } from "../overview/OverviewPage";
import { PlanningPage } from "../planning/PlanningPage";
import { TeamPage } from "../team/TeamPage";
import { TaskDialog } from "../work-items/TaskDialog";
import { TimelinesPage } from "../timelines/TimelinesPage";
import {
  allLoads,
  capacityFor,
  getAlerts,
  getPerson,
  getSuggestions,
  plannedItems,
  type Suggestion,
} from "../../lib/planning";
import type { CapacitySelection, DashboardView, SourceInfo } from "./types";

interface DashboardProps {
  initialChanges: PlanChange[];
}

interface PlanApiResponse {
  error?: string;
  changes: PlanChange[];
}

export default function Dashboard({ initialChanges }: DashboardProps) {
  const [view, setView] = useState<DashboardView>("overview");
  const [changes, setChanges] = useState<PlanChange[]>(initialChanges);
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedCell, setSelectedCell] = useState<CapacitySelection>({ personId: "ana", week: 0 });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [draftPerson, setDraftPerson] = useState("ana");
  const [draftWeek, setDraftWeek] = useState(0);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [notice, setNotice] = useState("");

  const items = useMemo(() => plannedItems(changes), [changes]);
  const loads = useMemo(() => allLoads(items), [items]);
  const alerts = useMemo(() => getAlerts(items), [items]);
  const suggestions = useMemo(() => getSuggestions(items), [items]);
  const activeTask = taskId ? items.find((task) => task.id === taskId) : undefined;
  const availableHours = people.reduce((sum, person) => sum + capacityFor(person, 0), 0);
  const highAlertCount = alerts.filter((alert) => alert.severity === "high").length;

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => setNotice(""), 4200);
    return () => clearTimeout(timer);
  }, [notice]);

  function openTask(id: string) {
    const task = items.find((item) => item.id === id);
    if (!task) return;

    setTaskId(id);
    setDraftPerson(task.plannedPersonId);
    setDraftWeek(task.plannedWeek);
  }

  async function moveTask(id: string, personId: string, weekIndex: number) {
    if (busy) return;

    const task = items.find((item) => item.id === id);
    if (!task) return;

    const person = getPerson(personId);
    if (!person?.skills.includes(task.skill)) {
      setNotice(`${person?.name ?? "Este profissional"} não possui a habilidade necessária.`);
      return;
    }

    if (task.plannedPersonId === personId && task.plannedWeek === weekIndex) {
      setTaskId(null);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: id, personId, weekIndex }),
      });
      const data = await response.json() as PlanApiResponse;

      if (!response.ok) throw new Error(data.error ?? "Falha ao salvar.");

      setChanges(data.changes);
      setSelectedCell({ personId, week: weekIndex });
      setNotice(`${task.title} realocada. A capacidade foi recalculada.`);
      setTaskId(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar a mudança.");
    } finally {
      setBusy(false);
      setDragTaskId(null);
    }
  }

  async function resetPlan() {
    if (!changes.length || busy) return;

    setBusy(true);
    try {
      const response = await fetch("/api/plan", { method: "DELETE" });
      if (!response.ok) throw new Error();

      setChanges([]);
      setNotice("Planejamento original restaurado.");
    } catch {
      setNotice("Não foi possível restaurar o planejamento.");
    } finally {
      setBusy(false);
    }
  }

  async function syncSource() {
    setSyncing(true);
    try {
      const response = await fetch("/api/source", { cache: "no-store" });
      if (!response.ok) throw new Error();

      const data = await response.json() as SourceInfo;
      setSourceInfo(data);
      setNotice(`${data.workItemCount} itens fictícios atualizados na visão.`);
    } catch {
      setNotice("Não foi possível consultar a fonte de demonstração.");
    } finally {
      setSyncing(false);
    }
  }

  function startDrag(event: DragEvent<HTMLElement>, id: string) {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDragTaskId(id);
  }

  function dropTask(event: DragEvent<HTMLElement>, personId: string, weekIndex: number) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragTaskId;
    if (id) void moveTask(id, personId, weekIndex);
  }

  function selectProject(projectId: string) {
    setSelectedProject(projectId);
    setView("timelines");
  }

  function handleAlertSelect(alert: (typeof alerts)[number]) {
    setSelectedCell({ personId: alert.personId, week: alert.week });
    if (alert.taskId) openTask(alert.taskId);
  }

  function applySuggestion(suggestion: Suggestion) {
    void moveTask(suggestion.taskId, suggestion.toPersonId, suggestion.toWeek);
  }

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        highAlertCount={highAlertCount}
        onViewChange={setView}
        onProjectSelect={selectProject}
      />

      <div className="content-shell">
        <Topbar view={view} alertCount={alerts.length} />
        <main className="main-content">
          {view === "overview" && (
            <OverviewPage
              items={items}
              loads={loads}
              alerts={alerts}
              suggestions={suggestions}
              selectedCell={selectedCell}
              sourceInfo={sourceInfo}
              syncing={syncing}
              onSelectCell={setSelectedCell}
              onOpenTask={openTask}
              onApplySuggestion={applySuggestion}
              onAlertSelect={handleAlertSelect}
              onRefresh={() => void syncSource()}
            />
          )}
          {view === "timelines" && (
            <TimelinesPage
              selectedProject={selectedProject}
              items={items}
              onProjectChange={setSelectedProject}
              onOpenTask={openTask}
            />
          )}
          {view === "planning" && (
            <PlanningPage
              items={items}
              changeCount={changes.length}
              busy={busy}
              dragTaskId={dragTaskId}
              onReset={() => void resetPlan()}
              onOpenTask={openTask}
              onDragStart={startDrag}
              onDragEnd={() => setDragTaskId(null)}
              onDrop={dropTask}
            />
          )}
          {view === "team" && <TeamPage items={items} availableHours={availableHours} />}
        </main>
      </div>

      {activeTask && (
        <TaskDialog
          task={activeTask}
          draftPerson={draftPerson}
          draftWeek={draftWeek}
          busy={busy}
          onDraftPersonChange={setDraftPerson}
          onDraftWeekChange={setDraftWeek}
          onClose={() => setTaskId(null)}
          onSave={() => void moveTask(activeTask.id, draftPerson, draftWeek)}
        />
      )}
      {notice && <NoticeToast message={notice} onClose={() => setNotice("")} />}
    </div>
  );
}
