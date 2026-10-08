import { CalendarDays, UsersRound } from "lucide-react";
import { Avatar } from "../../components/common/Avatar";
import { absences, people, weeks } from "../../data/demo-data";
import { formatHours, loadFor, type PlannedItem } from "../../lib/planning";

export function TeamPage({ items, availableHours }: { items: PlannedItem[]; availableHours: number }) {
  const squadCount = new Set(people.map((person) => person.squad)).size;

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PESSOAS E DISPONIBILIDADE</div>
          <h1>Conheça a capacidade da equipe.</h1>
          <p>Dados fictícios complementares aos projetos e work items.</p>
        </div>
        <span className="subtle-badge"><UsersRound size={16} /> {people.length} profissionais</span>
      </div>

      <div className="team-summary">
        <div className="surface">
          <span>CAPACIDADE TOTAL · SEMANA ATUAL</span>
          <strong>{formatHours(availableHours)}h</strong>
          <small>Após ausências previstas</small>
        </div>
        <div className="surface">
          <span>SQUADS</span>
          <strong>{String(squadCount).padStart(2, "0")}</strong>
          <small>{[...new Set(people.map((person) => person.squad))].join(" e ")}</small>
        </div>
        <div className="surface">
          <span>FERIADO NO PERÍODO</span>
          <strong>12/10</strong>
          <small>Considerado na segunda semana</small>
        </div>
      </div>

      <div className="team-grid">
        {people.map((person) => {
          const cell = loadFor(items, person.id, 0);

          return (
            <article className="surface person-card" key={person.id}>
              <div className="person-card-head">
                <Avatar personId={person.id} />
                <span className="squad-pill">{person.squad}</span>
              </div>
              <h2>{person.name}</h2>
              <p>{person.role}</p>
              <div className="person-skills">
                {person.skills.map((skill) => <span key={skill}>{skill}</span>)}
              </div>
              <div className="person-card-divider" />
              <div className="person-card-metrics">
                <div><strong>{person.weeklyHours}h</strong><small>Capacidade semanal</small></div>
                <div>
                  <strong className={cell.percent > 100 ? "text-danger" : ""}>{cell.percent}%</strong>
                  <small>Ocupação atual</small>
                </div>
              </div>
              {Object.entries(absences[person.id] ?? {}).map(([week, hours]) => (
                <div className="person-absence" key={week}>
                  <CalendarDays size={14} />
                  {hours}h de ausência · {weeks[Number(week)].label}
                </div>
              ))}
            </article>
          );
        })}
      </div>
    </>
  );
}
