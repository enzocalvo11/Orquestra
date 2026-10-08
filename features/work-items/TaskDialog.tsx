import { useEffect } from "react";
import { AlertCircle, ArrowRight, CalendarDays, Check, Clock3, X } from "lucide-react";
import { ProjectTag } from "../../components/common/ProjectTag";
import { people, weeks, type WorkItem } from "../../data/demo-data";
import type { PlannedItem } from "../../lib/planning";

const typeName: Record<WorkItem["type"], string> = {
  Task: "Tarefa",
  Bug: "Bug",
  Test: "Teste",
};

interface TaskDialogProps {
  task: PlannedItem;
  draftPerson: string;
  draftWeek: number;
  busy: boolean;
  onDraftPersonChange: (personId: string) => void;
  onDraftWeekChange: (week: number) => void;
  onClose: () => void;
  onSave: () => void;
}

export function TaskDialog({
  task,
  draftPerson,
  draftWeek,
  busy,
  onDraftPersonChange,
  onDraftWeekChange,
  onClose,
  onSave,
}: TaskDialogProps) {
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
        <p className="modal-helper">Essa alteração fica registrada no planejamento do Orquestra.</p>
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
        {draftWeek > task.dueWeek && (
          <p className="deadline-warning">
            <AlertCircle size={16} /> A semana escolhida ultrapassa o prazo desta atividade.
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" disabled={busy} onClick={onSave}>
            <Check size={16} /> Salvar proposta
          </button>
        </div>
      </section>
    </div>
  );
}
