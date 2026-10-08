import {
  absences, holidayDays, people, projects, weeks, workItems,
  type Person, type PlanChange, type WorkItem,
} from "../data/demo-data";

export interface PlannedItem extends WorkItem {
  plannedPersonId: string;
  plannedWeek: number;
  isChanged: boolean;
}
export interface LoadCell {
  personId: string; week: number; planned: number; capacity: number;
  percent: number; projectIds: string[]; tasks: PlannedItem[];
}
export interface Alert {
  id: string; kind: "overload" | "deadline" | "absence";
  personId: string; week: number; title: string; detail: string;
  taskId?: string; severity: "high" | "medium";
}
export interface Suggestion {
  id: string; taskId: string; fromPersonId: string; toPersonId: string;
  fromWeek: number; toWeek: number; releasedHours: number; reason: string;
}

export const getPerson = (id: string) => people.find(p => p.id === id);
export const getProject = (id: string) => projects.find(p => p.id === id);

// The demonstration calendar is fixed in October 2026. Outside it, show the
// closest period and label it as a scenario period rather than "this week".
export function overviewPeriod(now = new Date()): { week: number; isCurrent: boolean } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  const week = weeks.findIndex(period => period.start <= date && date <= period.end);
  if (week >= 0) return { week, isCurrent: true };
  return { week: date < weeks[0].start ? 0 : weeks.length - 1, isCurrent: false };
}

export function plannedItems(changes: PlanChange[]): PlannedItem[] {
  const byTask = new Map(changes.map(change => [change.taskId, change]));
  return workItems.map(task => {
    const change = byTask.get(task.id);
    return {
      ...task,
      plannedPersonId: change?.personId ?? task.personId,
      plannedWeek: change?.weekIndex ?? task.week,
      isChanged: Boolean(change),
    };
  });
}

export function capacityFor(person: Person, week: number): number {
  const holidayHours = (person.weeklyHours / 5) * holidayDays[week];
  return Math.max(0, person.weeklyHours - holidayHours - (absences[person.id]?.[week] ?? 0));
}

export function loadFor(items: PlannedItem[], personId: string, week: number): LoadCell {
  const person = getPerson(personId)!;
  const tasks = items.filter(task =>
    task.plannedPersonId === personId && task.plannedWeek === week && task.status !== "Concluído",
  );
  const planned = tasks.reduce((sum, task) => sum + task.hours, 0);
  const capacity = capacityFor(person, week);
  return {
    personId, week, planned, capacity,
    percent: capacity === 0 ? (planned ? 999 : 0) : Math.round(planned / capacity * 100),
    projectIds: [...new Set(tasks.map(task => task.projectId))],
    tasks,
  };
}

export function allLoads(items: PlannedItem[]): LoadCell[] {
  return people.flatMap(person => weeks.map((_, week) => loadFor(items, person.id, week)));
}

export function getAlerts(items: PlannedItem[]): Alert[] {
  const alerts: Alert[] = [];
  for (const cell of allLoads(items)) {
    const person = getPerson(cell.personId)!;
    if (cell.planned > cell.capacity) {
      const sources = cell.projectIds.map(id => getProject(id)?.name).join(" + ");
      alerts.push({
        id: `load-${cell.personId}-${cell.week}`, kind: "overload",
        personId: cell.personId, week: cell.week, severity: "high",
        title: `${person.name} acima da capacidade`,
        detail: `${cell.planned}h planejadas para ${formatHours(cell.capacity)}h disponíveis · ${sources}`,
      });
    } else if (cell.tasks.length && (absences[cell.personId]?.[cell.week] ?? 0) > 0) {
      alerts.push({
        id: `absence-${cell.personId}-${cell.week}`, kind: "absence",
        personId: cell.personId, week: cell.week, severity: "medium",
        title: `Ausência de ${person.name}`,
        detail: `${absences[cell.personId][cell.week]}h de ausência reduzem a capacidade desta semana.`,
      });
    }
  }
  for (const task of items) {
    if (task.plannedWeek > task.dueWeek && task.status !== "Concluído") {
      alerts.push({
        id: `late-${task.id}`, kind: "deadline", taskId: task.id,
        personId: task.plannedPersonId, week: task.plannedWeek, severity: "high",
        title: `Prazo ultrapassado · ${task.title}`,
        detail: `Planejada para ${weeks[task.plannedWeek].label}, com prazo em ${weeks[task.dueWeek].label}.`,
      });
    }
  }
  return alerts.sort((a, b) => Number(b.severity === "high") - Number(a.severity === "high") || a.week - b.week);
}

export function getSuggestions(items: PlannedItem[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  for (const cell of allLoads(items).filter(c => c.planned > c.capacity)) {
    const excess = cell.planned - cell.capacity;
    const source = getPerson(cell.personId)!;
    const tasks = [...cell.tasks].sort((a, b) => Math.abs(a.hours - excess) - Math.abs(b.hours - excess));
    let chosen: Suggestion | null = null;
    for (const task of tasks) {
      const candidates = people
        .filter(person => person.id !== source.id && person.skills.includes(task.skill))
        .map(person => ({ person, free: capacityFor(person, cell.week) - loadFor(items, person.id, cell.week).planned }))
        .filter(candidate => candidate.free >= task.hours)
        .sort((a, b) =>
          Number(b.person.squad === source.squad) - Number(a.person.squad === source.squad)
          || a.free - b.free,
        );
      if (candidates[0]) {
        const target = candidates[0];
        chosen = {
          id: `suggest-${task.id}-${cell.week}`, taskId: task.id,
          fromPersonId: source.id, toPersonId: target.person.id,
          fromWeek: cell.week, toWeek: cell.week, releasedHours: task.hours,
          reason: `${target.person.name} tem a habilidade necessária e ${formatHours(target.free)}h livres nesta semana. A mudança libera ${task.hours}h de ${source.name}.`,
        };
        break;
      }
      for (let week = cell.week + 1; week <= task.dueWeek; week++) {
        const free = capacityFor(source, week) - loadFor(items, source.id, week).planned;
        if (free >= task.hours) {
          chosen = {
            id: `suggest-${task.id}-${week}`, taskId: task.id,
            fromPersonId: source.id, toPersonId: source.id,
            fromWeek: cell.week, toWeek: week, releasedHours: task.hours,
            reason: `${source.name} tem ${formatHours(free)}h livres em ${weeks[week].label}. O novo período continua dentro do prazo.`,
          };
          break;
        }
      }
      if (chosen) break;
    }
    if (chosen) suggestions.push(chosen);
  }
  return suggestions;
}

export function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}
