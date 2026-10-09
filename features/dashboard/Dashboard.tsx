"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { NoticeToast } from "../../components/feedback/NoticeToast";
import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import {
  replaceAzureSource,
  weeks,
  type PlanChange,
  type PlanningNotificationResult,
  type PlanningTransition,
} from "../../data/demo-data";
import { OverviewPage } from "../overview/OverviewPage";
import { PlanningPage } from "../planning/PlanningPage";
import { TaskDialog } from "../work-items/TaskDialog";
import type { AzureWorkItemSnapshot } from "../../lib/azure-devops";
import { TimelinesPage } from "../timelines/TimelinesPage";
import {
  allLoads,
  getAlerts,
  getPerson,
  getSuggestions,
  overviewWeek,
  plannedItems,
  skillMismatchMessage,
  type Suggestion,
} from "../../lib/planning";
import type { CapacitySelection, DashboardView, SourceInfo } from "./types";

interface DashboardProps {
  initialChanges: PlanChange[];
}

interface PlanApiResponse {
  error?: string;
  changes?: PlanChange[];
  notification?: PlanningNotificationResult;
}

interface AzurePlanningResponse {
  error?: string;
  workItem?: AzureWorkItemSnapshot;
}

function getPlanChangeCount(saved: PlanChange[], draft: PlanChange[], deadlineTaskIds: string[]): number {
  const savedByTask = new Map(saved.map((change) => [change.taskId, change]));
  const draftByTask = new Map(draft.map((change) => [change.taskId, change]));
  const taskIds = new Set([...savedByTask.keys(), ...draftByTask.keys()]);

  const changedTaskIds = new Set([...taskIds].filter((taskId) => {
    const savedChange = savedByTask.get(taskId);
    const draftChange = draftByTask.get(taskId);
    return savedChange?.personId !== draftChange?.personId || savedChange?.weekIndex !== draftChange?.weekIndex;
  }));
  deadlineTaskIds.forEach(taskId => changedTaskIds.add(taskId));
  return changedTaskIds.size;
}

function planChangesMatch(left: PlanChange[], right: PlanChange[]): boolean {
  if (left.length !== right.length) return false;
  const rightByTask = new Map(right.map((change) => [change.taskId, change]));
  return left.every((change) => {
    const match = rightByTask.get(change.taskId);
    return match?.personId === change.personId && match?.weekIndex === change.weekIndex;
  });
}

function planChangesNotRepresentedInAzure(changes: PlanChange[], workItems: SourceInfo["workItems"]): PlanChange[] {
  const sourceByTask = new Map(workItems.map((item) => [item.id, item]));
  return changes.filter((change) => {
    const item = sourceByTask.get(change.taskId);
    return !item || item.personId !== change.personId || item.week !== change.weekIndex;
  });
}

function getPlanningTransitions(
  savedChanges: PlanChange[],
  nextChanges: PlanChange[],
  workItems: SourceInfo["workItems"],
): PlanningTransition[] {
  const currentItems = plannedItems(savedChanges, workItems, savedChanges);
  const nextItems = plannedItems(nextChanges, workItems, savedChanges);
  const nextByTask = new Map(nextItems.map(item => [item.id, item]));

  return currentItems.flatMap((current): PlanningTransition[] => {
    const next = nextByTask.get(current.id);
    if (!next || (current.plannedPersonId === next.plannedPersonId && current.plannedWeek === next.plannedWeek)) {
      return [];
    }
    return [{
      taskId: current.id,
      previousPersonId: current.plannedPersonId,
      previousWeekIndex: current.plannedWeek,
      nextPersonId: next.plannedPersonId,
      nextWeekIndex: next.plannedWeek,
    }];
  });
}

function savedNotice(baseMessage: string, notification?: PlanningNotificationResult): string {
  if (!notification || notification.status === "not-requested") return baseMessage;
  if (notification.status === "sent") {
    const detail = notification.sentCount === 1
      ? "O colaborador foi notificado por e-mail."
      : `${notification.sentCount} colaboradores foram notificados por e-mail.`;
    return `${baseMessage} ${detail}`;
  }
  if (notification.status === "partial") {
    return `${baseMessage} ${notification.sentCount} de ${notification.recipientCount} notificações foram enviadas.`;
  }
  if (notification.status === "not-configured") {
    return `${baseMessage} O e-mail não foi enviado porque o serviço de notificações ainda não está configurado.`;
  }
  return `${baseMessage} Não foi possível enviar a notificação por e-mail.`;
}

export default function Dashboard({ initialChanges }: DashboardProps) {
  const [view, setView] = useState<DashboardView>("overview");
  const [changes, setChanges] = useState<PlanChange[]>(initialChanges);
  const [draftChanges, setDraftChanges] = useState<PlanChange[]>(initialChanges);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedCell, setSelectedCell] = useState<CapacitySelection>(() => ({ personId: "ana", week: overviewWeek() }));
  const [taskId, setTaskId] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [highlightedCell, setHighlightedCell] = useState<CapacitySelection | null>(null);
  const [highlightedCellKind, setHighlightedCellKind] = useState<"alert" | "recommendation" | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
  const [draftPerson, setDraftPerson] = useState("ana");
  const [draftWeek, setDraftWeek] = useState(0);
  const [draftDueWeek, setDraftDueWeek] = useState(0);
  const [draftDeadlineChanges, setDraftDeadlineChanges] = useState<Record<string, number>>({});
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [sourceError, setSourceError] = useState("");
  const [notice, setNotice] = useState("");

  const activeChanges = view === "planning" ? draftChanges : changes;
  const items = useMemo(() => {
    const planned = plannedItems(activeChanges, sourceInfo?.workItems ?? [], changes);
    if (view !== "planning") return planned;
    return planned.map(item => ({
      ...item,
      dueWeek: draftDeadlineChanges[item.id] ?? item.dueWeek,
    }));
  }, [activeChanges, changes, draftDeadlineChanges, sourceInfo, view]);
  const loads = useMemo(() => allLoads(items), [items]);
  const alerts = useMemo(() => getAlerts(items), [items]);
  const suggestions = useMemo(() => getSuggestions(items), [items]);
  const activeTask = taskId ? items.find((task) => task.id === taskId) : undefined;
  const pendingChangeCount = getPlanChangeCount(changes, draftChanges, Object.keys(draftDeadlineChanges));
  const hasPendingChanges = pendingChangeCount > 0;
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
    setActiveSuggestion(null);
    if (view === "planning") {
      setHighlightedTaskId(id);
      if (highlightedCellKind !== "recommendation") {
        setHighlightedCell(null);
        setHighlightedCellKind(null);
      }
    }
    setDraftPerson(task.plannedPersonId);
    setDraftWeek(task.plannedWeek);
    setDraftDueWeek(draftDeadlineChanges[id] ?? task.dueWeek);
  }

  function viewTaskInPlanning(id: string) {
    const task = items.find((item) => item.id === id);
    if (!task) return;
    const suggestion = activeSuggestion?.taskId === id ? activeSuggestion : null;
    setHighlightedTaskId(id);
    setHighlightedCell(suggestion ? { personId: suggestion.toPersonId, week: suggestion.toWeek } : null);
    setHighlightedCellKind(suggestion ? "recommendation" : null);
    if (suggestion) setSelectedCell({ personId: suggestion.toPersonId, week: suggestion.toWeek });
    setActiveSuggestion(null);
    setTaskId(null);
    setView("planning");
  }

  function stageTaskMove(id: string, personId: string, weekIndex: number, dueWeek: number) {
    if (busy) return;

    const task = items.find((item) => item.id === id);
    if (!task) return;

    if (personId === "sem-responsavel") {
      setNotice("Não é possível mover a atividade para \"Sem responsável\".");
      return;
    }

    const person = getPerson(personId);
    if (!person?.skills.includes(task.skill)) {
      setNotice(skillMismatchMessage(person?.name ?? "Este profissional", task.skill));
      return;
    }

    if (task.plannedPersonId === personId && task.plannedWeek === weekIndex && task.dueWeek === dueWeek) {
      setTaskId(null);
      return;
    }

    const originalTask = sourceInfo?.workItems.find((item) => item.id === id);
    if (!originalTask) return;

    const nextChanges = draftChanges.filter((change) => change.taskId !== id);
    setHighlightedTaskId(null);
    setHighlightedCell(null);
    setHighlightedCellKind(null);
    if (originalTask.personId !== personId || originalTask.week !== weekIndex) {
      nextChanges.push({ taskId: id, personId, weekIndex });
    }

    setDraftChanges(nextChanges);
    setDraftDeadlineChanges(current => {
      const next = { ...current };
      if (originalTask.dueWeek === dueWeek) delete next[id];
      else next[id] = dueWeek;
      return next;
    });
    setShowSavedIndicator(false);
    setSelectedCell({ personId, week: weekIndex });
    setNotice(`${task.title} adicionada às alterações pendentes.`);
    setTaskId(null);
  }

  function cancelPlanChanges() {
    if (!hasPendingChanges || busy) return;
    setDraftChanges(changes);
    setDraftDeadlineChanges({});
    setShowSavedIndicator(false);
    setTaskId(null);
    setNotice("Alterações canceladas. O planejamento voltou ao estado salvo.");
  }

  async function savePlanChanges() {
    if (!hasPendingChanges || busy) return;

    setBusy(true);
    try {
      const sourceItems = sourceInfo?.workItems ?? [];
      const notificationChanges = getPlanningTransitions(changes, draftChanges, sourceItems);
      const sourceByTask = new Map(sourceItems.map((item) => [item.id, item]));
      const azureUpdates = new Map<string, {
        item: SourceInfo["workItems"][number];
        personId?: string;
        dueWeek?: number;
      }>();
      for (const change of draftChanges) {
        const item = sourceByTask.get(change.taskId);
        if (item && item.personId !== change.personId) {
          azureUpdates.set(item.id, { item, personId: change.personId });
        }
      }
      for (const [taskId, dueWeek] of Object.entries(draftDeadlineChanges)) {
        const item = sourceByTask.get(taskId);
        if (!item || !weeks[dueWeek]) {
          throw new Error("Uma alteração de prazo não corresponde a um Work Item carregado.");
        }
        if (item.dueWeek !== dueWeek) {
          const current = azureUpdates.get(taskId);
          azureUpdates.set(taskId, { ...current, item, dueWeek });
        }
      }

      for (const { item, personId, dueWeek } of azureUpdates.values()) {
        await updateAzurePlanning(item.externalId, { personId, dueWeek });
      }
      let currentWorkItems = sourceItems;
      if (azureUpdates.size) {
        const refreshedSource = await syncSource(true);
        if (!refreshedSource) {
          throw new Error("As tags foram atualizadas no Azure DevOps, mas não foi possível recarregar os Work Items. Atualize a lista antes de salvar o planejamento.");
        }
        currentWorkItems = refreshedSource.workItems;
      }
      const expectedPlanChanges = planChangesNotRepresentedInAzure(draftChanges, currentWorkItems);

      const response = await fetch("/api/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: draftChanges, notificationChanges }),
      });
      const data = await response.json() as PlanApiResponse;

      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar as alterações.");
      if (!Array.isArray(data.changes) || !planChangesMatch(data.changes, expectedPlanChanges)) {
        throw new Error("O servidor não confirmou todas as alterações. Tente novamente.");
      }

      setChanges(data.changes);
      setDraftChanges(data.changes);
      setDraftDeadlineChanges({});
      setShowSavedIndicator(true);
      setNotice(savedNotice("Todas as alterações foram salvas.", data.notification));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar as alterações.");
    } finally {
      setBusy(false);
    }
  }

  const syncSource = useCallback(async (silent = false): Promise<SourceInfo | null> => {
    setSyncing(true);
    try {
      const response = await fetch("/api/source", { cache: "no-store" });
      const data = await response.json() as SourceInfo & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível consultar o Azure DevOps.");
      if (!Array.isArray(data.workItems) || !Array.isArray(data.projects) || !Array.isArray(data.people)) {
        throw new Error("A resposta do Azure DevOps está incompleta.");
      }
      replaceAzureSource(data);
      setSourceInfo(data);
      setSourceError("");
      if (!silent) setNotice(`${data.workItems.length} Work Items atualizados do Azure DevOps.`);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao consultar o Azure DevOps.";
      setSourceError(message);
      if (!silent) setNotice(message);
      return null;
    } finally {
      setSyncing(false);
    }
  }, []);

  async function updateAzurePlanning(
    workItemId: number,
    update: { personId?: string; dueWeek?: number },
  ): Promise<void> {
    const dueDate = update.dueWeek === undefined ? undefined : weeks[update.dueWeek]?.end;
    if (update.dueWeek !== undefined && !dueDate) {
      throw new Error("O prazo selecionado não pertence ao período disponível.");
    }
    const response = await fetch("/api/azure-devops/planning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workItemId, ...update }),
    });
    const data = await response.json() as AzurePlanningResponse;
    if (!response.ok || !data.workItem) {
      throw new Error(data.error ?? "Não foi possível confirmar as tags no Azure DevOps.");
    }
    const expectedTags = [
      update.personId === undefined ? undefined : `responsavel:${update.personId}`,
      dueDate === undefined ? undefined : `prazo:${dueDate}`,
    ].filter((tag): tag is string => tag !== undefined);
    if (expectedTags.some(expected =>
      !data.workItem!.tags.some(tag => tag.toLowerCase() === expected.toLowerCase()))) {
      throw new Error("O Azure DevOps não confirmou as tags do planejamento após a atualização.");
    }
  }

  useEffect(() => {
    void syncSource();
  }, [syncSource]);

  function startDrag(event: DragEvent<HTMLElement>, id: string) {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDragTaskId(id);
    setHighlightedTaskId(id);
    if (highlightedCellKind !== "recommendation") {
      setHighlightedCell(null);
      setHighlightedCellKind(null);
    }
  }

  function dropTask(event: DragEvent<HTMLElement>, personId: string, weekIndex: number) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragTaskId;
    // The dragged card may unmount after the move, so its dragend never fires.
    setDragTaskId(null);
    const task = id ? items.find(item => item.id === id) : undefined;
    if (task) stageTaskMove(task.id, personId, weekIndex, task.dueWeek);
  }

  function changeView(nextView: DashboardView) {
    if (view === "planning" && nextView !== "planning" && hasPendingChanges) {
      setNotice("Salve ou cancele as alterações pendentes antes de sair do Planejamento.");
      return;
    }
    if (view === "planning" && nextView !== "planning") {
      setHighlightedTaskId(null);
      setHighlightedCell(null);
      setHighlightedCellKind(null);
    }
    setView(nextView);
  }

  function focusAlertInPlanning(alert: (typeof alerts)[number]) {
    setSelectedCell({ personId: alert.personId, week: alert.week });
    if (alert.taskId) {
      setHighlightedTaskId(alert.taskId);
      setHighlightedCell(null);
      setHighlightedCellKind(null);
    } else {
      setHighlightedTaskId(null);
      setHighlightedCell({ personId: alert.personId, week: alert.week });
      setHighlightedCellKind("alert");
    }
    setTaskId(null);
    setActiveSuggestion(null);
    setView("planning");
  }

  function handleAlertSelect(alert: (typeof alerts)[number]) {
    if (alert.kind === "deadline" || alert.kind === "overload") {
      focusAlertInPlanning(alert);
      return;
    }
    if (alert.taskId) openTask(alert.taskId);
    else document.getElementById("overview-capacity-detail")?.scrollIntoView({
      behavior: "smooth", block: "nearest",
    });
  }

  function reviewSuggestion(suggestion: Suggestion) {
    const task = items.find((item) => item.id === suggestion.taskId);
    if (!task) return;
    setActiveSuggestion(suggestion);
    setTaskId(task.id);
    setDraftPerson(suggestion.toPersonId);
    setDraftWeek(suggestion.toWeek);
    setDraftDueWeek(draftDeadlineChanges[task.id] ?? task.dueWeek);
  }

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        highAlertCount={highAlertCount}
        sourceSyncedAt={sourceInfo?.syncedAt ?? null}
        sourceError={sourceError}
        syncing={syncing}
        onViewChange={changeView}
      />

      <div className="content-shell">
        <Topbar view={view} />
        <main className="main-content">
          {view === "overview" && (
            <OverviewPage
              items={items}
              loads={loads}
              alerts={alerts}
              suggestions={suggestions}
              selectedCell={selectedCell}
              onSelectCell={setSelectedCell}
              onOpenTask={openTask}
              onReviewSuggestion={reviewSuggestion}
              onAlertSelect={handleAlertSelect}
              onNavigatePlanning={() => setView("planning")}
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
              highlightedTaskId={highlightedTaskId}
              highlightedCell={highlightedCell}
              highlightedCellKind={highlightedCellKind}
              alerts={alerts}
              pendingChangeCount={pendingChangeCount}
              hasPendingChanges={hasPendingChanges}
              showSavedIndicator={showSavedIndicator}
              busy={busy}
              dragTaskId={dragTaskId}
              onCancelChanges={cancelPlanChanges}
              onSaveChanges={() => void savePlanChanges()}
              onOpenTask={openTask}
              onAlertSelect={focusAlertInPlanning}
              onDragStart={startDrag}
              onDragEnd={() => setDragTaskId(null)}
              onDrop={dropTask}
            />
          )}
        </main>
      </div>

      {activeTask && (
        <TaskDialog
          task={activeTask}
          items={items}
          suggestion={activeSuggestion?.taskId === activeTask.id ? activeSuggestion : undefined}
          draftPerson={draftPerson}
          draftWeek={draftWeek}
          draftDueWeek={draftDueWeek}
          busy={busy}
          deferSave={view === "planning"}
          onDraftPersonChange={setDraftPerson}
          onDraftWeekChange={setDraftWeek}
          onDraftDueWeekChange={setDraftDueWeek}
          onClose={() => { setTaskId(null); setActiveSuggestion(null); }}
          onSave={() => stageTaskMove(activeTask.id, draftPerson, draftWeek, draftDueWeek)}
          onViewInPlanning={viewTaskInPlanning}
        />
      )}
      {notice && <NoticeToast message={notice} onClose={() => setNotice("")} />}
    </div>
  );
}
