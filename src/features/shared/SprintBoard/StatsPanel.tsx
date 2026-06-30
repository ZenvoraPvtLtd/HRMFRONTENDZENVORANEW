import type { BoardColumn } from "./sprintData";

interface Props {
  columns: BoardColumn[];
}

export default function StatsPanel({ columns }: Props) {
  const allTasks = columns.flatMap((c) => c.tasks);
  const total = allTasks.length;
  const done = columns.find((c) => c.status === "DONE")?.tasks.length ?? 0;
  const inProgress = columns.find((c) => c.status === "IN PROGRESS")?.tasks.length ?? 0;
  const blocked = columns.find((c) => c.status === "BLOCKED")?.tasks.length ?? 0;
  const estHours = allTasks.reduce((sum, t) => sum + (t.estimate ? parseFloat(t.estimate) : 0), 0);


  return (
    <div>
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        {[
          { label: "TOTAL", value: total, color: "var(--text-primary)" },
          { label: "DONE", value: done, color: "#10b981" },
          { label: "IN PROGRESS", value: inProgress, color: "#f59e0b" },
          { label: "BLOCKED", value: blocked, color: "#ef4444" },
          { label: "EST. HOURS", value: `${estHours}h`, color: "var(--text-primary)" },
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.07em" }}>{s.label}</span>
            <span style={{ fontSize: "1rem", fontWeight: 800, color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
