export type DashboardView = "overview" | "timelines" | "planning";

export interface SourceInfo {
  syncedAt: string;
  projectCount: number;
  workItemCount: number;
  mode: string;
}

export interface CapacitySelection {
  personId: string;
  week: number;
}
