"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { NoticeToast } from "../../components/feedback/NoticeToast";
import { Sidebar } from "../../components/layout/Sidebar";
import { Topbar } from "../../components/layout/Topbar";
import {
  replaceAzureSource,
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
  overviewPeriod,
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

interface AzureAssignmentResponse {
  error?: string;
  workItem?: AzureWorkItemSnapshot;
}

function getPlanChangeCount(saved: PlanChange[], draft: PlanChange[]): number {
  const savedByTask = new Map(saved.map((change) => [change.taskId, change]));
  const draftByTask = new Map(draft.map((change) => [change.taskId, change]));
  const taskIds = new Set([...savedByTask.keys(), ...draftByTask.keys()]);

  return [...taskIds].filter((taskId) => {
    const savedChange = savedByTask.get(taskId);
    const draftChange = draftByTask.get(taskId);
    return savedChange?.personId !== draftChange?.personId || savedChange?.weekIndex !== draftChange?.weekIndex;
  }).length;
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
  const [selectedCell, setSelectedCell] = useState<CapacitySelection>(() => ({ personId: "ana", week: overviewPeriod().week }));
  const [taskId, setTaskId] = useState<string | null>(null);
  const [draftPerson, setDraftPerson] = useState("ana");
  const [draftWeek, setDraftWeek] = useState(0);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [sourceError, setSourceError] = useState("");
  const [notice, setNotice] = useState("");

  const activeChanges = view === "planning" ? draftChanges : changes;
  const items = useMemo(() => plannedItems(
    activeChanges,
    sourceInfo?.workItems ?? [],
    changes,
  ), [activeChanges, changes, sourceInfo]);
  const loads = useMemo(() => allLoads(items), [items]);
  const alerts = useMemo(() => getAlerts(items), [items]);
  const suggestions = useMemo(() => getSuggestions(items), [items]);
  const activeTask = taskId ? items.find((task) => task.id === taskId) : undefined;
  const pendingChangeCount = getPlanChangeCount(changes, draftChanges);
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
    setDraftPerson(task.plannedPersonId);
    setDraftWeek(task.plannedWeek);
  }

  async function moveTask(id: string, personId: string, weekIndex: number) {
    if (busy) return;

    const task = items.find((item) => item.id === id);
    if (!task) return;

    const person = getPerson(personId);
    if (!person?.skills.includes(task.skill)) {
      setNotice(skillMismatchMessage(person?.name ?? "Este profissional", task.skill));
      return;
    }

    if (task.plannedPersonId === personId && task.plannedWeek === weekIndex) {
      setTaskId(null);
      return;
    }

    setBusy(true);
    try {
      if (task.personId !== personId) {
        if (!Number.isSafeInteger(task.externalId) || task.externalId <= 0) {
          throw new Error("Esta tarefa não tem um ID do Azure DevOps válido.");
        }
        await updateAzureResponsible(task.externalId, personId);
        if (!(await syncSource(true))) {
          throw new Error("A tag foi atualizada no Azure DevOps, mas não foi possível recarregar os Work Items. Atualize a lista antes de continuar.");
        }
      }

      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: id,
          personId,
          weekIndex,
          notificationChanges: [{
            taskId: id,
            previousPersonId: task.plannedPersonId,
            previousWeekIndex: task.plannedWeek,
            nextPersonId: personId,
            nextWeekIndex: weekIndex,
          } satisfies PlanningTransition],
        }),
      });
      const data = await response.json() as PlanApiResponse;

      if (!response.ok) throw new Error(data.error ?? "Falha ao salvar.");
      if (!Array.isArray(data.changes)) {
        throw new Error("A realocação não foi confirmada pelo servidor. Tente novamente.");
      }

      const savedChange = data.changes.find((change) => change.taskId === id);
      const savedPersonId = savedChange?.personId ?? personId;
      const savedWeekIndex = savedChange?.weekIndex ?? task.week;
      if (savedPersonId !== personId || savedWeekIndex !== weekIndex) {
        throw new Error("O destino solicitado não foi gravado. Tente novamente.");
      }

      setChanges(data.changes);
      setDraftChanges(data.changes);
      setShowSavedIndicator(false);
      setSelectedCell({ personId, week: weekIndex });
      setNotice(savedNotice(`${task.title} realocada. A capacidade foi recalculada.`, data.notification));
      setTaskId(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar a mudança.");
    } finally {
      setBusy(false);
      setDragTaskId(null);
    }
  }

  function stageTaskMove(id: string, personId: string, weekIndex: number) {
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

    if (task.plannedPersonId === personId && task.plannedWeek === weekIndex) {
      setTaskId(null);
      return;
    }

    const originalTask = sourceInfo?.workItems.find((item) => item.id === id);
    if (!originalTask) return;

    const nextChanges = draftChanges.filter((change) => change.taskId !== id);
    if (originalTask.personId !== personId || originalTask.week !== weekIndex) {
      nextChanges.push({ taskId: id, personId, weekIndex });
    }

    setDraftChanges(nextChanges);
    setShowSavedIndicator(false);
    setSelectedCell({ personId, week: weekIndex });
    setNotice(`${task.title} adicionada às alterações pendentes.`);
    setTaskId(null);
  }

  function cancelPlanChanges() {
    if (!hasPendingChanges || busy) return;
    setDraftChanges(changes);
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
      const assignments = draftChanges.flatMap((change) => {
        const item = sourceByTask.get(change.taskId);
        const currentPersonId = item?.personId;
        return item && currentPersonId !== change.personId
          ? [{ item, personId: change.personId }]
          : [];
      });

      for (const { item, personId } of assignments) {
        await updateAzureResponsible(item.externalId, personId);
      }
      let currentWorkItems = sourceItems;
      if (assignments.length) {
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
      setShowSavedIndicator(true);
      setNotice(savedNotice("Todas as alterações foram salvas.", data.notification));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar as alterações.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPlan() {
    if (!changes.length || busy) return;

    setBusy(true);
    try {
      const response = await fetch("/api/plan", { method: "DELETE" });
      const data = await response.json() as PlanApiResponse;
      if (!response.ok) throw new Error(data.error);

      setChanges([]);
      setDraftChanges([]);
      setShowSavedIndicator(false);
      setNotice(savedNotice("Planejamento original restaurado.", data.notification));
    } catch {
      setNotice("Não foi possível restaurar o planejamento.");
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
      if (!silent) setNotice(`${data.workItemCount} Work Items atualizados do Azure DevOps.`);
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

  async function updateAzureResponsible(workItemId: number, personId: string): Promise<AzureWorkItemSnapshot> {
    const response = await fetch("/api/azure-devops/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workItemId, personId }),
    });
    const data = await response.json() as AzureAssignmentResponse;
    if (!response.ok || !data.workItem) {
      throw new Error(data.error ?? "Não foi possível confirmar as tags no Azure DevOps.");
    }
    const expectedTag = `responsavel:${personId}`.toLowerCase();
    if (!data.workItem.tags.some((tag) => tag.toLowerCase() === expectedTag)) {
      throw new Error("O Azure DevOps não confirmou a tag do responsável após a atualização.");
    }
    return data.workItem;
  }

  useEffect(() => {
    void syncSource();
  }, [syncSource]);

  function startDrag(event: DragEvent<HTMLElement>, id: string) {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDragTaskId(id);
  }

  function dropTask(event: DragEvent<HTMLElement>, personId: string, weekIndex: number) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragTaskId;
    // The dragged card may unmount after the move, so its dragend never fires.
    setDragTaskId(null);
    if (id) stageTaskMove(id, personId, weekIndex);
  }

  function changeView(nextView: DashboardView) {
    if (view === "planning" && nextView !== "planning" && hasPendingChanges) {
      setNotice("Salve ou cancele as alterações pendentes antes de sair do Planejamento.");
      return;
    }
    setView(nextView);
  }

  function handleAlertSelect(alert: (typeof alerts)[number]) {
    setSelectedCell({ personId: alert.personId, week: alert.week });
    if (alert.taskId) openTask(alert.taskId);
    else document.getElementById("overview-capacity-detail")?.scrollIntoView({
      behavior: "smooth", block: "nearest",
    });
  }

  function applySuggestion(suggestion: Suggestion) {
    openTask(suggestion.taskId);
    setDraftPerson(suggestion.toPersonId);
    setDraftWeek(suggestion.toWeek);
  }

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        highAlertCount={highAlertCount}
        onViewChange={changeView}
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
              sourceError={sourceError}
              syncing={syncing}
              onSelectCell={setSelectedCell}
              onOpenTask={openTask}
              onApplySuggestion={applySuggestion}
              onAlertSelect={handleAlertSelect}
              onRefresh={() => void syncSource()}
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
              changeCount={changes.length}
              pendingChangeCount={pendingChangeCount}
              hasPendingChanges={hasPendingChanges}
              showSavedIndicator={showSavedIndicator}
              busy={busy}
              dragTaskId={dragTaskId}
              onReset={() => void resetPlan()}
              onCancelChanges={cancelPlanChanges}
              onSaveChanges={() => void savePlanChanges()}
              onOpenTask={openTask}
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
          draftPerson={draftPerson}
          draftWeek={draftWeek}
          busy={busy}
          deferSave={view === "planning"}
          onDraftPersonChange={setDraftPerson}
          onDraftWeekChange={setDraftWeek}
          onClose={() => setTaskId(null)}
          onSave={() => void (view === "planning"
            ? stageTaskMove(activeTask.id, draftPerson, draftWeek)
            : moveTask(activeTask.id, draftPerson, draftWeek))}
        />
      )}
      {notice && <NoticeToast message={notice} onClose={() => setNotice("")} />}
    </div>
  );
}
