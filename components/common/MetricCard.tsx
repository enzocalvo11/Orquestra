import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
  detail: string;
}

export function MetricCard({ icon: Icon, tone, label, value, detail }: MetricCardProps) {
  return (
    <div className="surface metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={19} strokeWidth={2} aria-hidden="true" />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      <span className="metric-arrow" aria-hidden="true">
        <ArrowUpRight size={17} />
      </span>
    </div>
  );
}
