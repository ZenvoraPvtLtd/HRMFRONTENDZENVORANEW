export function statusBadge(status: string): { background: string; border: string; color: string } {
  if (status === "On Time" || status === "Approved")
    return { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" };
  if (status === "Late" || status === "Pending")
    return { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" };
  return { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" };
}
