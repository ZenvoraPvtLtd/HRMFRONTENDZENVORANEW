import type { BoardColumn } from "./sprintData";
import { statusColor } from "./sprintData";

const roleFor = (name: string) =>
  name.toLowerCase().includes("mgr") || name.toLowerCase().includes("manager") ? "Manager" : "Developer";

const initialsFor = (name: string) =>
  name
    .replace(/[()]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const STATUS_ORDER = ["TO DO", "IN PROGRESS", "IN REVIEW", "DONE", "BLOCKED"] as const;

interface Props {
  columns: BoardColumn[];
  allAssignees: string[];
  filterAssignee: string;
  onSelect: (name: string) => void;
  onClear: () => void;
}

export default function AssigneesPanel({ columns, allAssignees, filterAssignee, onSelect, onClear }: Props) {
  const allTasks = columns.flatMap((c) => c.tasks);

  const statsFor = (name: string) => {
    const tasks = allTasks.filter((t) => t.assignee?.name === name);
    const byStatus = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
      acc[s] = tasks.filter((t) => {
        const col = columns.find((c) => c.tasks.some((tt) => tt.id === t.id));
        return col?.status === s;
      }).length;
      return acc;
    }, {});
    const done = byStatus["DONE"] ?? 0;
    const total = tasks.length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, byStatus, progress };
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Team Assignees
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginLeft: "0.5rem" }}>
            {allAssignees.length} members
          </span>
        </div>
        {filterAssignee !== "all" && (
          <button
            onClick={onClear}
            style={{
              fontSize: "0.7rem", fontWeight: 600, padding: "0.25rem 0.7rem",
              borderRadius: "0.35rem", background: "transparent",
              color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer",
            }}
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Assignee rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
        {allAssignees.map((name) => {
          const role = roleFor(name);
          const { total, done, byStatus, progress } = statsFor(name);
          const isActive = filterAssignee === name;

          return (
            <button
              key={name}
              onClick={() => onSelect(isActive ? "all" : name)}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 1fr 120px 60px",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.55rem 0.5rem",
                borderRadius: "0.5rem",
                background: isActive ? "var(--bg-hover)" : "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = isActive ? "var(--bg-hover)" : "transparent";
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "#262626",
                  border: "1px solid #3f3f46",
                  color: "#ffffff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.7rem", fontWeight: 800,
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {initialsFor(name)}
                <span
                  style={{
                    position: "absolute",
                    right: -1,
                    bottom: -1,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#00c853",
                    border: "1.5px solid var(--bg-secondary)",
                  }}
                />
              </div>

              {/* Name + role */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </div>
                <div style={{ fontSize: "0.62rem", color: "var(--accent)", fontWeight: 600 }}>
                  {role}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ flex: 1, height: 4, borderRadius: "9999px", background: "var(--border)" }}>
                  <div
                    style={{
                      height: "100%", borderRadius: "9999px",
                      background: "var(--accent)",
                      width: `${progress}%`,
                    }}
                  />
                </div>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-secondary)", flexShrink: 0 }}>
                  {progress}%
                </span>
              </div>

              {/* Status pills */}
              <div style={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end" }}>
                {STATUS_ORDER.map((s) =>
                  (byStatus[s] ?? 0) > 0 ? (
                    <span
                      key={s}
                      title={`${s}: ${byStatus[s]}`}
                      style={{
                        fontSize: "0.58rem", fontWeight: 700,
                        padding: "0.1rem 0.3rem", borderRadius: "9999px",
                        background: statusColor[s] + "20", color: statusColor[s],
                      }}
                    >
                      {byStatus[s]}
                    </span>
                  ) : null
                )}
                <span style={{ fontSize: "0.62rem", color: "var(--text-secondary)", marginLeft: "0.1rem" }}>
                  {done}/{total}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
