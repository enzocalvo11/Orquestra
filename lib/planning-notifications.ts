import { env } from "cloudflare:workers";
import { inArray } from "drizzle-orm";
import {
  weeks,
  type Person,
  type PlanChange,
  type PlanningNotificationResult,
  type PlanningTransition,
  type Project,
  type WorkItem,
  type WorkStatus,
} from "../data/demo-data";
import { getDb } from "../db";
import { employeeContacts } from "../db/schema";
import type { AzureSourceData } from "./azure-devops";
import { sendEmail, type TransactionalEmail } from "./email";

interface BuildPlanningEmailInput {
  email: string;
  person: Person;
  projects: Project[];
  workItems: WorkItem[];
  planChanges: PlanChange[];
  transitions: PlanningTransition[];
  people: Person[];
}

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const statusTheme: Record<WorkStatus, { background: string; color: string }> = {
  Pendente: { background: "#fff4dd", color: "#8a5a00" },
  "Em andamento": { background: "#e8f2ff", color: "#2867a0" },
  Concluído: { background: "#e8f7f0", color: "#277a57" },
};

const safeColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : "#159e9b";

const pluralize = (value: number, singular: string, plural: string) =>
  `${value} ${value === 1 ? singular : plural}`;

function describeTransition(
  transition: PlanningTransition,
  personId: string,
  tasksById: Map<string, WorkItem>,
  peopleById: Map<string, Person>,
): string {
  const task = tasksById.get(transition.taskId);
  const title = task?.title ?? transition.taskId;
  const previousWeek = weeks[transition.previousWeekIndex]?.label ?? "período anterior";
  const nextWeek = weeks[transition.nextWeekIndex]?.label ?? "novo período";

  if (transition.previousPersonId === personId && transition.nextPersonId === personId) {
    return `${title}: movida de ${previousWeek} para ${nextWeek}.`;
  }
  if (transition.nextPersonId === personId) {
    const previousPerson = peopleById.get(transition.previousPersonId)?.name ?? "outro responsável";
    return `${title}: adicionada em ${nextWeek}; antes estava com ${previousPerson}.`;
  }

  const nextPerson = peopleById.get(transition.nextPersonId)?.name ?? "outro responsável";
  return `${title}: retirada da sua agenda e realocada para ${nextPerson}, em ${nextWeek}.`;
}

function transitionLabel(transition: PlanningTransition, personId: string): string {
  if (transition.previousPersonId === personId && transition.nextPersonId === personId) {
    return "PERÍODO ALTERADO";
  }
  return transition.nextPersonId === personId ? "ATIVIDADE RECEBIDA" : "ATIVIDADE REALOCADA";
}

function buildPlanningEmail(input: BuildPlanningEmailInput): TransactionalEmail {
  const changesByTask = new Map(input.planChanges.map(change => [change.taskId, change]));
  const projectsById = new Map(input.projects.map(project => [project.id, project]));
  const tasksById = new Map(input.workItems.map(task => [task.id, task]));
  const peopleById = new Map(input.people.map(person => [person.id, person]));
  const personTasks = input.workItems
    .filter(task => task.personId === input.person.id)
    .map(task => ({ ...task, plannedWeek: changesByTask.get(task.id)?.weekIndex ?? task.week }))
    .sort((left, right) => left.plannedWeek - right.plannedWeek || left.title.localeCompare(right.title, "pt-BR"));
  const relevantTransitions = input.transitions.filter(transition =>
    transition.previousPersonId === input.person.id || transition.nextPersonId === input.person.id,
  );
  const transitionDescriptions = relevantTransitions.map(transition =>
    describeTransition(transition, input.person.id, tasksById, peopleById),
  );
  const totalHours = personTasks.reduce((sum, task) => sum + task.hours, 0);
  const summary = `${pluralize(relevantTransitions.length, "alteração", "alterações")}, ${pluralize(personTasks.length, "atividade", "atividades")} e ${totalHours}h planejadas.`;

  const textSchedule = weeks.map((week, weekIndex) => {
    const tasks = personTasks.filter(task => task.plannedWeek === weekIndex);
    if (!tasks.length) return `${week.label}: nenhuma atividade planejada.`;
    const total = tasks.reduce((sum, task) => sum + task.hours, 0);
    const lines = tasks.map(task => {
      const project = projectsById.get(task.projectId)?.name ?? "Projeto não identificado";
      return `- ${task.title} | ${project} | ${task.hours}h | ${task.status} | prazo: ${weeks[task.dueWeek]?.label ?? "não informado"}`;
    });
    return `${week.label} (${total}h):\n${lines.join("\n")}`;
  });

  const htmlSchedule = weeks.map((week, weekIndex) => {
    const tasks = personTasks.filter(task => task.plannedWeek === weekIndex);
    const total = tasks.reduce((sum, task) => sum + task.hours, 0);
    const taskRows = tasks.length
      ? tasks.map((task, taskIndex) => {
          const project = projectsById.get(task.projectId)?.name ?? "Projeto não identificado";
          const projectColor = safeColor(projectsById.get(task.projectId)?.color ?? "");
          const dueWeek = weeks[task.dueWeek]?.label ?? "não informado";
          const theme = statusTheme[task.status];
          return `<tr><td width="4" bgcolor="${projectColor}" style="width:4px;background:${projectColor};${taskIndex ? "border-top:1px solid #e8edf2;" : ""}">&nbsp;</td><td style="padding:16px 18px;${taskIndex ? "border-top:1px solid #e8edf2;" : ""}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td valign="top" style="padding-right:12px"><div style="font-size:15px;line-height:21px;font-weight:700;color:#1d2f45">${escapeHtml(task.title)}</div><div style="font-size:12px;line-height:18px;color:#6f7e90;margin-top:3px">${escapeHtml(project)}</div></td><td width="52" align="right" valign="top" style="font-size:15px;line-height:21px;font-weight:700;color:#1d2f45;white-space:nowrap">${task.hours}h</td></tr></table><div style="margin-top:10px"><span style="display:inline-block;background:${theme.background};color:${theme.color};border-radius:999px;padding:4px 9px;font-size:11px;font-weight:700;line-height:14px">${escapeHtml(task.status)}</span><span style="display:inline-block;color:#6f7e90;font-size:11px;line-height:18px;margin-left:8px">Prazo: ${escapeHtml(dueWeek)}</span></div></td></tr>`;
        }).join("")
      : '<tr><td style="padding:17px 18px;color:#8491a1;font-size:13px;line-height:20px">Sem atividades planejadas para este período.</td></tr>';
    const weekSummary = tasks.length
      ? `${pluralize(tasks.length, "atividade", "atividades")} · ${total}h`
      : "Agenda livre";
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #dfe6ed;border-collapse:separate;border-spacing:0;border-radius:10px;margin:0 0 14px;overflow:hidden"><tr><td bgcolor="#f6f8fa" style="background:#f6f8fa;padding:13px 18px;border-bottom:1px solid #dfe6ed"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="font-size:14px;line-height:20px;font-weight:700;color:#20344b">${escapeHtml(week.label)}</td><td align="right" style="font-size:12px;line-height:20px;color:#68788b">${escapeHtml(weekSummary)}</td></tr></table></td></tr><tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${taskRows}</table></td></tr></table>`;
  }).join("");

  const changesHtml = relevantTransitions
    .map((transition, index) => `<tr><td width="34" valign="top" style="padding:${index ? "14px" : "0"} 10px ${index === relevantTransitions.length - 1 ? "0" : "14px"} 0;${index ? "border-top:1px solid #cfe7e3;" : ""}"><div style="width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;background:#159e9b;color:#ffffff;font-size:13px;font-weight:700">${index + 1}</div></td><td valign="top" style="padding:${index ? "14px" : "0"} 0 ${index === relevantTransitions.length - 1 ? "0" : "14px"};${index ? "border-top:1px solid #cfe7e3;" : ""}"><div style="font-size:10px;line-height:15px;font-weight:800;letter-spacing:.08em;color:#118783">${transitionLabel(transition, input.person.id)}</div><div style="font-size:13px;line-height:20px;color:#2e465c;margin-top:3px">${escapeHtml(describeTransition(transition, input.person.id, tasksById, peopleById))}</div></td></tr>`)
    .join("");

  const statCell = (value: string, label: string, addBorder = false) =>
    `<td width="33.33%" align="center" style="padding:14px 8px;${addBorder ? "border-left:1px solid #dfe6ed;" : ""}"><div style="font-size:20px;line-height:24px;font-weight:800;color:#20344b">${escapeHtml(value)}</div><div style="font-size:10px;line-height:15px;color:#748397;text-transform:uppercase;letter-spacing:.06em;margin-top:3px">${escapeHtml(label)}</div></td>`;

  return {
    to: input.email,
    subject: "Orquestra | Sua agenda foi atualizada",
    text: [
      `Olá, ${input.person.name}.`,
      "Seu planejamento foi atualizado na Orquestra.",
      summary,
      "",
      "O que mudou:",
      ...transitionDescriptions.map(description => `- ${description}`),
      "",
      "Como ficou sua agenda:",
      ...textSchedule,
      "",
      "Esta é uma notificação automática do protótipo Orquestra.",
    ].join("\n"),
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sua agenda foi atualizada</title></head><body style="margin:0;padding:0;background:#f1f4f7;font-family:Arial,Helvetica,sans-serif;color:#20344b"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(summary)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f4f7" style="width:100%;background:#f1f4f7"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #dce4ec;border-collapse:separate;border-spacing:0;border-radius:14px;overflow:hidden"><tr><td bgcolor="#17243b" style="background:#17243b;padding:28px 32px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="color:#54d2c8;font-size:12px;line-height:18px;font-weight:800;letter-spacing:.13em">ORQUESTRA</td><td align="right"><span style="display:inline-block;border:1px solid #41516a;border-radius:999px;padding:5px 10px;color:#c9d4e2;font-size:10px;line-height:14px;font-weight:700;letter-spacing:.05em">ATUALIZAÇÃO DE AGENDA</span></td></tr></table><h1 style="font-size:26px;line-height:33px;margin:18px 0 7px;color:#ffffff;font-weight:750">Sua agenda foi atualizada</h1><p style="font-size:13px;line-height:20px;margin:0;color:#b8c5d5">${escapeHtml(input.person.role)} · ${escapeHtml(input.person.squad)}</p></td></tr><tr><td style="padding:30px 32px 10px"><p style="font-size:15px;line-height:24px;margin:0;color:#2b4056">Olá, <strong>${escapeHtml(input.person.name)}</strong>.</p><p style="font-size:14px;line-height:22px;margin:7px 0 20px;color:#607286">O planejamento foi recalculado. Confira abaixo o que mudou e como ficaram suas próximas semanas.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #dfe6ed;border-collapse:separate;border-spacing:0;border-radius:10px;background:#f8fafb"><tr>${statCell(String(relevantTransitions.length), relevantTransitions.length === 1 ? "alteração" : "alterações")}${statCell(String(personTasks.length), personTasks.length === 1 ? "atividade" : "atividades", true)}${statCell(`${totalHours}h`, "planejadas", true)}</tr></table><h2 style="font-size:17px;line-height:24px;margin:28px 0 12px;color:#20344b">O que mudou</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#edf8f6" style="width:100%;background:#edf8f6;border:1px solid #cfe7e3;border-collapse:separate;border-spacing:0;border-radius:10px"><tr><td style="padding:17px 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${changesHtml}</table></td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding-top:30px"><h2 style="font-size:17px;line-height:24px;margin:0;color:#20344b">Como ficou sua agenda</h2><p style="font-size:12px;line-height:18px;margin:5px 0 16px;color:#748397">Atividades agrupadas por período, com carga, status e prazo.</p></td></tr></table>${htmlSchedule}</td></tr><tr><td bgcolor="#f7f9fb" style="background:#f7f9fb;border-top:1px solid #e3e9ef;padding:20px 32px"><p style="font-size:11px;line-height:18px;margin:0;color:#7c8998">Esta é uma notificação automática do protótipo Orquestra. Em caso de dúvida, converse com o gestor responsável pelo planejamento.</p></td></tr></table></td></tr></table></body></html>`,
  };
}

export async function notifyPlanningChanges(input: {
  source: AzureSourceData;
  planChanges: PlanChange[];
  transitions: PlanningTransition[];
}): Promise<PlanningNotificationResult> {
  const recipientIds = [...new Set(input.transitions.flatMap(transition => [
    transition.previousPersonId,
    transition.nextPersonId,
  ]))].filter(personId => personId !== "sem-responsavel");

  if (!recipientIds.length) {
    return { status: "not-requested", recipientCount: 0, sentCount: 0 };
  }

  let contacts: Array<{ personId: string; email: string }>;
  try {
    contacts = await getDb().select({
      personId: employeeContacts.personId,
      email: employeeContacts.email,
    }).from(employeeContacts).where(inArray(employeeContacts.personId, recipientIds));
  } catch {
    return { status: "failed", recipientCount: recipientIds.length, sentCount: 0 };
  }

  const runtimeEnv = env as typeof env & {
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
  };
  if (!runtimeEnv.RESEND_API_KEY?.trim() || !runtimeEnv.RESEND_FROM_EMAIL?.trim()) {
    return { status: "not-configured", recipientCount: recipientIds.length, sentCount: 0 };
  }

  const contactsByPerson = new Map(contacts.map(contact => [contact.personId, contact.email]));
  const messages = recipientIds.flatMap(personId => {
    const email = contactsByPerson.get(personId);
    const person = input.source.people.find(candidate => candidate.id === personId);
    if (!email || !person) return [];
    return [buildPlanningEmail({
      email,
      person,
      projects: input.source.projects,
      workItems: input.source.workItems,
      planChanges: input.planChanges,
      transitions: input.transitions,
      people: input.source.people,
    })];
  });

  const results = await Promise.all(messages.map(message => sendEmail({
    apiKey: runtimeEnv.RESEND_API_KEY,
    from: runtimeEnv.RESEND_FROM_EMAIL,
  }, message)));
  const sentCount = results.filter(result => result.status === "sent").length;

  return {
    status: sentCount === recipientIds.length
      ? "sent"
      : sentCount > 0 ? "partial" : "failed",
    recipientCount: recipientIds.length,
    sentCount,
  };
}
