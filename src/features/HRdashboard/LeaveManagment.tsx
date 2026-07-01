import type { ReactNode } from "react";

import {
  Download,
  CheckCircle2,
  Clock3,
  XCircle,
  UserCircle2,
  CalendarDays,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import PaginationControls from "../../components/PaginationControls";
import {
  hrPageWrap,
  card,
  textPrimary,
  textSecondary,
  inputMuted,
  btnPrimary,
  tableHead,
  getStatusStyle,
  rowHover,
} from "./hrTheme";
import {
  fetchHrLeaves,
  getLocalHrLeaves,
  updateHrLeaveStatus,
} from "../../services/leaveApi";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";

type LeaveRequest = {
  id: string;
  employee: string;
  employee_id?: string;
  employee_role?: string;
  type: string;
  days: number;
  status: string;
  internal_status?: string;
  department: string;
  date: string;
  reason?: string;
};

const statusIcons: Record<string, ReactNode> = {
  Approved: <CheckCircle2 size={13} />,
  Pending: <Clock3 size={13} />,
  Rejected: <XCircle size={13} />,
};

// Derive manager status from internal_status
function getManagerStatus(ist?: string, employeeRole?: string): string {
  if (employeeRole === "hr" || employeeRole === "manager") return "N/A";
  if (ist === "manager_approved" || ist === "hr_pending" || ist === "admin_pending" || ist === "approved" || ist === "rejected") return "Approved";
  if (ist === "manager_rejected") return "Rejected";
  return "Pending";
}

function getLeaveYear(date?: string) {
  if (!date) return "";
  const isoYear = date.match(/^\d{4}/)?.[0];
  if (isoYear) return isoYear;
  return date.match(/\d{4}/)?.[0] || "";
}

function canUserAct(internalStatus?: string, employeeRole?: string) {
  const currentUserRole = localStorage.getItem("hr_userRole") || localStorage.getItem("userRole") || "hr";

  if (currentUserRole === "admin") {
    return internalStatus === "admin_pending";
  }

  // HR can approve Manager's requests at hr_pending stage, and Employee's requests at manager_approved or hr_pending stage
  if (employeeRole === "manager") {
    return internalStatus === "hr_pending";
  }
  return internalStatus === "manager_approved" || internalStatus === "hr_pending";
}

function getHrStatus(status?: string, employeeRole?: string): string {
  if (employeeRole === "hr") return "N/A";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

function getOverallStatus(status?: string) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";

  if (status === "manager_approved" || status === "hr_pending" || status === "admin_pending") {
    return "Mgr Approved";
  }

  if (status === "manager_rejected") {
    return "Mgr Rejected";
  }

  return "Pending";
}

export default function ModernLeaveManagement() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [, setApiError] = useState("");

  const [search] = useTopHeaderSearch();
  const [statusFilter, setStatusFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [submitting, setSubmitting] = useState<string | null>(null);

  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // ── Reason modal state ────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<"Approved" | "Rejected">("Approved");
  const [modalLeaveId, setModalLeaveId] = useState<string>("");
  const [modalEmployeeName, setModalEmployeeName] = useState<string>("");
  const [modalLeaveType, setModalLeaveType] = useState<string>("");
  const [modalReason, setModalReason] = useState<string>("");
  useEffect(() => {
    let isMounted = true;

    async function loadHrLeaves() {
      try {
        const apiLeaves = await fetchHrLeaves();
        if (isMounted) {
          setLeaveRequests(apiLeaves);
          setApiError("");
        }
      } catch (error) {
        const localLeaves = getLocalHrLeaves();
        if (isMounted) {
          setLeaveRequests(localLeaves);
          setApiError(
            error instanceof Error
              ? error.message
              : "Unable to fetch leave requests",
          );
        }
      }
    }

    loadHrLeaves();
    const handleFocus = () => loadHrLeaves();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleFocus);
    window.addEventListener("zenvora-leave-updated", handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleFocus);
      window.removeEventListener("zenvora-leave-updated", handleFocus);
    };
  }, []);

  // Reset to page 1 whenever filters or search change
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, yearFilter]);

  const filteredLeaves = useMemo(() => {
    return leaveRequests.filter((leave) => {
      const matchesSearch =
        leave.employee.toLowerCase().includes(search.toLowerCase()) ||
        leave.department.toLowerCase().includes(search.toLowerCase()) ||
        leave.type.toLowerCase().includes(search.toLowerCase());

      const ist = leave.internal_status;
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Mgr Pending" && ist === "manager_pending") ||
        (statusFilter === "Mgr Approved" && (ist === "manager_approved" || ist === "hr_pending" || ist === "admin_pending")) ||
        (statusFilter === "Mgr Rejected" && ist === "manager_rejected") ||
        (statusFilter === "Approved" && ist === "approved") ||
        (statusFilter === "Rejected" && ist === "rejected");

      const matchesYear =
        yearFilter === "All" || getLeaveYear(leave.date) === yearFilter;

      return matchesSearch && matchesStatus && matchesYear;
    });
  }, [leaveRequests, search, statusFilter, yearFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / PAGE_SIZE));
  const effectivePage = Math.min(currentPage, totalPages);
  const paginatedLeaves = filteredLeaves.slice(
    (effectivePage - 1) * PAGE_SIZE,
    effectivePage * PAGE_SIZE,
  );

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    const years = leaveRequests
      .map((leave) => getLeaveYear(leave.date))
      .filter(Boolean);

    return Array.from(new Set([currentYear, ...years])).sort(
      (a, b) => Number(b) - Number(a),
    );
  }, [leaveRequests]);

  const handleStatusChange = async (
    leaveId: string,
    status: "Approved" | "Rejected",
    reason?: string,
  ) => {
    const previousLeaves = leaveRequests;
    setSubmitting(leaveId);
    setLeaveRequests((prev) =>
      prev.map((leave) =>
        leave.id === leaveId
          ? { ...leave, internal_status: status === "Approved" ? "approved" : "rejected" }
          : leave,
      ),
    );
    try {
      await updateHrLeaveStatus(
        leaveId,
        status === "Approved" ? "approved" : "rejected",
        reason,
      );
    } catch {
      setLeaveRequests(previousLeaves);
    } finally {
      setSubmitting(null);
    }
  };

  // Open the reason modal for Approve or Reject
  const openModal = (
    leaveId: string,
    action: "Approved" | "Rejected",
    employeeName: string,
    leaveType: string,
  ) => {
    setModalLeaveId(leaveId);
    setModalAction(action);
    setModalEmployeeName(employeeName);
    setModalLeaveType(leaveType);
    setModalReason("");
    setModalOpen(true);
  };

  const confirmModal = async () => {
    const reason = modalReason.trim();
    if (reason.length < 3) {
      alert("Reason/comment must be at least 3 characters.");
      return;
    }
    setModalOpen(false);
    await handleStatusChange(modalLeaveId, modalAction, reason);
  };

  const exportCSV = () => {
    const headers = [
      "Employee",
      "Department",
      "Leave Type",
      "Days",
      "Status",
      "Date",
    ];

    const rows = filteredLeaves.map((leave) => [
      leave.employee,
      leave.department,
      leave.type,
      leave.days,
      getOverallStatus(leave.internal_status),
      leave.date,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.setAttribute("download", "leave-requests.csv");

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`${hrPageWrap} max-w-[1600px] mx-auto`}>

      {/* ── REASON MODAL ─────────────────────────────────────────── */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: "1rem" }}>
          <div style={{ width: "100%", maxWidth: 480, borderRadius: "1rem", overflow: "hidden", background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {modalAction === "Approved" ? "Approve Leave" : "Reject Leave"}
                </h3>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {modalEmployeeName} — {modalLeaveType}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: "1.25rem", lineHeight: 1, padding: "0.25rem" }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "1.25rem 1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                {modalAction === "Approved" ? "Reason for approving" : "Reason for rejecting"} *
              </label>
              <textarea
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                rows={4}
                placeholder={modalAction === "Approved" ? "Reason for approving this leave" : "Reason for rejecting this leave"}
                style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.875rem", resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                autoFocus
              />
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{ padding: "0.6rem 1.25rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmModal}
                disabled={!modalReason.trim()}
                style={{
                  padding: "0.6rem 1.5rem", borderRadius: "0.5rem", border: "none",
                  background: modalAction === "Approved" ? "#10b981" : "#ef4444",
                  color: "#fff", fontSize: "0.875rem", fontWeight: 700,
                  cursor: !modalReason.trim() ? "not-allowed" : "pointer",
                  opacity: !modalReason.trim() ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: "0.4rem",
                }}
              >
                {modalAction === "Approved"
                  ? <><CheckCircle2 size={15} /> Approve</>
                  : <><XCircle size={15} /> Reject</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-4 flex justify-end">
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
          style={btnPrimary}
        >
          <Download size={15} />
          Leave Balance Sheet
        </button>
      </div>

      <div className="rounded-2xl p-4 shadow-sm mb-5" style={card}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            className="rounded-lg px-6 py-4 text-sm font-semibold"
            style={btnPrimary}
          >
            All Leave Requests
          </button>
        </div>
      </div>
      <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <p className="text-sm font-semibold" style={textSecondary}>
          {filteredLeaves.length} leave requests
        </p>

        <div className="flex flex-wrap items-center gap-3 justify-end mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-2xl text-sm outline-none min-w-[160px]"
            style={inputMuted}
          >
            <option value="All">All Status</option>
            <option value="Mgr Pending">Mgr Pending</option>
            <option value="Mgr Approved">Mgr Approved</option>
            <option value="Mgr Rejected">Mgr Rejected</option>
            <option value="Approved">HR Approved</option>
            <option value="Rejected">HR Rejected</option>
          </select>

          <div className="relative">
            <CalendarDays
              size={15}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
              style={textSecondary}
            />
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="rounded-2xl py-2.5 pl-10 pr-4 text-sm outline-none min-w-[130px]"
              style={inputMuted}
            >
              <option value="All">All Years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* DESKTOP TABLE */}
      <div
        className="hidden lg:block rounded-2xl shadow-sm overflow-hidden"
        style={card}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr style={tableHead}>
                {[
                  "Employee",
                  "Leave Type",
                  "Period",
                  "Status",
                  "Manager",
                  "HR",
                  "Action",
                ].map((col) => (
                  <th
                    key={col}
                    className={`px-5 py-4 text-xs font-semibold ${col === "Action" ? "text-right" : "text-left"}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {paginatedLeaves.map((leave) => {
                const _ist = leave.internal_status;
                const _canAct = canUserAct(_ist, leave.employee_role);
                const _isApproved = _ist === "approved";
                const _isRejected = _ist === "rejected";
                return (
                  <tr
                    key={leave.id}
                    style={{
                      borderTop: "1px solid var(--border)",
                    }}
                    {...rowHover}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{
                            background: "rgba(59,130,246,0.12)",
                            color: "#3b82f6",
                          }}
                        >
                          <UserCircle2 size={20} />
                        </div>

                        <div>
                          <div
                            className="font-semibold text-sm"
                            style={textPrimary}
                          >
                            {leave.employee}
                          </div>

                          <div className="text-xs" style={textSecondary}>
                            {leave.employee_id || "Employee ID unavailable"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm" style={textSecondary}>
                      <div
                        className="px-3 py-1.5 rounded-xl text-xs font-medium inline-flex"
                        style={inputMuted}
                      >
                        {leave.type}
                      </div>
                    </td>

                    <td
                      className="px-5 py-4 text-sm font-semibold"
                      style={textPrimary}
                    >
                      <div>{leave.date}</div>
                      <div
                        className="text-xs font-medium mt-1"
                        style={textSecondary}
                      >
                        {leave.days} {leave.days === 1 ? "day" : "days"}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {(() => {
                        const overall = getOverallStatus(leave.internal_status);
                        const styleKey = overall === "Mgr Approved" ? "Approved" : overall === "Mgr Rejected" ? "Rejected" : overall === "Pending" ? "Pending" : overall;
                        return (
                          <div
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                            style={getStatusStyle(styleKey as "Approved" | "Rejected" | "Pending")}
                          >
                            {statusIcons[styleKey] ?? statusIcons["Pending"]}
                            {overall}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="px-5 py-4">
                      {(() => {
                        const ms = getManagerStatus(leave.internal_status, leave.employee_role);
                        const color = ms === "Approved" ? "#10b981" : ms === "Rejected" ? "#ef4444" : "#f59e0b";
                        return <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>{ms}</span>;
                      })()}
                    </td>

                    <td className="px-5 py-4">
                      {(() => {
                        const hs = getHrStatus(leave.internal_status, leave.employee_role);
                        const color = hs === "Approved" ? "#10b981" : hs === "Rejected" ? "#ef4444" : "#f59e0b";
                        return <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>{hs}</span>;
                      })()}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {_isApproved || _ist === 'manager_approved' || _ist === 'hr_pending' || _ist === 'admin_pending' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}><CheckCircle2 size={13} /> Approved</span>
                        ) : _isRejected || _ist === 'manager_rejected' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}><XCircle size={13} /> Rejected</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}><Clock3 size={13} /> Pending</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                );
              })}

              {filteredLeaves.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-10 text-sm"
                    style={textSecondary}
                  >
                    No leave requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE CARDS */}
      <div className="grid grid-cols-1 gap-4 lg:hidden">
        {paginatedLeaves.map((leave) => {
          const _mist = leave.internal_status;
          const _mCanAct = canUserAct(_mist, leave.employee_role);
          const _mIsApproved = _mist === "approved";
          const _mIsRejected = _mist === "rejected";
          return (
            <div
              key={leave.id}
              className="rounded-2xl p-4 shadow-sm"
              style={card}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "rgba(59,130,246,0.12)",
                      color: "#3b82f6",
                    }}
                  >
                    <UserCircle2 size={20} />
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm" style={textPrimary}>
                      {leave.employee}
                    </h3>

                    <p className="text-xs" style={textSecondary}>
                      {leave.department}
                    </p>
                  </div>
                </div>

                {(() => {
                  const overall = getOverallStatus(leave.internal_status);
                  const styleKey = overall === "Mgr Approved" || overall === "Approved" ? "Approved" : overall === "Mgr Rejected" || overall === "Rejected" ? "Rejected" : "Pending";
                  return (
                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold" style={getStatusStyle(styleKey as "Approved" | "Rejected" | "Pending")}>
                      {statusIcons[styleKey]}
                      {overall}
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <p className="text-xs mb-1" style={textSecondary}>
                    Leave Type
                  </p>

                  <div
                    className="px-3 py-2 rounded-xl text-xs inline-flex"
                    style={inputMuted}
                  >
                    {leave.type}
                  </div>
                </div>

                <div>
                  <p className="text-xs mb-1" style={textSecondary}>
                    Duration
                  </p>

                  <p className="text-sm font-semibold" style={textPrimary}>
                    {leave.days} Days
                  </p>
                </div>

                <div>
                  <p className="text-xs mb-1" style={textSecondary}>
                    Date
                  </p>

                  <p className="text-sm" style={textPrimary}>
                    {leave.date}
                  </p>
                </div>

                <div>
                  <p className="text-xs mb-1" style={textSecondary}>
                    Employee ID
                  </p>

                  <p className="text-sm" style={textPrimary}>
                    {leave.employee_id || "Employee ID unavailable"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                {_mIsApproved || _mist === 'manager_approved' || _mist === 'hr_pending' || _mist === 'admin_pending' ? (
                  <div className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                    <CheckCircle2 size={14} /> Approved
                  </div>
                ) : _mIsRejected || _mist === 'manager_rejected' ? (
                  <div className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                    <XCircle size={14} /> Rejected
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                    <Clock3 size={14} /> Pending
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <PaginationControls
          currentPage={effectivePage}
          totalItems={filteredLeaves.length}
          pageSize={PAGE_SIZE}
          itemLabel="leave requests"
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}