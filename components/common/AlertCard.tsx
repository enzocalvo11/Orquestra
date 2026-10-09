import { AlertCircle, ArrowUpRight } from "lucide-react";
import type { Alert } from "../../lib/planning";

interface AlertCardProps {
  className?: string;
  alerts: Alert[];
  eyebrow: string;
  emptyMessage?: string;
  onAlertSelect: (alert: Alert) => void;
  maxVisible?: number;
}

export function AlertCard({ className, alerts, eyebrow, emptyMessage, onAlertSelect, maxVisible }: AlertCardProps) {
  const visibleAlerts = maxVisible === undefined ? alerts : alerts.slice(0, maxVisible);

  return (
    <section className={`surface alert-card ${className ?? ""}`} aria-labelledby="alert-card-title">
      <div className="section-heading">
        <div>
          <div className="section-kicker">{eyebrow}</div>
          <h2 id="alert-card-title">Alertas</h2>
        </div>
        <span className="alert-count">{alerts.length} {alerts.length === 1 ? "alerta" : "alertas"}</span>
      </div>
      {visibleAlerts.length > 0 ? (
        <div className="alert-list">
          {visibleAlerts.map((alert) => (
            <button className="alert-row" key={alert.id} onClick={() => onAlertSelect(alert)}>
              <span className={`alert-icon ${alert.severity}`}><AlertCircle size={17} /></span>
              <span><strong>{alert.title}</strong><small>{alert.detail}</small></span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      ) : emptyMessage ? (
        <p className="alert-card-empty">{emptyMessage}</p>
      ) : null}
      {maxVisible !== undefined && alerts.length > maxVisible && (
        <p className="alert-card-more">Mostrando {maxVisible} de {alerts.length} alertas desta semana.</p>
      )}
    </section>
  );
}
