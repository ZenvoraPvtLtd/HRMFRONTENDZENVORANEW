import { useEffect, useMemo, useState, useCallback } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { useTopHeaderSearch } from "../../../hooks/useTopHeaderSearch";
import { fetchHrLeaves, fetchAllLeaveBalances, updateHrLeaveStatus } from "../../../services/leaveApi";
import type { HrLeaveRequest, ApiLeaveBalance } from "../../../services/leaveApi";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "all" | "balances";

const STATUS_OPTIONS = ["All Status", "Pending", "Under HR Review", "Approved", "Rejected"];
const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "Approved": return { background: "rgba(16,185,129,0.12)", color: "#10b981" };
    case "Rejected": return { background: "rgba(239,68,68,0.12)", color: "#ef4444" };
    case "Under HR Review": return { background: "rgba(59,130,246,0.12)", color: "#3b82f6" };
    default: return { background: "rgba(245,158,11,0.12)", color: "#f59e0b" }; // Pending
  }
}

function getAuthHeaders() {
  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("hr_accessToken") ||
    "";
  const role = localStorage.getItem("userRole") || localStorage.getItem("hr_userRole") || "hr";
  const name = localStorage.getItem("userName") || localStorage.getItem("hr_userName") || "HR";
  const id = localStorage.getItem("userId") || localStorage.getItem("hr_userEmail") || "hr";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-User-Role": role,
    "X-User-Name": name,
    "X-User-Id": id,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LeaveManagementPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useTopHeaderSearch();
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

  // All Leaves tab
  const [leaves, setLeaves] = useState<HrLeaveRequest[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [errorLeaves, setErrorLeaves] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  // Employee Balances tab
  const [balances, setBalances] = useState<ApiLeaveBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // ── Fetch leaves ─────────────────────────────────────────────────────────
  const loadLeaves = useCallback(async () => {
    setLoadingLeaves(true);
    setErrorLeaves("");
    try {
      const data = await fetchHrLeaves();
      setLeaves(data);
    } catch (e) {
      setErrorLeaves(e instanceof Error ? e.message : "Failed to load leaves");
    } finally {
      setLoadingLeaves(false);
    }
  }, []);

  // ── Fetch balances ────────────────────────────────────────────────────────
  const loadBalances = useCallback(async () => {
    setLoadingBalances(true);
    try {
      const data = await fetchAllLeaveBalances(yearFilter);
      setBalances(data);
    } catch {
      setBalances([]);
    } finally {
      setLoadingBalances(false);
    }
  }, [yearFilter]);

  useEffect(() => { void loadLeaves(); }, [loadLeaves]);
  useEffect(() => { if (tab === "balances") void loadBalances(); }, [tab, loadBalances]);

  // ── HR approve / reject ───────────────────────────────────────────────────
  const handleAction = async (id: string, action: "approved" | "rejected") => {
    setActionLoading(id);
    setActionMsg("");
    try {
      await updateHrLeaveStatus(id, action);
      setActionMsg(`Leave ${action} successfully`);
      await loadLeaves();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Filtered leaves ───────────────────────────────────────────────────────
  const filteredLeaves = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaves.filter((l) => {
      const matchSearch = !q ||
        [l.employee, l.type, l.department, l.reason, l.status]
          .some(v => (v || "").toLowerCase().includes(q));
      const matchStatus = statusFilter === "All Status" || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leaves, search, statusFilter]);

  // ── Filtered balances ─────────────────────────────────────────────────────
  const filteredBalances = useMemo(() => {
    const q = search.trim().toLowerCase();
    return balances.filter((b) =>
      !q || [b.employee_name, b.department, b.employee_id]
        .some(v => (v || "").toLowerCase().includes(q))
    );
  }, [balances, search]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ["Employee", "Department", "Type", "Date", "Days", "Status", "Reason"];
    const rows = filteredLeaves.map(l => [l.employee, l.department, l.type, l.date, l.days, l.status, l.reason]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "leave-requests.csv"; a.click();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "1.25rem 1.5rem", background: "var(--bg-primary)", minHeight: "100%" }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Leave Management</h1>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0.2rem 0 0" }}>Manage all employee leave requests and balances</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={exportCSV} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={loadLeaves} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "var(--accent)", color: "var(--accent-text)", border: "none", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
            <RefreshCw size={14} className={loadingLeaves ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "1.25rem", gap: "0" }}>
        {([
          { key: "all", label: `All Leave Requests (${leaves.length})` },
          { key: "balances", label: "Employee Balances" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "0.65rem 1.25rem", background: "transparent", border: "none",
            borderBottom: tab === key ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === key ? "var(--accent)" : "var(--text-secondary)",
            fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", marginBottom: -1,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee or leave type…"
            style={{ width: "100%", paddingLeft: "2.25rem", paddingRight: "0.75rem", height: 36, borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {tab === "all" && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: 36, borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "0.82rem", padding: "0 0.75rem", outline: "none" }}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {tab === "balances" && (
          <select value={yearFilter} onChange={e => { setYearFilter(Number(e.target.value)); }} style={{ height: 36, borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "0.82rem", padding: "0 0.75rem", outline: "none" }}>
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}

        <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          {tab === "all" ? `${filteredLeaves.length} leave requests` : `${filteredBalances.length} employees`}
        </span>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div style={{ marginBottom: "0.75rem", padding: "0.6rem 1rem", borderRadius: "0.5rem", background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize: "0.82rem", fontWeight: 600 }}>
          {actionMsg}
        </div>
      )}

      {/* ── All Leaves Table ── */}
      {tab === "all" && (
        <div style={{ background: "var(--bg-secondary)", borderRadius: "0.75rem", border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--table-head-bg)", color: "var(--table-head-text)" }}>
                  {["Employee", "Leave Type", "Period", "Days", "Reason", "Status", "HR", "Manager", "Admin", "Actions"].map(col => (
                    <th key={col} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingLeaves ? (
                  <tr><td colSpan={10} style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Loading…</td></tr>
                ) : errorLeaves ? (
                  <tr><td colSpan={10} style={{ padding: "2rem", textAlign: "center", color: "#ef4444", fontSize: "0.85rem" }}>{errorLeaves}</td></tr>
                ) : filteredLeaves.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>No leave requests found</td></tr>
                ) : (
                  filteredLeaves.map(leave => {
                    const role = localStorage.getItem("userRole") || localStorage.getItem("hr_userRole") || "hr";
                    const canHrAct = 
                      (role === "admin" && leave.internal_status === "admin_pending") || 
                      (role === "hr" && leave.internal_status === "hr_pending") ||
                      (role === "admin" && leave.internal_status === "hr_pending") ||
                      (leave.internal_status === "manager_approved") || 
                      (leave.status === "Under HR Review");

                    let hrVal = "Pending";
                    let mgrVal = "Pending";
                    let admVal = "Pending";

                    if (leave.internal_status === "approved") {
                      hrVal = "Approved";
                      mgrVal = "Approved";
                      admVal = "Approved";
                    } else if (leave.internal_status === "rejected") {
                      hrVal = "Rejected";
                      mgrVal = "Rejected";
                      admVal = "Rejected";
                    } else if (leave.internal_status === "admin_pending") {
                      hrVal = "Approved";
                      mgrVal = "Approved";
                      admVal = "Pending";
                    } else if (leave.internal_status === "manager_pending") {
                      hrVal = "Approved";
                      mgrVal = "Pending";
                      admVal = "Pending";
                    } else if (leave.internal_status === "hr_pending") {
                      hrVal = "Pending";
                      mgrVal = "Pending";
                      admVal = "Pending";
                    } else if (leave.internal_status === "manager_approved") {
                      mgrVal = "Approved";
                      hrVal = leave.status === "Approved" ? "Approved" : (leave.status === "Rejected" ? "Rejected" : "Pending");
                      admVal = "—";
                    } else if (leave.internal_status === "manager_rejected") {
                      mgrVal = "Rejected";
                      hrVal = "—";
                      admVal = "—";
                    }

                    return (
                      <tr key={leave.id} style={{ borderTop: "1px solid var(--border)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
                      >
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                          {leave.employee}
                          {leave.department && <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 400 }}>{leave.department}</div>}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{leave.type}</td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{leave.date}</td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-primary)", textAlign: "center" }}>{leave.days}</td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-secondary)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={leave.reason}>
                          {leave.reason || "—"}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ ...statusStyle(leave.status), padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700 }}>
                            {leave.status}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ ...statusStyle(hrVal), padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700 }}>
                            {hrVal}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ ...statusStyle(mgrVal), padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700 }}>
                            {mgrVal}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ ...statusStyle(admVal), padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700 }}>
                            {admVal}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          {canHrAct ? (
                            <div style={{ display: "flex", gap: "0.4rem" }}>
                              <button
                                disabled={actionLoading === leave.id}
                                onClick={() => handleAction(leave.id, "approved")}
                                style={{ padding: "0.3rem 0.7rem", borderRadius: "0.4rem", border: "none", background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", opacity: actionLoading === leave.id ? 0.5 : 1 }}
                              >
                                Approve
                              </button>
                              <button
                                disabled={actionLoading === leave.id}
                                onClick={() => handleAction(leave.id, "rejected")}
                                style={{ padding: "0.3rem 0.7rem", borderRadius: "0.4rem", border: "none", background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", opacity: actionLoading === leave.id ? 0.5 : 1 }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Employee Balances Table ── */}
      {tab === "balances" && (
        <div style={{ background: "var(--bg-secondary)", borderRadius: "0.75rem", border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 650, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--table-head-bg)", color: "var(--table-head-text)" }}>
                  {["Employee", "Department", "Year", "Earned", "Used", "Remaining"].map(col => (
                    <th key={col} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700 }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingBalances ? (
                  <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Loading…</td></tr>
                ) : filteredBalances.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>No balance records found</td></tr>
                ) : (
                  filteredBalances.map(b => (
                    <tr key={b.employee_id} style={{ borderTop: "1px solid var(--border)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
                    >
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{b.employee_name || b.employee_id}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>{b.department || "—"}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>{b.year}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-primary)", textAlign: "center" }}>{b.earned}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#f59e0b", textAlign: "center" }}>{b.used}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", fontWeight: 700, color: b.remaining > 0 ? "#10b981" : "#ef4444", textAlign: "center" }}>{b.remaining}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
