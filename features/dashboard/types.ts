import type { Person, Project, WorkItem } from "../../data/demo-data";

export type DashboardView = "overview" | "timelines" | "planning" | "team";

export interface SourceInfo {
  syncedAt: string;
  projectCount: number;
  workItemCount: number;
  mode: string;
  source: string;
  workItems: WorkItem[];
  projects: Project[];
  people: Person[];
  sourceError?: string;
}

export interface CapacitySelection {
  personId: string;
  week: number;
}
