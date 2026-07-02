import { useState, useRef, useEffect } from "react";
import type { BoardColumn, BoardTask, TaskStatus } from "./sprintData";
import { statusColor } from "./sprintData";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";
import PaginationControls from "../../../components/PaginationControls";

const PRIORITY_BG: Record<string, string> = {
  Low: "#22c55e",
  Medium: "#fcd34d",
  High: "#fb7185",
  Critical: "#ef4444",
};

const ALL_STATUSES: TaskStatus[] = ["TO DO", "IN PROGRESS", "IN REVIEW", "DONE", "BLOCKED"];
const PAGE_SIZE = 10;

const GRID = "minmax(220px,1.4fr) minmax(150px,0.8fr) minmax(170px,0.9fr) minmax(130px,0.7fr) minmax(130px,0.7fr) minmax(120px,0.6fr) minmax(120px,0.6fr) minmax(180px,0.9fr)";
const HEADER_COLS = ["Task Name", "Status", "Assignee", "Due Date", "Priority", "Est. Time", "Logged", "Tags"];

const initialsFor = (name: string) =>
  name
    .replace(/[()]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

interface Props {
  columns: BoardColumn[];
  onTaskClick: (task: BoardTask) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

interface DropdownState {
  taskId: string;
  top: number;
  left: number;
}

export default function ListView({ columns, onTaskClick, onStatusChange }: Props) {
  const { isDark } = useTheme();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dropdown, setDropdown] = useState<DropdownState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const headerBg = "#1a0fa3";

  const total = columns.reduce((a, c) => a + c.tasks.length, 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pageTaskIds = new Set(
    columns
      .flatMap((col) => col.tasks)
      .slice(pageStart, pageEnd)
      .map((task) => task.id)
  );
  const paginatedColumns = columns.map((col) => ({
    ...col,
    tasks: col.tasks.filter((task) => pageTaskIds.has(task.id)),
  }));

  useEffect(() => {
    // defer resetting page to avoid synchronous setState inside effect
    const raf = window.requestAnimationFrame(() => setCurrentPage(1));
    return () => window.cancelAnimationFrame(raf);
  }, [columns]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  };

  const toggleCollapse = (status: string) =>
    setCollapsed((prev) => ({ ...prev, [status]: !prev[status] }));

  const openDropdown = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (dropdown?.taskId === taskId) { setDropdown(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dropdownHeight = 220; // approx height of the dropdown
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight - 4 : rect.bottom + 6;
    setDropdown({ taskId, top, left: rect.left });
  };

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div style={{ overflowX: "auto", paddingBottom: "2rem" }}>

      {/* Total */}
      <div style={{ marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
          {total} task{total !== 1 ? "s" : ""} · Showing {total ? pageStart + 1 : 0}-{Math.min(pageEnd, total)}
        </span>
      </div>

      {/* Table wrapper */}
      <div
        style={{
          background: `linear-gradient(to bottom, ${headerBg} 0 44px, var(--bg-secondary) 44px 100%)`,
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          overflowX: "auto",
        }}
      >
      <div style={{ minWidth: "1220px", width: "100%" }}>

        {/* Column header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: GRID,
            alignItems: "center",
            width: "100%",
            boxSizing: "border-box",
            minHeight: "44px",
            padding: "0 1rem",
            background: headerBg,
            borderBottom: "1px solid var(--border)",
            gap: "0.75rem",
            position: "sticky",
            top: 0,
            zIndex: 3,
          }}
        >
          {HEADER_COLS.map((h) => (
            <span
              key={h}
              style={{
                display: "flex",
                alignItems: "center",
                minWidth: 0,
                fontSize: "0.7rem",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Groups */}
        {paginatedColumns.map((col) => {
          const isCollapsed = !!collapsed[col.status];
          const sColor = statusColor[col.status];
          const tasks = col.tasks;

          return (
            <div key={col.status} style={{ marginTop: "0.25rem" }}>

              {/* Group header */}
              <div
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.5rem 1rem 0.5rem 0.75rem",
                  cursor: "pointer", borderRadius: "0.4rem", userSelect: "none",
                }}
                onClick={() => toggleCollapse(col.status)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                {isCollapsed
                  ? <ChevronRight size={14} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                  : <ChevronDown size={14} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                }
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: sColor }}>
                  {col.status}
                </span>
                <span
                  style={{
                    fontSize: "0.68rem", fontWeight: 700,
                    padding: "0.1rem 0.45rem", borderRadius: "9999px",
                    background: sColor + "18", color: sColor,
                  }}
                >
                  {tasks.length}
                </span>
              </div>

              {/* Task rows */}
              {!isCollapsed && (
                <>
                  {tasks.length === 0 ? (
                    <div
                      style={{
                        padding: "0.75rem 1rem 0.75rem 2.5rem",
                        fontSize: "0.75rem", color: "var(--text-secondary)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      No tasks
                    </div>
                  ) : (
                    tasks.map((task) => {
                      const currentStatus: TaskStatus = col.status;
                      const isDone = currentStatus === "DONE";
                      const pColor = PRIORITY_BG[task.priority ?? "Medium"];
                      const sCol = statusColor[currentStatus];

                      return (
                        <div
                          key={task.id}
                          onClick={() => onTaskClick(task)}
                          style={{
                            display: "grid",
                            gridTemplateColumns: GRID,
                            alignItems: "center",
                            width: "100%",
                            boxSizing: "border-box",
                            gap: "0.75rem",
                            padding: "0 1rem",
                            minHeight: "42px",
                            cursor: "pointer",
                            borderBottom: "1px solid var(--border)",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(128,128,128,0.06)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                        >
                          {/* Task name */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: "0.82rem", fontWeight: 500,
                                color: isDone ? "var(--text-secondary)" : "var(--text-primary)",
                                textDecoration: isDone ? "line-through" : "none",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}
                              title={task.title}
                            >
                              {task.title}
                            </span>
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", flexShrink: 0, opacity: 0.5 }}>
                              {task.taskId}
                            </span>
                          </div>

                          {/* Status pill — own column */}
                          <div onClick={(e) => e.stopPropagation()} style={{ overflow: "visible" }}>
                            <button
                              onClick={(e) => openDropdown(e, task.id)}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: "0.3rem",
                                fontSize: "0.68rem", fontWeight: 700,
                                padding: "0.2rem 0.65rem", borderRadius: "9999px",
                                background: sCol + "18", color: sCol,
                                border: `1px solid ${sCol}35`,
                                cursor: "pointer", whiteSpace: "nowrap",
                                width: "max-content",
                              }}
                            >
                              {currentStatus}
                              <ChevronDown size={10} />
                            </button>
                          </div>

                          {/* Assignee */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            {task.assignee ? (
                              <>
                                <div
                                  title={task.assignee.name}
                                  style={{
                                    width: 24, height: 24, borderRadius: "50%",
                                    background: "#262626",
                                    border: "1px solid #3f3f46",
                                    color: "#ffffff",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "0.58rem", fontWeight: 800,
                                    flexShrink: 0,
                                    position: "relative",
                                  }}
                                >
                                  {initialsFor(task.assignee.name)}
                                  <span
                                    style={{
                                      position: "absolute",
                                      right: -1,
                                      bottom: -1,
                                      width: 7,
                                      height: 7,
                                      borderRadius: "50%",
                                      background: "#00c853",
                                      border: "1.5px solid var(--bg-secondary)",
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {task.assignee.name}
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", opacity: 0.4 }}>—</span>
                            )}
                          </div>

                          {/* Due date */}
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            {task.dueDate ?? "—"}
                          </span>

                          {/* Priority */}
                          {task.priority ? (
                            <span
                              style={{
                                display: "inline-block", fontSize: "0.7rem", fontWeight: 700,
                                padding: "0.2rem 0.7rem", borderRadius: "0.35rem",
                                background: "#fff", color: pColor, border: `1.5px solid ${pColor}`, width: "fit-content",
                              }}
                            >
                              {task.priority}
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", opacity: 0.4 }}>—</span>
                          )}

                          {/* Estimate */}
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            {task.estimate ?? "—"}
                          </span>

                          {/* Logged */}
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            {task.logged ?? "—"}
                          </span>

                          {/* Tags */}
                          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                            {task.tags?.map((tag) => (
                              <span
                                key={tag.label}
                                style={{
                                  fontSize: "0.65rem", fontWeight: 700,
                                  padding: "0.15rem 0.5rem", borderRadius: "9999px",
                                  background: tag.color, color: "#fff", whiteSpace: "nowrap",
                                }}
                              >
                                {tag.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Bottom border for group */}
                  <div style={{ borderBottom: "1px solid var(--border)", marginBottom: "0.25rem" }} />
                </>
              )}
            </div>
          );
        })}
      </div>
      </div>

      <PaginationControls
        currentPage={safeCurrentPage}
        totalItems={total}
        pageSize={PAGE_SIZE}
        itemLabel="tasks"
        onPageChange={goToPage}
      />

      {/* Status dropdown portal */}
      {dropdown && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: dropdown.top,
            left: Math.min(dropdown.left, window.innerWidth - 180),
            zIndex: 9999,
            background: "var(--dropdown-bg)", border: "1px solid var(--border)",
            borderRadius: "0.6rem", boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            minWidth: "160px", overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "0.4rem 0.75rem",
              fontSize: "0.65rem", fontWeight: 700,
              color: "var(--dropdown-text)", letterSpacing: "0.06em",
              borderBottom: "1px solid var(--border)",
            }}
          >
            CHANGE STATUS
          </div>
          {ALL_STATUSES.map((s) => {
            const currentColStatus = columns.find(c => c.tasks.find(t => t.id === dropdown.taskId))?.status;
            const isActive = currentColStatus === s;
            return (
              <button
                key={s}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(dropdown.taskId, s);
                  setDropdown(null);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  width: "100%", padding: "0.5rem 0.75rem",
                  background: isActive ? "var(--dropdown-selected-bg)" : "var(--dropdown-bg)",
                  border: "none", cursor: "pointer", textAlign: "left",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--dropdown-hover-bg)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isActive ? "var(--dropdown-selected-bg)" : "var(--dropdown-bg)"; }}
              >
                <span
                  style={{
                    width: 9, height: 9, borderRadius: "50%",
                    background: statusColor[s], flexShrink: 0, display: "inline-block",
                  }}
                />
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--dropdown-text)" }}>
                  {s}
                </span>
                {isActive && (
                  <CheckCircle2 size={13} style={{ color: statusColor[s], marginLeft: "auto" }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
