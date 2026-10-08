import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { planChanges } from "../../../db/schema";
import { people, weeks, workItems, type PlanChange } from "../../../data/demo-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const changes = await getDb().select().from(planChanges);
    return Response.json({ changes });
  } catch {
    return Response.json({ error: "Não foi possível carregar o planejamento." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      taskId?: string; personId?: string; weekIndex?: number;
    };
    const task = workItems.find(item => item.id === body.taskId);
    const person = people.find(item => item.id === body.personId);
    if (!task || !person || !Number.isInteger(body.weekIndex) ||
      (body.weekIndex as number) < 0 || (body.weekIndex as number) >= weeks.length) {
      return Response.json({ error: "Tarefa, profissional ou período inválido." }, { status: 400 });
    }
    if (!person.skills.includes(task.skill)) {
      return Response.json({ error: `${person.name} não possui a habilidade indicada para esta atividade.` }, { status: 400 });
    }
    const weekIndex = body.weekIndex as number;
    const db = getDb();
    if (task.personId === person.id && task.week === weekIndex) {
      await db.delete(planChanges).where(eq(planChanges.taskId, task.id));
    } else {
      await db.insert(planChanges).values({
        taskId: task.id, personId: person.id, weekIndex,
        updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: planChanges.taskId,
        set: { personId: person.id, weekIndex, updatedAt: new Date().toISOString() },
      });
    }
    const changes = await db.select().from(planChanges);
    return Response.json({ changes });
  } catch {
    return Response.json({ error: "Não foi possível salvar a realocação." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { changes?: unknown };
    if (!Array.isArray(body.changes)) {
      return Response.json({ error: "A lista de alterações é inválida." }, { status: 400 });
    }

    const requestedChanges: PlanChange[] = [];
    const seenTaskIds = new Set<string>();
    for (const entry of body.changes) {
      if (!entry || typeof entry !== "object") {
        return Response.json({ error: "Há uma alteração inválida no planejamento." }, { status: 400 });
      }

      const change = entry as Partial<PlanChange>;
      const task = workItems.find(item => item.id === change.taskId);
      const person = people.find(item => item.id === change.personId);
      if (!task || !person || !Number.isInteger(change.weekIndex) ||
        (change.weekIndex as number) < 0 || (change.weekIndex as number) >= weeks.length ||
        seenTaskIds.has(task.id)) {
        return Response.json({ error: "Tarefa, profissional ou período inválido." }, { status: 400 });
      }
      if (!person.skills.includes(task.skill)) {
        return Response.json({ error: `${person.name} não possui a habilidade indicada para esta atividade.` }, { status: 400 });
      }

      seenTaskIds.add(task.id);
      requestedChanges.push({ taskId: task.id, personId: person.id, weekIndex: change.weekIndex as number });
    }

    const changesToSave = requestedChanges.filter(change => {
      const task = workItems.find(item => item.id === change.taskId)!;
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
    return Response.json({ changes });
  } catch {
    return Response.json({ error: "Não foi possível salvar todas as alterações." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const db = getDb();
    await db.delete(planChanges);
    return Response.json({ changes: [] });
  } catch {
    return Response.json({ error: "Não foi possível restaurar o plano inicial." }, { status: 500 });
  }
}
