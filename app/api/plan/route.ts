import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { planChanges } from "../../../db/schema";
import { weeks, type PlanChange, type PlanningTransition } from "../../../data/demo-data";
import { getAzureSource } from "../../../lib/azure-devops";
import { skillMismatchMessage } from "../../../lib/planning";
import { notifyPlanningChanges } from "../../../lib/planning-notifications";

export const dynamic = "force-dynamic";

async function getPlanningSource() {
  const { AZURE_DEVOPS_ORGANIZATION, AZURE_DEVOPS_PROJECT, AZURE_DEVOPS_PAT } = env as typeof env & {
    AZURE_DEVOPS_ORGANIZATION?: string;
    AZURE_DEVOPS_PROJECT?: string;
    AZURE_DEVOPS_PAT?: string;
  };
  if (!AZURE_DEVOPS_ORGANIZATION || !AZURE_DEVOPS_PROJECT || !AZURE_DEVOPS_PAT) {
    throw new Error("Azure DevOps is not configured.");
  }
  return getAzureSource({
    organization: AZURE_DEVOPS_ORGANIZATION,
    project: AZURE_DEVOPS_PROJECT,
    pat: AZURE_DEVOPS_PAT,
  });
}

function parsePlanningTransitions(
  value: unknown,
  requestedChanges: PlanChange[],
  source: Awaited<ReturnType<typeof getPlanningSource>>,
): PlanningTransition[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const requestedByTask = new Map(requestedChanges.map(change => [change.taskId, change]));
  const seenTaskIds = new Set<string>();
  const transitions: PlanningTransition[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const transition = entry as Partial<PlanningTransition>;
    const task = source.workItems.find(item => item.id === transition.taskId);
    const previousPerson = source.people.find(person => person.id === transition.previousPersonId);
    const nextPerson = source.people.find(person => person.id === transition.nextPersonId);
    const requested = task ? requestedByTask.get(task.id) : undefined;
    const expectedPersonId = requested?.personId ?? task?.personId;
    const expectedWeekIndex = requested?.weekIndex ?? task?.week;

    if (!task || !previousPerson || !nextPerson || seenTaskIds.has(task.id) ||
      !Number.isInteger(transition.previousWeekIndex) ||
      !Number.isInteger(transition.nextWeekIndex) ||
      (transition.previousWeekIndex as number) < 0 ||
      (transition.previousWeekIndex as number) >= weeks.length ||
      transition.nextPersonId !== expectedPersonId ||
      transition.nextWeekIndex !== expectedWeekIndex ||
      (transition.previousPersonId === transition.nextPersonId &&
        transition.previousWeekIndex === transition.nextWeekIndex)) {
      return null;
    }

    seenTaskIds.add(task.id);
    transitions.push({
      taskId: task.id,
      previousPersonId: previousPerson.id,
      previousWeekIndex: transition.previousWeekIndex as number,
      nextPersonId: nextPerson.id,
      nextWeekIndex: transition.nextWeekIndex as number,
    });
  }

  return transitions;
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { changes?: unknown; notificationChanges?: unknown };
    if (!Array.isArray(body.changes)) {
      return Response.json({ error: "A lista de alterações é inválida." }, { status: 400 });
    }

    const requestedChanges: PlanChange[] = [];
    const seenTaskIds = new Set<string>();
    const source = await getPlanningSource();
    for (const entry of body.changes) {
      if (!entry || typeof entry !== "object") {
        return Response.json({ error: "Há uma alteração inválida no planejamento." }, { status: 400 });
      }

      const change = entry as Partial<PlanChange>;
      const task = source.workItems.find(item => item.id === change.taskId);
      const person = source.people.find(item => item.id === change.personId);
      if (!task || !person || !Number.isInteger(change.weekIndex) ||
        (change.weekIndex as number) < 0 || (change.weekIndex as number) >= weeks.length ||
        seenTaskIds.has(task.id)) {
        return Response.json({ error: "Tarefa, profissional ou período inválido." }, { status: 400 });
      }
      if (!person.skills.includes(task.skill)) {
        return Response.json({ error: skillMismatchMessage(person.name, task.skill) }, { status: 400 });
      }

      seenTaskIds.add(task.id);
      requestedChanges.push({ taskId: task.id, personId: person.id, weekIndex: change.weekIndex as number });
    }

    const transitions = parsePlanningTransitions(body.notificationChanges, requestedChanges, source);
    if (!transitions) {
      return Response.json({ error: "As informações das notificações são inválidas." }, { status: 400 });
    }

    const changesToSave = requestedChanges.filter(change => {
      const task = source.workItems.find(item => item.id === change.taskId)!;
      return task.personId !== change.personId || task.week !== change.weekIndex;
    });
    const db = getDb();
    const existingChanges = await db.select().from(planChanges);
    const existingByTask = new Map(existingChanges.map(change => [change.taskId, change]));
    const updatedAt = new Date().toISOString();
    const statements = [
      db.delete(planChanges),
      ...changesToSave.map(change => {
        const existing = existingByTask.get(change.taskId);
        const unchanged = existing !== undefined &&
          existing.personId === change.personId && existing.weekIndex === change.weekIndex;
        return db.insert(planChanges).values({
          ...change,
          updatedAt: unchanged ? existing.updatedAt : updatedAt,
        });
      }),
    ] as const;

    await db.batch(statements);
    const changes = await db.select().from(planChanges);
    const notification = await notifyPlanningChanges({ source, planChanges: changes, transitions });
    return Response.json({ changes, notification });
  } catch {
    return Response.json({ error: "Não foi possível salvar todas as alterações." }, { status: 500 });
  }
}
