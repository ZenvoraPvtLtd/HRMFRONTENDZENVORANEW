import type { BoardTask } from "./sprintData";
import { useTheme } from "../../../context/ThemeContext";

const PRIORITY_COLOR: Record<string, string> = {
  Low: "#10b981", Medium: "#f59e0b", High: "#f97316", Critical: "#ef4444",
};

const initialsFor = (name: string) =>
  name
    .replace(/[()]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const roleFor = (name?: string) =>
  name?.toLowerCase().includes("mgr") || name?.toLowerCase().includes("manager")
    ? { label: "MANAGER", color: "#ec4899" }
    : { label: "DEVELOPER", color: "#0ea5e9" };

export default function TaskCard({ task, onClick }: { task: BoardTask; onClick: () => void }) {
  const { isDark } = useTheme();

  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const cardShadow = isDark
    ? "0 1px 4px rgba(0,0,0,0.35)"
    : "0 1px 3px rgba(0,0,0,0.07), 0 1px 8px rgba(0,0,0,0.04)";
  const cardShadowHover = isDark
    ? "0 4px 16px rgba(0,0,0,0.45)"
    : "0 4px 16px rgba(0,0,0,0.10)";

  const pColor = PRIORITY_COLOR[task.priority ?? "Medium"];
  const role = roleFor(task.assignee?.name);

  return (
    <div
      onClick={onClick}
      style={{
        background: cardBg,
        borderRadius: "0.75rem",
        padding: "0.875rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        cursor: "pointer",
        boxShadow: cardShadow,
        border: "1px solid transparent",
        transition: "box-shadow 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = cardShadowHover;
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = cardShadow;
        el.style.transform = "none";
      }}
    >
      {/* Type + tags row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "0.65rem", fontWeight: 600,
            padding: "0.15rem 0.45rem", borderRadius: "0.3rem",
            background: "var(--bg-hover)", color: "var(--text-secondary)",
          }}
        >
          {task.type}
        </span>
        {task.assignee && (
          <span
            style={{
              fontSize: "0.65rem", fontWeight: 700,
              padding: "0.15rem 0.45rem", borderRadius: "0.3rem",
              background: role.color + "18", color: role.color,
            }}
          >
            {role.label}
          </span>
        )}
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: "0.825rem", fontWeight: 600,
          lineHeight: 1.45, color: "var(--text-primary)", margin: 0,
        }}
      >
        {task.title}
      </p>

      {/* Footer row */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "0.5rem", flexWrap: "wrap",
        }}
      >
        {/* Due date */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
            {task.dueDate || "No due date"}
          </span>
        </div>

        {/* Priority dot + assignee avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              fontSize: "0.65rem", fontWeight: 600,
              padding: "0.15rem 0.5rem", borderRadius: "9999px",
              background: pColor + "18", color: pColor,
            }}
          >
            {task.priority ?? "Medium"}
          </span>
          {task.assignee && (
            <div
              title={task.assignee.name}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#262626",
                border: "1px solid #3f3f46",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.7rem", fontWeight: 800, color: "#fff",
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
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#00c853",
                  border: "1.5px solid var(--bg-secondary)",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
