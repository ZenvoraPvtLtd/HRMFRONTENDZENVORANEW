import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, X, Loader2 } from "lucide-react";
import { fetchManagerLeaves, updateManagerLeaveStatus } from "../../../services/leaveApi";
import type { HrLeaveRequest } from "../../../services/leaveApi";
import API_BASE_URL from "../../../config/apiConfig";
import { SEARCH_EVENT } from "../../../components/layout/TopHeader";

type DecisionStatus = "manager_approved" | "manager_rejected";

type LeaveWithStatus = HrLeaveRequest & {
  decision?: DecisionStatus;
};

type ReviewDialog = {
  leave: LeaveWithStatus;
  status: DecisionStatus;
};

type TimesheetApproval = {
  employeeId?: string;
  employee?: string;
  attendanceCount?: number;
  hours?: number;
  employee_id: string;
  employee_name: string;
  department: string;
  month: number;
  year: number;
  total_hours: number;
  working_days: number;
  status: string;
  submitted_at?: string;
  comment?: string;
};

type TimesheetReviewDialog = {
  timesheet: TimesheetApproval;
  status: "Approved" | "Rejected";
};

export default function ApprovalsPage() {
  const [leaves, setLeaves] = useState<LeaveWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"leave" | "timesheet">("leave");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [reviewDialog, setReviewDialog] = useState<ReviewDialog | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [timesheets, setTimesheets] = useState<TimesheetApproval[]>([]);
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [timesheetError, setTimesheetError] = useState<string | null>(null);
  const [timesheetMonth, setTimesheetMonth] = useState(new Date().getMonth() + 1);
  const [timesheetYear, setTimesheetYear] = useState(new Date().getFullYear());
  const [timesheetReviewDialog, setTimesheetReviewDialog] = useState<TimesheetReviewDialog | null>(null);
  const [timesheetReviewComment, setTimesheetReviewComment] = useState("");
  const [timesheetReviewError, setTimesheetReviewError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Sync with TopHeader search bar
  useEffect(() => {
    const handler = (e: Event) => setSearch((e as CustomEvent<string>).detail || "");
    window.addEventListener(SEARCH_EVENT, handler);
    return () => window.removeEventListener(SEARCH_EVENT, handler);
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManagerLeaves();
      setLeaves(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load leaves";
      console.error("[ApprovalsPage] fetchManagerLeaves failed:", err);
      setError(msg);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }

  const loadTimesheets = useCallback(async () => {
    setTimesheetLoading(true);
    setTimesheetError(null);
    try {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("manager_accessToken") || "";
      const res = await fetch(`${API_BASE_URL}/api/timesheets/approvals?month=${timesheetMonth}&year=${timesheetYear}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load timesheets");
      }
      const data = await res.json();
      setTimesheets(data.data || []);
    } catch (err) {
      console.error("[ApprovalsPage] loadTimesheets failed:", err);
      setTimesheetError(err instanceof Error ? err.message : "Failed to load timesheets");
      setTimesheets([]);
    } finally {
      setTimesheetLoading(false);
    }
  }, [timesheetMonth, timesheetYear]);

  useEffect(() => {
    const id = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (activeTab === "timesheet") {
      const id = window.setTimeout(() => { void loadTimesheets(); }, 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [activeTab, loadTimesheets]);


  function openReviewDialog(leave: LeaveWithStatus, status: DecisionStatus) {
    setReviewDialog({ leave, status });
    setReviewReason("");
    setReviewError(null);
  }

  function closeReviewDialog() {
    if (submitting) return;
    setReviewDialog(null);
    setReviewReason("");
    setReviewError(null);
  }

  async function handleDecision() {
    if (!reviewDialog) return;

    const reason = reviewReason.trim();
    if (reason.length < 3) {
      setReviewError("Please enter a reason with at least 3 characters.");
      return;
    }

    const { leave, status } = reviewDialog;
    setSubmitting(leave.id);
    setReviewError(null);
    try {
      await updateManagerLeaveStatus(leave.id, status, reason);
      setLeaves((prev) =>
        prev.map((l) => l.id === leave.id ? { ...l, decision: status, internal_status: status, manager_comment: reason } : l)
      );
      setReviewDialog(null);
      setReviewReason("");
      setReviewError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update. Please try again.";
      setReviewError(msg);
    } finally {
      setSubmitting(null);
    }
  }

  const needsAction = leaves.filter((l) => !l.decision && (!l.internal_status || l.internal_status === "manager_pending")).length;
  const total = leaves.length;
  const pendingTimesheets = timesheets.filter((t) => t.status === "Submitted" || t.status === "Pending").length;

  const tabs = [
    { key: "leave" as const, label: `Leave Requests (${total})` },
    { key: "timesheet" as const, label: `Timesheets (${timesheets.length})` },
  ];

  async function handleTimesheetDecision() {
    if (!timesheetReviewDialog) return;

    const { timesheet, status } = timesheetReviewDialog;
    const employeeId = timesheet.employeeId || timesheet.employee_id;
    setSubmitting(employeeId || null);
    setTimesheetReviewError(null);
    try {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("manager_accessToken") || "";
      const res = await fetch(`${API_BASE_URL}/api/timesheets/approvals/${employeeId}/status?month=${timesheetMonth}&year=${timesheetYear}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, comment: timesheetReviewComment }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update timesheet");
      }
      setTimesheets((prev) =>
        prev.map((t) => (t.employeeId || t.employee_id) === employeeId ? { ...t, status, comment: timesheetReviewComment } : t)
      );
      setTimesheetReviewDialog(null);
      setTimesheetReviewComment("");
    } catch (err) {
      setTimesheetReviewError(err instanceof Error ? err.message : "Failed to update timesheet");
    } finally {
      setSubmitting(null);
    }
  }

  function openTimesheetReview(timesheet: TimesheetApproval, status: "Approved" | "Rejected") {
    setTimesheetReviewDialog({ timesheet, status });
    setTimesheetReviewComment("");
    setTimesheetReviewError(null);
  }

  function closeTimesheetReview() {
    if (submitting) return;
    setTimesheetReviewDialog(null);
    setTimesheetReviewComment("");
    setTimesheetReviewError(null);
  }

  // Optimized percentage widths summing perfectly to 100%
  const columns = [
    { label: "Employee", width: "16%" },
    { label: "Leave Type", width: "16%" },
    { label: "Start Date", width: "11%" },
    { label: "End Date", width: "11%" },
    { label: "Days", width: "6%" },
    { label: "Reason", width: "18%" },
    { label: "Status", width: "10%" },
    { label: "Actions", width: "12%" },
  ];

  return (
    <div className="w-full px-4 pb-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-end mb-6 gap-2">
          <span
            className="px-4 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            {activeTab === "leave" ? needsAction : pendingTimesheets} Needs Your Action
          </span>
          <span
            className="px-4 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            {activeTab === "leave" ? `${total} Total Leaves` : `${timesheets.length} Timesheets`}
          </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: activeTab === tab.key ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: activeTab === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {activeTab === "leave" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto w-full">
            <table className="w-full" style={{ minWidth: "800px" }}> 
              <thead>
                <tr className="table-header-row" style={{ borderBottom: "1px solid var(--border)" }}>
                  {columns.map((col) => (
                    <th
                      key={col.label}
                      className="px-4 py-4 text-left text-xs font-semibold tracking-wider"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td colSpan={8} className="px-4 py-4">
                          <div className="h-5 animate-pulse rounded" style={{ background: "var(--bg-hover)" }} />
                        </td>
                      </tr>
                    ))}
                  </>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-sm" style={{ color: "#ef4444" }}>
                      {error}
                    </td>
                  </tr>
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-sm" style={{ color: "var(--text-secondary)" }}>
                      No leave requests found
                    </td>
                  </tr>
                ) : (
                    leaves.map((leave) => {
                      const q = search.trim().toLowerCase();
                      if (q && ![(leave.employee ?? ""), (leave.type ?? ""), (leave.department ?? "")].some(v => v.toLowerCase().includes(q))) return null;
                    // Determine effective status: local decision takes priority, else use internal_status from API
                    const internalStatus = leave.decision ?? leave.internal_status ?? "manager_pending";
                    const isPending = internalStatus === "manager_pending";
                    const isApproved = internalStatus === "manager_approved";

                    return (
                      <tr key={leave.id} className="transition-colors hover:bg-[rgba(255,255,255,0.02)]" style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-4 py-4 text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {leave.employee}
                        </td>
                        <td className="px-4 py-4 text-sm truncate" style={{ color: "var(--text-primary)" }}>
                          {leave.type}
                        </td>
                        <td className="px-4 py-4 text-sm whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          {leave.date || "—"}
                        </td>
                        <td className="px-4 py-4 text-sm whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                          {leave.date || "—"}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {leave.days}
                        </td>
                        <td className="px-4 py-4 text-sm truncate" style={{ color: "var(--text-secondary)" }} title={leave.reason}>
                          {leave.reason || "—"}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {isPending ? (
                            <span
                              className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap"
                              style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                            >
                              Pending
                            </span>
                          ) : isApproved ? (
                            <span
                              className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap"
                              style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
                            >
                              Approved
                            </span>
                          ) : (
                            <span
                              className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap"
                              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
                            >
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4" style={{ whiteSpace: "nowrap" }}>
                          <div className="flex items-center gap-1.5 justify-start">
                            <button
                              onClick={() => isPending ? openReviewDialog(leave, "manager_approved") : undefined}
                              disabled={!isPending || submitting === leave.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
                              style={
                                isApproved
                                  ? { background: "rgba(16,185,129,0.18)", color: "#10b981", border: "1px solid rgba(16,185,129,0.4)", opacity: 1 }
                                  : isPending
                                  ? { background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)", cursor: "pointer" }
                                  : { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", opacity: 0.4 }
                              }
                            >
                              <CheckCircle2 size={12} /> Approve
                            </button>
                            <button
                              onClick={() => isPending ? openReviewDialog(leave, "manager_rejected") : undefined}
                              disabled={!isPending || submitting === leave.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
                              style={
                                !isPending && !isApproved
                                  ? { background: "rgba(239,68,68,0.18)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", opacity: 1 }
                                  : isPending
                                  ? { background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", cursor: "pointer" }
                                  : { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", opacity: 0.4 }
                              }
                            >
                              <XCircle size={12} /> Reject
                            </button>
                          </div>
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

      {/* Timesheet Tab */}
      {activeTab === "timesheet" && (
        <div>
          {/* Month/Year Selector */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={timesheetMonth}
              onChange={(e) => setTimesheetMonth(Number(e.target.value))}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString("default", { month: "long" })}
                </option>
              ))}
            </select>
            <select
              value={timesheetYear}
              onChange={(e) => setTimesheetYear(Number(e.target.value))}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
            <button
              onClick={loadTimesheets}
              disabled={timesheetLoading}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              {timesheetLoading ? <Loader2 size={14} className="animate-spin" /> : "Load"}
            </button>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="table-header-row" style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Employee", "Department", "Working Days", "Total Hours", "Status", "Actions"].map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-semibold">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timesheetLoading ? (
                    <>
                      {[1, 2, 3].map((i) => (
                        <tr key={i}>
                          <td colSpan={6} className="px-4 py-4">
                            <div className="h-5 animate-pulse rounded" style={{ background: "var(--bg-hover)" }} />
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : timesheetError ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-sm" style={{ color: "#ef4444" }}>
                        {timesheetError}
                      </td>
                    </tr>
                  ) : timesheets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-sm" style={{ color: "var(--text-secondary)" }}>
                        No timesheet submissions for {new Date(2000, timesheetMonth - 1).toLocaleString("default", { month: "long" })} {timesheetYear}
                      </td>
                    </tr>
                  ) : (
                    timesheets.map((ts) => {
                      const q = search.trim().toLowerCase();
                      if (q && ![(ts.employee ?? ""), (ts.department ?? ""), (ts.status ?? "")].some(v => v.toLowerCase().includes(q))) return null;
                      const isPending = ts.status === "Submitted" || ts.status === "Pending";
                      const isApproved = ts.status === "Approved";

                      return (
                        <tr key={ts.employeeId || ts.employee_id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {ts.employee || ts.employee_name || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                            {ts.department || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: "var(--text-primary)" }}>
                            {ts.attendanceCount ?? ts.working_days ?? 0}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: "var(--text-primary)" }}>
                            {(Number(ts.hours ?? ts.total_hours) || 0).toFixed(1)}h
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {isPending ? (
                              <span className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                                {ts.status}
                              </span>
                            ) : isApproved ? (
                              <span className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                                Approved
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => isPending ? openTimesheetReview(ts, "Approved") : undefined}
                                disabled={!isPending || submitting === (ts.employeeId || ts.employee_id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                style={
                                  isApproved
                                    ? { background: "rgba(16,185,129,0.18)", color: "#10b981", border: "1px solid rgba(16,185,129,0.4)" }
                                    : isPending
                                    ? { background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)", cursor: "pointer" }
                                    : { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", opacity: 0.4 }
                                }
                              >
                                <CheckCircle2 size={13} /> Approve
                              </button>
                              <button
                                onClick={() => isPending ? openTimesheetReview(ts, "Rejected") : undefined}
                                disabled={!isPending || submitting === (ts.employeeId || ts.employee_id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                style={
                                  !isPending && !isApproved
                                    ? { background: "rgba(239,68,68,0.18)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }
                                    : isPending
                                    ? { background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", cursor: "pointer" }
                                    : { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", opacity: 0.4 }
                                }
                              >
                                <XCircle size={13} /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {reviewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.58)" }}>
          <div className="w-full max-w-md rounded-xl p-5 shadow-2xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">
                  {reviewDialog.status === "manager_approved" ? "Approve Leave" : "Reject Leave"}
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {reviewDialog.leave.employee} - {reviewDialog.leave.type}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReviewDialog}
                disabled={submitting === reviewDialog.leave.id}
                className="rounded-lg p-2 transition-colors"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                aria-label="Close reason popup"
              >
                <X size={16} />
              </button>
            </div>

            <label className="mb-2 block text-sm font-medium" htmlFor="manager-review-reason">
              Manager reason
            </label>
            <textarea
              id="manager-review-reason"
              value={reviewReason}
              onChange={(event) => {
                setReviewReason(event.target.value);
                if (reviewError) setReviewError(null);
              }}
              rows={4}
              autoFocus
              placeholder={reviewDialog.status === "manager_approved" ? "Reason for approving this leave" : "Reason for rejecting this leave"}
              className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            {reviewError && (
              <p className="mt-2 text-sm" style={{ color: "#ef4444" }}>
                {reviewError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeReviewDialog}
                disabled={submitting === reviewDialog.leave.id}
                className="rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecision}
                disabled={submitting === reviewDialog.leave.id}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{
                  background: reviewDialog.status === "manager_approved" ? "rgba(16,185,129,0.16)" : "rgba(239,68,68,0.16)",
                  border: reviewDialog.status === "manager_approved" ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(239,68,68,0.35)",
                  color: reviewDialog.status === "manager_approved" ? "#10b981" : "#ef4444",
                }}
              >
                {reviewDialog.status === "manager_approved" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                {submitting === reviewDialog.leave.id ? "Saving..." : reviewDialog.status === "manager_approved" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timesheet Review Dialog */}
      {timesheetReviewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.58)" }}>
          <div className="w-full max-w-md rounded-xl p-5 shadow-2xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">
                  {timesheetReviewDialog.status === "Approved" ? "Approve Timesheet" : "Reject Timesheet"}
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {timesheetReviewDialog.timesheet.employee ?? timesheetReviewDialog.timesheet.employee_name} - {(Number(timesheetReviewDialog.timesheet.total_hours) || 0).toFixed(1)}h
                </p>
              </div>
              <button
                type="button"
                onClick={closeTimesheetReview}
                disabled={submitting === (timesheetReviewDialog.timesheet.employeeId || timesheetReviewDialog.timesheet.employee_id)}
                className="rounded-lg p-2 transition-colors"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                <X size={16} />
              </button>
            </div>

            <label className="mb-2 block text-sm font-medium">
              Comment (optional)
            </label>
            <textarea
              value={timesheetReviewComment}
              onChange={(e) => {
                setTimesheetReviewComment(e.target.value);
                if (timesheetReviewError) setTimesheetReviewError(null);
              }}
              rows={3}
              autoFocus
              placeholder={timesheetReviewDialog.status === "Approved" ? "Add approval note" : "Reason for rejection"}
              className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            {timesheetReviewError && (
              <p className="mt-2 text-sm" style={{ color: "#ef4444" }}>
                {timesheetReviewError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeTimesheetReview}
                disabled={submitting === (timesheetReviewDialog.timesheet.employeeId || timesheetReviewDialog.timesheet.employee_id)}
                className="rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTimesheetDecision}
                disabled={submitting === (timesheetReviewDialog.timesheet.employeeId || timesheetReviewDialog.timesheet.employee_id)}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{
                  background: timesheetReviewDialog.status === "Approved" ? "rgba(16,185,129,0.16)" : "rgba(239,68,68,0.16)",
                  border: timesheetReviewDialog.status === "Approved" ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(239,68,68,0.35)",
                  color: timesheetReviewDialog.status === "Approved" ? "#10b981" : "#ef4444",
                }}
              >
                {timesheetReviewDialog.status === "Approved" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                {submitting === (timesheetReviewDialog.timesheet.employeeId || timesheetReviewDialog.timesheet.employee_id) ? "Saving..." : timesheetReviewDialog.status}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
