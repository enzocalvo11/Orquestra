import { useEffect } from "react";
import { AlertCircle, ArrowRight, CalendarDays, Check, Clock3, X } from "lucide-react";
import { ProjectTag } from "../../components/common/ProjectTag";
import { people, weeks, type WorkItem } from "../../data/demo-data";
import { formatHours, getPerson, loadFor, type PlannedItem } from "../../lib/planning";

const typeName: Record<WorkItem["type"], string> = {
  Task: "Tarefa",
  Bug: "Bug",
  Test: "Teste",
};

interface TaskDialogProps {
  task: PlannedItem;
  items: PlannedItem[];
  draftPerson: string;
  draftWeek: number;
  busy: boolean;
  deferSave: boolean;
  onDraftPersonChange: (personId: string) => void;
  onDraftWeekChange: (week: number) => void;
  onClose: () => void;
  onSave: () => void;
}

export function TaskDialog({
  task,
  items,
  draftPerson,
  draftWeek,
  busy,
  deferSave,
  onDraftPersonChange,
  onDraftWeekChange,
  onClose,
  onSave,
}: TaskDialogProps) {
  const changed = draftPerson !== task.plannedPersonId || draftWeek !== task.plannedWeek;
  const source = loadFor(items, task.plannedPersonId, task.plannedWeek);
  const target = loadFor(items, draftPerson, draftWeek);
  const hours = task.status === "Concluído" ? 0 : task.hours;
  const targetAfter = target.planned + hours;
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="task-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-title"
      >
        <div className="modal-top">
          <span className="modal-type">{typeName[task.type]} · {task.id}</span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            <X size={21} />
          </button>
        </div>
        <h2 id="task-title">{task.title}</h2>
        <ProjectTag projectId={task.projectId} />
        <p className="modal-description">{task.description}</p>
        <div className="modal-hierarchy">
          <span><small>FEATURE</small>{task.feature}</span>
          <ArrowRight size={15} aria-hidden="true" />
          <span><small>PBI</small>{task.pbi}</span>
        </div>
        <div className="modal-facts">
          <span><small>ESTIMATIVA</small><strong><Clock3 size={16} /> {task.hours} horas</strong></span>
          <span><small>PRAZO</small><strong><CalendarDays size={16} /> {weeks[task.dueWeek].label}</strong></span>
          <span><small>PRIORIDADE</small><strong>{task.priority}</strong></span>
          <span><small>STATUS</small><strong>{task.status}</strong></span>
        </div>
        <div className="modal-divider" />
        <h3>Propor realocação</h3>
        <p className="modal-helper">
          {deferSave
            ? "A mudança ficará pendente até você salvar o planejamento."
            : "A mudança será salva no planejamento."}
        </p>
        <div className="modal-fields">
          <label>
            Responsável
            <select value={draftPerson} onChange={(event) => onDraftPersonChange(event.target.value)}>
              {people
                .filter((person) => person.skills.includes(task.skill))
                .map((person) => (
                  <option key={person.id} value={person.id}>{person.name} · {person.role}</option>
                ))}
            </select>
          </label>
          <label>
            Semana planejada
            <select value={draftWeek} onChange={(event) => onDraftWeekChange(Number(event.target.value))}>
              {weeks.map((week, index) => <option key={index} value={index}>{week.label}</option>)}
            </select>
          </label>
        </div>
        {changed && (
          <div className="modal-impact">
            <strong>Impacto previsto</strong>
            <p>{getPerson(task.plannedPersonId)?.name} · {weeks[task.plannedWeek].label}: {formatHours(source.planned)}h → {formatHours(source.planned - hours)}h de {formatHours(source.capacity)}h</p>
            <p>{getPerson(draftPerson)?.name} · {weeks[draftWeek].label}: {formatHours(target.planned)}h → {formatHours(targetAfter)}h de {formatHours(target.capacity)}h</p>
            {targetAfter > target.capacity && <span>Essa mudança deixará o destino acima da capacidade.</span>}
          </div>
        )}
        {draftWeek > task.dueWeek && (
          <p className="deadline-warning">
            <AlertCircle size={16} /> A semana escolhida ultrapassa o prazo desta atividade.
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" disabled={busy || !changed} onClick={onSave}>
            <Check size={16} /> {busy
              ? "Salvando realocação..."
              : deferSave ? "Aplicar à prévia" : "Confirmar realocação"}
          </button>
        </div>
      </section>
    </div>
  );
}
