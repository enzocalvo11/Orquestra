import type { DragEvent } from "react";
import { GripVertical } from "lucide-react";
import { weeks, type WorkItem } from "../../data/demo-data";
import { getProject } from "../../lib/planning";
import type { PlannedItem } from "../../lib/planning";

const typeName: Record<WorkItem["type"], string> = {
  Task: "Tarefa",
  Bug: "Bug",
  Test: "Teste",
};

interface WorkCardProps {
  task: PlannedItem;
  onOpen: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>, id: string) => void;
  onDragEnd?: () => void;
}

export function WorkCard({
  task,
  onOpen,
  draggable = false,
  onDragStart,
  onDragEnd,
}: WorkCardProps) {
  const project = getProject(task.projectId);

  return (
    <article
      className={`work-card ${draggable ? "work-card-draggable" : ""} ${task.isChanged ? "work-card-changed" : ""}`}
      draggable={draggable}
      onDragStart={draggable ? (event) => onDragStart?.(event, task.id) : undefined}
      onDragEnd={onDragEnd}
      style={{ borderLeftColor: project?.color }}
    >
      <button
        className="work-card-main"
        onClick={() => onOpen(task.id)}
        title={`Detalhes de ${task.title}`}
      >
        <span className="work-card-top">
          <span className="work-card-type">
            {typeName[task.type]} · {task.id}
          </span>
          {draggable && <GripVertical size={14} aria-hidden="true" />}
        </span>
        <strong>{task.title}</strong>
        <span className="work-card-bottom">
          <span>{task.hours}h</span>
          <span>Prazo: {weeks[task.dueWeek].short}</span>
        </span>
      </button>
    </article>
  );
}
