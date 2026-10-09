import type { Person, Project, WorkItem } from "../../data/demo-data";

export type DashboardView = "overview" | "timelines" | "planning";

export interface SourceInfo {
  syncedAt: string;
  workItems: WorkItem[];
  projects: Project[];
  people: Person[];
}

export interface CapacitySelection {
  personId: string;
  week: number;
}
