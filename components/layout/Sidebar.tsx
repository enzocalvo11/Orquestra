import {
  CalendarDays,
  Info,
  LayoutDashboard,
  Layers3,
  MoveRight,
} from "lucide-react";
import { UserProfileIcon } from "../common/UserProfileIcon";
import type { DashboardView } from "../../features/dashboard/types";
import "./sidebar.css";

const navigation = [
  { key: "overview", label: "Visão geral", icon: LayoutDashboard },
  { key: "timelines", label: "Timelines", icon: CalendarDays },
  { key: "planning", label: "Planejamento", icon: MoveRight },
] as const satisfies ReadonlyArray<{
  key: DashboardView;
  label: string;
  icon: typeof LayoutDashboard;
}>;

interface SidebarProps {
  view: DashboardView;
  highAlertCount: number;
  onViewChange: (view: DashboardView) => void;
}

export function Sidebar({
  view,
  highAlertCount,
  onViewChange,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo" role="img" aria-label="Orquestra" />
        <div className="brand-mark" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      </div>

      <div className="workspace-select">
        <span className="workspace-icon"><Layers3 size={17} /></span>
        <span className="workspace-details">
          <small className="workspace-kicker">Workspace</small>
          <strong>Iport</strong>
          <span className="workspace-project">ImportAtlas / Orquestra2</span>
        </span>
      </div>

      <div className="sidebar-label">ÁREA DE TRABALHO</div>
      <nav className="sidebar-nav" aria-label="Navegação principal">
        {navigation.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={view === key ? "active" : ""}
            onClick={() => onViewChange(key)}
            aria-current={view === key ? "page" : undefined}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            {label}
            {key === "planning" && highAlertCount > 0 && (
              <span className="nav-badge">{highAlertCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />
      <div className="sidebar-foot">
        <span className="online-dot" />
        Fonte Azure DevOps
        <span title="Equipe e capacidade complementares mantidas no projeto"><Info size={14} /></span>
      </div>
      <div className="sidebar-profile">
        <UserProfileIcon variant="dark" />
        <span>
          <strong>Gestão de projetos</strong>
          <small>Equipe interna</small>
        </span>
      </div>
    </aside>
  );
}
