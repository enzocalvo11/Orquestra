import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { planChanges } from "../../../db/schema";
import { people, weeks, workItems } from "../../../data/demo-data";

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

export async function DELETE() {
  try {
    const db = getDb();
    await db.delete(planChanges);
    return Response.json({ changes: [] });
  } catch {
    return Response.json({ error: "Não foi possível restaurar o plano inicial." }, { status: 500 });
  }
}
