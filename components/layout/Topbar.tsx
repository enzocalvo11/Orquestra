import { Bell, CalendarDays } from "lucide-react";
import { Avatar } from "../common/Avatar";
import type { DashboardView } from "../../features/dashboard/types";

const pageNames: Record<DashboardView, string> = {
  overview: "Visão geral",
  timelines: "Timelines",
  planning: "Planejamento",
};

export function Topbar({ view, alertCount }: { view: DashboardView; alertCount: number }) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        Workspace <span>/</span> <strong>{pageNames[view]}</strong>
      </div>
      <div className="top-actions">
        <span className="period-chip"><CalendarDays size={15} /> Outubro 2026</span>
        <span className="icon-button" title={`${alertCount} alertas`}>
          <Bell size={19} />
          {alertCount > 0 && <i />}
        </span>
        <Avatar personId="ana" small />
      </div>
    </header>
  );
}
