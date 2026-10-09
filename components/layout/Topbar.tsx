import { CalendarDays } from "lucide-react";
import { UserProfileIcon } from "../common/UserProfileIcon";
import { ThemeToggle } from "./ThemeToggle";
import type { DashboardView } from "../../features/dashboard/types";

const pageNames: Record<DashboardView, string> = {
  overview: "Visão geral",
  timelines: "Timelines",
  planning: "Planejamento",
};

export function Topbar({ view }: { view: DashboardView }) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        Workspace <span>/</span> <strong>{pageNames[view]}</strong>
      </div>
      <div className="top-actions">
        <span className="period-chip"><CalendarDays size={15} /> Outubro 2026</span>
        <ThemeToggle />
        <UserProfileIcon small />
      </div>
    </header>
  );
}
