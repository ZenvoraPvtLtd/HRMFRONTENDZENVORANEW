import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, X, Loader2 } from "lucide-react";
import { fetchManagerLeaves, updateManagerLeaveStatus } from "../../../services/leaveApi";
import type { HrLeaveRequest } from "../../../services/leaveApi";
import API_BASE_URL from "../../../config/apiConfig";
import { SEARCH_EVENT } from "../../../components/layout/TopHeader";
import PaginationControls from "../../../components/PaginationControls";

type DecisionStatus = "manager_approved" | "manager_rejected";

type LeaveWithStatus = HrLeaveRequest & {
  decision?: DecisionStatus;
};

type ReviewDialog = {
  leave: LeaveWithStatus;
  status: DecisionStatus;
};



export default function ApprovalsPage() {
  const [leaves, setLeaves] = useState<LeaveWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [reviewDialog, setReviewDialog] = useState<ReviewDialog | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const PAGE_SIZE = 10;
  const [leavePage, setLeavePage] = useState(1);

  // Sync with TopHeader search bar
  useEffect(() => {
    const handler = (e: Event) => setSearch((e as CustomEvent<string>).detail || "");
    window.addEventListener(SEARCH_EVENT, handler);
    return () => window.removeEventListener(SEARCH_EVENT, handler);
  }, []);

  // Reset to page 1 when search changes
  useEffect(() => { setLeavePage(1); }, [search]);

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

  useEffect(() => {
    const id = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(id);
  }, []);

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

  const q = search.trim().toLowerCase();
  const filteredLeaves = q
    ? leaves.filter((l) => [(l.employee ?? ""), (l.type ?? ""), (l.department ?? "")].some((v) => v.toLowerCase().includes(q)))
    : leaves;

  const totalLeavePages = Math.max(1, Math.ceil(filteredLeaves.length / PAGE_SIZE));
  const effectiveLeavePage = Math.min(leavePage, totalLeavePages);
  const paginatedLeaves = filteredLeaves.slice(
    (effectiveLeavePage - 1) * PAGE_SIZE,
    effectiveLeavePage * PAGE_SIZE,
  );

  const needsAction = leaves.filter((l) => !l.decision && (!l.internal_status || l.internal_status === "manager_pending")).length;
  const total = leaves.length;

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
            {needsAction} Needs Your Action
          </span>
          <span
            className="px-4 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            {total} Total Leaves
          </span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto w-full" style={{ minWidth: 0 }}>
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
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm" style={{ color: "var(--text-secondary)" }}>
                    No results match your search
                  </td>
                </tr>
              ) : (
                  paginatedLeaves.map((leave) => {
                  const internalStatus = leave.decision ?? leave.internal_status ?? "manager_pending";
                  const isPending = internalStatus === "manager_pending";
                  const isApproved = ["manager_approved", "hr_pending", "admin_pending", "approved"].includes(internalStatus);

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
        {totalLeavePages > 1 && (
          <PaginationControls
            currentPage={effectiveLeavePage}
            totalItems={filteredLeaves.length}
            pageSize={PAGE_SIZE}
            itemLabel="leave requests"
            onPageChange={setLeavePage}
          />
        )}
      </div>

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
    </div>
  );
}
