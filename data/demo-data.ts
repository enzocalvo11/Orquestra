export type Skill = "frontend" | "backend" | "qa" | "design";
type WorkType = "Task" | "Bug" | "Test";
export type WorkStatus = "Pendente" | "Em andamento" | "Concluído";
type Priority = "Alta" | "Média" | "Baixa";

export interface Person {
  id: string; name: string; role: string; squad: string;
  weeklyHours: number; skills: Skill[]; color: string;
}
export const UNASSIGNED_PERSON_ID = "sem-responsavel";
export interface Project {
  id: string; name: string; product: string; description: string; color: string;
}
export interface WorkItem {
  id: string; externalId: number; projectId: string; feature: string; pbi: string;
  title: string; type: WorkType; status: WorkStatus; personId: string;
  week: number; dueWeek: number; hours: number; skill: Skill;
  priority: Priority; description: string;
}
export interface PlanChange {
  taskId: string; personId: string; weekIndex: number;
}
export interface PlanningTransition {
  taskId: string;
  previousPersonId: string;
  previousWeekIndex: number;
  nextPersonId: string;
  nextWeekIndex: number;
}
export interface PlanningNotificationResult {
  status: "sent" | "partial" | "failed" | "not-configured" | "not-requested";
  recipientCount: number;
  sentCount: number;
}

export const weeks = [
  { label: "05–11 out", short: "05 out", range: "5 a 11 de outubro", start: "2026-10-05", end: "2026-10-11" },
  { label: "12–18 out", short: "12 out", range: "12 a 18 de outubro", start: "2026-10-12", end: "2026-10-18" },
  { label: "19–25 out", short: "19 out", range: "19 a 25 de outubro", start: "2026-10-19", end: "2026-10-25" },
  { label: "26 out–01 nov", short: "26 out", range: "26 de outubro a 1º de novembro", start: "2026-10-26", end: "2026-11-01" },
];
export const holidayDays = [0, 1, 0, 0];
export const absences: Record<string, Record<number, number>> = {
  ana: { 0: 8 }, elisa: { 1: 6 }, bruno: { 2: 8 },
};

export const internalPeople: Person[] = [
  { id: "ana", name: "Ana Costa", role: "Desenvolvedora frontend", squad: "Produto", weeklyHours: 40, skills: ["frontend", "design"], color: "#815dec" },
  { id: "bruno", name: "Bruno Lima", role: "Desenvolvedor frontend", squad: "Produto", weeklyHours: 40, skills: ["frontend"], color: "#e9a447" },
  { id: "carla", name: "Carla Mendes", role: "Desenvolvedora backend", squad: "Integrações", weeklyHours: 40, skills: ["backend"], color: "#e17390" },
  { id: "diego", name: "Diego Rocha", role: "Desenvolvedor backend", squad: "Integrações", weeklyHours: 40, skills: ["backend"], color: "#5eabdc" },
  { id: "elisa", name: "Elisa Martins", role: "Analista de qualidade", squad: "Produto", weeklyHours: 30, skills: ["qa"], color: "#78bb92" },
  { id: "fernanda", name: "Fernanda Alves", role: "Designer de produto", squad: "Produto", weeklyHours: 32, skills: ["design"], color: "#cb89bf" },
  { id: "gustavo", name: "Gustavo Silva", role: "Desenvolvedor full stack", squad: "Integrações", weeklyHours: 40, skills: ["frontend", "backend", "qa"], color: "#7c9cdb" },
];

export let people: Person[] = internalPeople;

export const supplementalProjects: Project[] = [
  { id: "agendamento", name: "Portal de Agendamento", product: "Suite Portuária", description: "Planejamento e reserva de janelas operacionais", color: "#8161d7" },
  { id: "terminais", name: "Integração de Terminais", product: "Suite Portuária", description: "Eventos e disponibilidade entre sistemas", color: "#239c97" },
  { id: "operacoes", name: "Visão Operacional", product: "Inteligência Operacional", description: "Indicadores e acompanhamento de operações", color: "#e3a14f" },
];

export let projects: Project[] = [];

type ItemTuple = [
  number, string, string, string, number, number, number, Skill,
  WorkType, string, string, Priority?, WorkStatus?,
];
const rows: ItemTuple[] = [
  [101,"agendamento","Interface do calendário","ana",0,1,20,"frontend","Task","Reserva de janelas","Calendário de reservas","Alta","Em andamento"],
  [102,"agendamento","Validação de horários","bruno",0,1,12,"frontend","Task","Reserva de janelas","Calendário de reservas"],
  [103,"agendamento","API de disponibilidade","carla",0,1,20,"backend","Task","Reserva de janelas","Consulta de disponibilidade","Alta","Em andamento"],
  [104,"agendamento","Autenticação de usuários","gustavo",1,2,12,"backend","Task","Acesso e permissões","Login seguro"],
  [105,"agendamento","Testes de reserva","elisa",1,2,10,"qa","Test","Reserva de janelas","Calendário de reservas"],
  [106,"agendamento","Correção de fuso horário","ana",1,1,8,"frontend","Bug","Reserva de janelas","Calendário de reservas","Alta"],
  [107,"agendamento","Regras para horários conflitantes","diego",2,3,16,"backend","Task","Reserva de janelas","Consulta de disponibilidade"],
  [108,"agendamento","Revisão da jornada","fernanda",3,3,14,"design","Task","Acesso e permissões","Login seguro","Baixa"],
  [109,"terminais","Painel de status das janelas","ana",0,1,20,"frontend","Task","Eventos de terminal","Acompanhamento de status","Alta"],
  [110,"terminais","Fila de eventos","diego",0,1,18,"backend","Task","Eventos de terminal","Recebimento de eventos","Alta"],
  [111,"terminais","Tratamento de webhooks","carla",0,1,20,"backend","Task","Eventos de terminal","Recebimento de eventos","Alta"],
  [112,"terminais","Contrato da API","gustavo",1,2,12,"backend","Task","Eventos de terminal","Recebimento de eventos"],
  [113,"terminais","Testes de conciliação","elisa",1,2,14,"qa","Test","Eventos de terminal","Acompanhamento de status","Alta"],
  [114,"terminais","Correção de eventos duplicados","carla",2,2,8,"backend","Bug","Eventos de terminal","Recebimento de eventos","Alta"],
  [115,"terminais","Tela de histórico","bruno",3,3,10,"frontend","Task","Eventos de terminal","Acompanhamento de status","Baixa"],
  [116,"operacoes","API de indicadores","carla",0,1,12,"backend","Task","Painel de indicadores","Visão executiva","Alta"],
  [117,"operacoes","Filtro por operação","bruno",0,1,10,"frontend","Task","Painel de indicadores","Visão executiva"],
  [118,"operacoes","Cards de indicadores","ana",1,2,8,"frontend","Task","Painel de indicadores","Visão executiva"],
  [119,"operacoes","Protótipo visual","fernanda",1,2,16,"design","Task","Painel de indicadores","Visão executiva"],
  [120,"operacoes","Exportação de dados","diego",2,3,12,"backend","Task","Painel de indicadores","Relatórios"],
  [121,"operacoes","Testes dos gráficos","elisa",3,3,12,"qa","Test","Painel de indicadores","Visão executiva"],
  [122,"operacoes","Serviço de priorização","gustavo",2,3,18,"backend","Task","Painel de indicadores","Relatórios"],
];

export const supplementalWorkItems: WorkItem[] = rows.map(([
  externalId, projectId, title, personId, week, dueWeek, hours, skill,
  type, feature, pbi, priority = "Média", status = "Pendente",
]) => ({
  id: `ADO-${externalId}`, externalId, projectId, title, personId, week,
  dueWeek, hours, skill, type, feature, pbi, priority, status,
  description: `${type === "Bug" ? "Corrigir" : type === "Test" ? "Validar" : "Implementar"} ${title.toLowerCase()} no contexto de ${pbi.toLowerCase()}. Item fictício estruturado como work item do Azure DevOps.`,
}));

export let workItems: WorkItem[] = [];

export function replaceAzureSource(source: {
  workItems: WorkItem[];
  projects: Project[];
  people: Person[];
}) {
  workItems = source.workItems;
  projects = source.projects;
  people = source.people;
}
