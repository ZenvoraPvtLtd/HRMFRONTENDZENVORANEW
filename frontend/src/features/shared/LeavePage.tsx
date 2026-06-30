import { useState, useEffect, useCallback } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import PaginationControls from "../../components/PaginationControls";
import type { LeaveRequest, LeaveBalance, Employee } from "../../types/leave";
import LeaveStats from "./LeavePage/LeaveStats";
import ApplyLeaveModal from "./LeavePage/ApplyLeaveModel";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";
import { createLeave, deleteLeave, fetchLeaveBalance, fetchMyLeaves, updateLeave } from "../../services/leaveApi";

const DEMO_EMPLOYEE: Omit<Employee, "id" | "user_id"> = {
  name: "Employee",
  role: "Software Engineer",
  manager_name: "Ram Sakalle",
  avatar_url: "",
};

const TOTAL_ANNUAL_LEAVES = 18; // 12 casual + 6 sick, 1.5/month
const EMPTY_BALANCE = { earned: TOTAL_ANNUAL_LEAVES, used: 0, remaining: TOTAL_ANNUAL_LEAVES, year: new Date().getFullYear() };


const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB");
}

function getStatusInfo(internalStatus?: string): { label: string; style: React.CSSProperties } {
  switch (internalStatus) {
    case "hr_pending":
      return { label: "Pending HR Approval", style: { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" } };
    case "manager_pending":
      return { label: "Pending Mgr Approval", style: { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" } };
    case "admin_pending":
      return { label: "Pending Admin Approval", style: { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" } };
    case "manager_approved":
      return { label: "Mgr Approved", style: { background: "rgba(16,185,129,0.12)", color: "#10bsu81", border: "1px solid rgba(16,185,129,0.25)" } };
    case "manager_rejected":
      return { label: "Mgr Rejected", style: { background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" } };
    case "approved":
      return { label: "Approved", style: { background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" } };
    case "rejected":
      return { label: "Rejected", style: { background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" } };
    default:
      return { label: "Pending", style: { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" } };
  }
}

function LeaveStatusBadge({ internalStatus }: { internalStatus?: string }) {
  const { label, style } = getStatusInfo(internalStatus);
  return (
    <span
      className="inline-flex items-center gap-1.5 min-w-25 justify-center rounded-full px-3 py-1 text-xs font-semibold"
      style={style}
    >
      {label}
    </span>
  );
}

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const loggedInEmployeeName =
    localStorage.getItem("userName") ||
    localStorage.getItem("userEmail") ||
    "Employee";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const apiRequests = await fetchMyLeaves().catch(() => []);

      // Calculate used leaves from approved requests as fallback
      const approvedDays = apiRequests
        .filter((r) => r.status === "Approved")
        .reduce((sum, r) => sum + (r.days ?? 0), 0);

      let apiBalance = await fetchLeaveBalance().catch(() => null);
      if (!apiBalance) {
        // API offline — compute from requests
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const earnedSoFar = parseFloat((currentMonth * 1.5).toFixed(1));
        apiBalance = {
          id: "demo",
          employee_id: "demo",
          year: EMPTY_BALANCE.year,
          earned: earnedSoFar,
          used: approvedDays,
          remaining: parseFloat((earnedSoFar - approvedDays).toFixed(1)),
        };
      }

      setRequests(apiRequests);
      setBalance(apiBalance);
      setEmployee({ id: "demo", user_id: "demo", ...DEMO_EMPLOYEE, name: loggedInEmployeeName });
    } catch {
      const currentMonth = new Date().getMonth() + 1;
      const earnedSoFar = parseFloat((currentMonth * 1.5).toFixed(1));
      setRequests([]);
      setBalance({
        id: "demo",
        employee_id: "demo",
        year: EMPTY_BALANCE.year,
        earned: earnedSoFar,
        used: 0,
        remaining: earnedSoFar,
      });
      setEmployee({ id: "demo", user_id: "demo", ...DEMO_EMPLOYEE, name: loggedInEmployeeName });
    } finally {
      setLoading(false);
    }
  }, [loggedInEmployeeName]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  useEffect(() => {
    const refreshLeaves = () => {
      void loadData();
    };

    window.addEventListener("focus", refreshLeaves);
    window.addEventListener("storage", refreshLeaves);
    window.addEventListener("zenvora-leave-updated", refreshLeaves);

    return () => {
      window.removeEventListener("focus", refreshLeaves);
      window.removeEventListener("storage", refreshLeaves);
      window.removeEventListener("zenvora-leave-updated", refreshLeaves);
    };
  }, [loadData]);

  useEffect(() => {
    const handleHeaderSearch = (event: Event) => {
      setQuery((event as CustomEvent<string>).detail || "");
      setCurrentPage(1);
    };

    window.addEventListener(SEARCH_EVENT, handleHeaderSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleHeaderSearch);
  }, []);

  async function handleApplyLeave(formData: {
    leave_type: LeaveRequest["leave_type"];
    duration_type: LeaveRequest["duration_type"];
    leave_date: string;
    days: number;
    reason: string;
  }) {
    if (editingRequest) {
      const updatedReq = await updateLeave(editingRequest.id, formData);
      setRequests((prev) =>
        prev.map((request) =>
          request.id === editingRequest.id
            ? {
                ...request,
                ...updatedReq,
                status: request.status,
                applied_date: request.applied_date,
                submitted_at: request.submitted_at,
                manager_reviewed_at: request.manager_reviewed_at,
                hr_reviewed_at: request.hr_reviewed_at,
              }
            : request
        )
      );
      setEditingRequest(null);
      setShowModal(false);
      return;
    }

    if (!employee) throw new Error("No employee");
    const newReq = await createLeave(formData);
    setRequests((prev) => [newReq, ...prev]);
    setShowModal(false);
    // Refresh from API so real ID replaces any local-* ID
    void loadData();
  }

  const openCreateModal = () => {
    setEditingRequest(null);
    setShowModal(true);
  };

  const isManagerPending = (request: LeaveRequest) =>
    request.internal_status === "manager_pending" ||
    (!request.internal_status && request.status === "Pending" && request.id.startsWith("local-"));

  const openEditModal = (request: LeaveRequest) => {
    if (!isManagerPending(request)) {
      window.alert("Only pending leave requests (awaiting manager review) can be edited.");
      return;
    }

    setEditingRequest(request);
    setShowModal(true);
  };

  const handleDeleteLeave = async (request: LeaveRequest) => {
    if (!isManagerPending(request)) {
      window.alert("Only pending leave requests (awaiting manager review) can be deleted.");
      return;
    }

    const confirmed = window.confirm("Delete this leave request?");
    if (!confirmed) return;

    const previousRequests = requests;
    setRequests((prev) => prev.filter((item) => item.id !== request.id));

    try {
      await deleteLeave(request.id, request);
    } catch {
      setRequests(previousRequests);
    }
  };

  const filteredRequests = requests.filter((request) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    return [
      request.leave_type,
      request.reason,
      request.status,
      request.applied_date,
      request.leave_date,
    ].some((value) => String(value).toLowerCase().includes(q));
  });

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const paginatedRequests = filteredRequests.slice(pageStart, pageEnd);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full px-3 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6">
        <LeaveStats requests={requests} />

        <section className="mt-4 rounded-xl border p-3 shadow-sm sm:mt-5 sm:p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight sm:text-xl" style={{ color: "var(--text-primary)" }}>
                My Leave Requests
              </h1>
              {paginatedRequests.length > 0 && (
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {filteredRequests.length} leave request{filteredRequests.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Cards / Table toggle */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    background: viewMode === "cards" ? "var(--accent)" : "var(--bg-secondary)",
                    color: viewMode === "cards" ? "var(--accent-text)" : "var(--text-secondary)",
                  }}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    background: viewMode === "table" ? "var(--accent)" : "var(--bg-secondary)",
                    color: viewMode === "table" ? "var(--accent-text)" : "var(--text-secondary)",
                    borderLeft: "1px solid var(--border)",
                  }}
                >
                  Table
                </button>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-85"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                <Plus size={14} />
                Apply for Leave
              </button>
            </div>
          </div>

          <div className={`rounded-lg ${viewMode === "table" ? "block" : "hidden"}`}>
            {/* mobile scroll hint */}
            <p className="mb-1 text-right text-xs sm:hidden" style={{ color: "var(--text-secondary)" }}>
              ← scroll to see more →
            </p>
            <div className="overflow-x-auto">
            <table className="w-full min-w-160 border-separate border-spacing-0 text-sm">
              <thead>
                <tr
                  className="text-left text-sm font-semibold"
                  style={{ background: "var(--table-head-bg)", color: "var(--table-head-text)" }}
                >
                  <th className="rounded-l-lg px-3 py-3">Leave Type</th>
                  <th className="px-3 py-3">Start Date</th>
                  <th className="px-3 py-3">End Date</th>
                  <th className="px-3 py-3">Days</th>
                  <th className="px-3 py-3 hidden sm:table-cell">Reason</th>
                  <th className="px-3 py-3">Manager</th>
                  <th className="px-3 py-3">HR</th>
                  <th className="px-3 py-3">Overall Status</th>
                  <th className="rounded-r-lg px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4].map((row) => (
                    <tr key={row}>
                      <td colSpan={9} className="px-3 py-3">
                        <div className="h-7 animate-pulse rounded" style={{ background: "var(--bg-hover)" }} />
                      </td>
                    </tr>
                  ))
                ) : paginatedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                      No leave requests found
                    </td>
                  </tr>
                ) : (
                  paginatedRequests.map((request, index) => {
                    const ist = request.internal_status;
                    const managerStatus =
                      ist === "manager_approved" || ist === "approved" || ist === "rejected"
                        ? "Approved"
                        : ist === "manager_rejected"
                        ? "Rejected"
                        : "Pending";
                    const hrStatus =
                      ist === "approved"
                        ? "Approved"
                        : ist === "rejected"
                        ? "Rejected"
                        : "Pending";
                    const managerColor = managerStatus === "Approved" ? "#10b981" : managerStatus === "Rejected" ? "#ef4444" : "#f59e0b";
                    const hrColor = hrStatus === "Approved" ? "#10b981" : hrStatus === "Rejected" ? "#ef4444" : "#f59e0b";
                    const canEdit = isManagerPending(request);

                    return (
                    <tr
                      key={request.id}
                      className="text-sm"
                      style={{
                        color: "var(--text-primary)",
                        background: index % 2 === 0 ? "var(--bg-secondary)" : "var(--bg-hover)",
                      }}
                    >
                      <td className="px-3 py-3 font-medium">{request.leave_type}</td>
                      <td className="px-3 py-3">{formatDate(request.applied_date)}</td>
                      <td className="px-3 py-3">{formatDate(request.leave_date)}</td>
                      <td className="px-3 py-3">{request.days}</td>
                      <td className="px-3 py-3 hidden sm:table-cell">{request.reason || "—"}</td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-semibold" style={{ color: managerColor }}>
                          {managerStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-semibold" style={{ color: hrColor }}>
                          {hrStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <LeaveStatusBadge internalStatus={request.internal_status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEditModal(request)}
                            disabled={!canEdit}
                            className="rounded p-1 transition-colors"
                            style={{ color: canEdit ? "var(--text-primary)" : "var(--text-secondary)", opacity: canEdit ? 1 : 0.35, cursor: canEdit ? "pointer" : "not-allowed" }}
                            title={canEdit ? "Edit leave" : "Cannot edit after manager review"}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLeave(request)}
                            disabled={!canEdit}
                            className="rounded p-1 transition-colors"
                            style={{ color: canEdit ? "var(--text-primary)" : "var(--text-secondary)", opacity: canEdit ? 1 : 0.35, cursor: canEdit ? "pointer" : "not-allowed" }}
                            title={canEdit ? "Delete leave" : "Cannot delete after manager review"}
                          >
                            <Trash2 size={14} />
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

          {/* CARDS VIEW */}
          <div className={`space-y-3 ${viewMode === "cards" ? "block" : "hidden"}`}>
            {loading ? (
              [1, 2, 3].map((row) => (
                <div key={row} className="h-36 animate-pulse rounded-xl" style={{ background: "var(--bg-hover)" }} />
              ))
            ) : paginatedRequests.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                No leave requests found
              </div>
            ) : (
              paginatedRequests.map((request) => {
                const cist = request.internal_status;
                const cardManagerStatus =
                  cist === "manager_approved" || cist === "approved" || cist === "rejected"
                    ? "Approved"
                    : cist === "manager_rejected"
                    ? "Rejected"
                    : "Pending";
                const cardHrStatus =
                  cist === "approved"
                    ? "Approved"
                    : cist === "rejected"
                    ? "Rejected"
                    : "Pending";
                const managerDone = cardManagerStatus !== "Pending";
                const managerRejected = cardManagerStatus === "Rejected";
                const hrDone = cardHrStatus !== "Pending";
                const hrRejected = cardHrStatus === "Rejected";
                const canEdit = isManagerPending(request);

                return (
                  <article
                    key={request.id}
                    className="rounded-xl border p-4"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}
                  >
                    {/* Top row: leave type + status badge */}
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                        {request.leave_type}
                      </h2>
                      <LeaveStatusBadge internalStatus={request.internal_status} />
                    </div>

                    {/* Date + days + applied */}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <span className="flex items-center gap-1">
                        <span style={{ fontSize: 12 }}>📅</span>
                        {formatDate(request.leave_date)}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      >
                        {request.days} {request.days === 1 ? "day" : "days"}
                      </span>
                      <span className="text-xs">Applied {formatDate(request.applied_date)}</span>
                    </div>

                    {/* Reason */}
                    {request.reason && (
                      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {request.reason}
                      </p>
                    )}

                    {/* Progress steps: Submitted → Manager → HR */}
                    <div className="mt-3 flex items-center gap-1.5 text-xs flex-wrap">
                      {/* Submitted */}
                      <span className="flex items-center gap-1" style={{ color: "#10b981" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Submitted
                      </span>
                      <span style={{ color: "var(--border)" }}>—</span>

                      {/* Manager */}
                      <span className="flex items-center gap-1" style={{ color: managerRejected ? "#ef4444" : managerDone ? "#10b981" : "var(--text-secondary)" }}>
                        {managerDone ? (
                          managerRejected ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                        )}
                        Manager
                      </span>
                      <span style={{ color: "var(--border)" }}>—</span>

                      {/* HR */}
                      <span className="flex items-center gap-1" style={{ color: hrRejected ? "#ef4444" : hrDone ? "#10b981" : "var(--text-secondary)" }}>
                        {hrDone ? (
                          hrRejected ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                        )}
                        HR
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(request)}
                        disabled={!canEdit}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border"
                        style={{ borderColor: "var(--border)", color: canEdit ? "var(--text-primary)" : "var(--text-secondary)", opacity: canEdit ? 1 : 0.35, cursor: canEdit ? "pointer" : "not-allowed" }}
                        title={canEdit ? "Edit leave" : "Cannot edit after manager review"}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLeave(request)}
                        disabled={!canEdit}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border"
                        style={{ borderColor: "var(--border)", color: canEdit ? "var(--text-primary)" : "var(--text-secondary)", opacity: canEdit ? 1 : 0.35, cursor: canEdit ? "pointer" : "not-allowed" }}
                        title={canEdit ? "Delete leave" : "Cannot delete after manager review"}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <div
          className="mt-4 rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}
        >
          <PaginationControls
            currentPage={safeCurrentPage}
            totalItems={filteredRequests.length}
            pageSize={pageSize}
            itemLabel="entries"
            onPageChange={goToPage}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {showModal && (
        <ApplyLeaveModal
          onClose={() => {
            setShowModal(false);
            setEditingRequest(null);
          }}
          onSubmit={handleApplyLeave}
          initialData={editingRequest ? {
            leave_type: editingRequest.leave_type,
            duration_type: editingRequest.duration_type,
            leave_date: editingRequest.leave_date,
            days: editingRequest.days,
            reason: editingRequest.reason,
          } : undefined}
          mode={editingRequest ? "edit" : "create"}
        />
      )}
    </div>
  );
}

