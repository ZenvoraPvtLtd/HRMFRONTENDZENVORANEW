import { useState } from "react";
import { Plus } from "lucide-react";
import type { BoardColumn, BoardTask, TaskStatus } from "./sprintData";
import { statusColor } from "./sprintData";
import TaskCard from "./TaskCard";

interface Props {
  columns: BoardColumn[];
  onTaskClick: (task: BoardTask) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask?: (status: TaskStatus) => void;
}

const STATUS_ORDER: TaskStatus[] = ["TO DO", "IN PROGRESS", "IN REVIEW", "DONE", "BLOCKED"];

export default function BoardView({ columns, onTaskClick, onStatusChange, onAddTask }: Props) {
  const [draggedTask, setDraggedTask] = useState<BoardTask | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const sorted = [...columns].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );

  const handleDragStart = (e: React.DragEvent, task: BoardTask) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    const target = e.target as HTMLElement;
    target.style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = "1";
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (draggedTask && draggedTask.status !== newStatus && onStatusChange) {
      onStatusChange(draggedTask.id, newStatus);
    }
    setDraggedTask(null);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        overflowX: "auto",
        paddingBottom: "1rem",
        minHeight: "calc(100vh - 300px)",
      }}
    >
      {sorted.map((col) => {
        const isDropTarget = dragOverColumn === col.status && draggedTask?.status !== col.status;

        return (
          <div
            key={col.status}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.status)}
            style={{
              flex: "0 0 280px",
              minWidth: "280px",
              maxWidth: "280px",
              display: "flex",
              flexDirection: "column",
              background: isDropTarget
                ? `${statusColor[col.status]}15`
                : "var(--bg-secondary)",
              borderRadius: "0.75rem",
              border: isDropTarget
                ? `2px dashed ${statusColor[col.status]}`
                : "1px solid var(--border)",
              transition: "all 0.2s ease",
            }}
          >
            {/* Column Header */}
            <div
              style={{
                padding: "0.875rem 1rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: statusColor[col.status],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                  }}
                >
                  {col.status}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "9999px",
                    background: statusColor[col.status] + "20",
                    color: statusColor[col.status],
                  }}
                >
                  {col.tasks.length}
                </span>
              </div>
              {onAddTask && (
                <button
                  onClick={() => onAddTask(col.status)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.25rem",
                    borderRadius: "0.375rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-secondary)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "var(--bg-primary)";
                    e.currentTarget.style.color = statusColor[col.status];
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {/* Tasks Container */}
            <div
              style={{
                flex: 1,
                padding: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.625rem",
                overflowY: "auto",
                minHeight: "200px",
              }}
            >
              {col.tasks.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2rem 1rem",
                    textAlign: "center",
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    border: "1.5px dashed var(--border)",
                    borderRadius: "0.5rem",
                    opacity: 0.7,
                  }}
                >
                  {isDropTarget ? "Drop here" : "No tasks"}
                </div>
              ) : (
                col.tasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    style={{
                      cursor: "grab",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <TaskCard task={task} onClick={() => onTaskClick(task)} />
                  </div>
                ))
              )}
            </div>

            {/* Quick Add Button at Bottom */}
            {onAddTask && col.tasks.length > 0 && (
              <button
                onClick={() => onAddTask(col.status)}
                style={{
                  margin: "0.5rem 0.75rem 0.75rem",
                  padding: "0.5rem",
                  background: "transparent",
                  border: "1.5px dashed var(--border)",
                  borderRadius: "0.5rem",
                  color: "var(--text-secondary)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.375rem",
                  transition: "all 0.15s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = statusColor[col.status];
                  e.currentTarget.style.color = statusColor[col.status];
                  e.currentTarget.style.background = statusColor[col.status] + "10";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Plus size={14} />
                Add Task
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
