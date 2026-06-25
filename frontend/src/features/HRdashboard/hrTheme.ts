import type { CSSProperties, MouseEvent } from "react";

/** Full-width page shell inside Layout main-content (100% of content area) */
export const hrPageWrap = "hr-page";

export const card: CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
};

export const cardInner: CSSProperties = {
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
};

export const textPrimary: CSSProperties = { color: "var(--text-primary)" };
export const textSecondary: CSSProperties = { color: "var(--text-secondary)" };

export const input: CSSProperties = {
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

export const inputMuted: CSSProperties = {
  background: "var(--chart-bg)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

export const btnSecondary: CSSProperties = {
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

export const btnPrimary: CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-text)",
  border: "none",
};

export const tableHead: CSSProperties = {
  background: "var(--table-head-bg)",
  color: "var(--table-head-text)",
};

export const HR_YEAR_OPTIONS = ["2024", "2025", "2026", "2027"];

export const yearSelectClassName =
  "h-10 min-w-[112px] rounded-lg px-3 text-sm font-semibold outline-none";

export const rowHover = {
  onMouseEnter: (e: MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "var(--bg-hover)";
  },
  onMouseLeave: (e: MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "transparent";
  },
};

/** Status badges that work in light and dark mode */
export const statusColors: Record<string, { bg: string; color: string }> = {
  Approved: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  Present: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  "On Time": { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  Remote: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
  Absent: { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
  Late: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  Active: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  Completed: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  Pending: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  "In Progress": { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
  Rejected: { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
  "Needs Attention": { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
  Submitted: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  "Pending Approval": { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  Busy: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  "On Leave": { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  "Not Started": { bg: "rgba(107,114,128,0.12)", color: "#6b7280" },
};

export function getStatusStyle(status: string): CSSProperties {
  const s = statusColors[status] ?? statusColors["Not Started"];
  return { background: s.bg, color: s.color };
}
