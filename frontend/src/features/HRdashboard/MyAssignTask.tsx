import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Search,
  UserRound,
  WalletCards,
  ChevronLeft,
} from "lucide-react";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import { getFastApiBaseUrl } from "../../config/fastApiConfig";
import {
  btnPrimary,
  btnSecondary,
  card,
  cardInner,
  getStatusStyle,
  hrPageWrap,
  inputMuted,
  textPrimary,
  textSecondary,
} from "./hrTheme";

const FASTAPI_BASE_URL = getFastApiBaseUrl();
const HR_ACTIONS_API_URL = `${FASTAPI_BASE_URL}/api/hr-actions`;

type EmployeeRecord = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  department: string;
  manager: string;
  jobTitle: string;
  role: string;
  status: string;
  productivity: number;
  joinDate: string;
  createdAt: string;
};

type ActionCard = {
  title: string;
  value: string;
  detail: string;
  status: string;
};

type PendingLeave = {
  id: string;
  leave_type: string;
  leave_date: string;
  days: number;
  reason: string;
  status: string;
  internal_status: string;
};

type HrActionSummary = {
  employee: EmployeeRecord;
  cards: {
    attendance: ActionCard;
    leaveBalance: ActionCard;
    pendingRequests: ActionCard;
  };
  pendingRequests: {
    count: number;
    leaves: PendingLeave[];
    profileUpdates: unknown[];
  };
  leaveBalance?: {
    earned: number;
    used: number;
    remaining: number;
    year: number;
    exists?: boolean;
  };
};

type ActiveAction = "status" | "leave" | "balance" | "review" | null;

function normalizeEmployee(employee: Partial<EmployeeRecord>): EmployeeRecord {
  const role = employee.role || "Employee";

  return {
    id: employee.id || "",
    name: employee.name || "Unnamed Employee",
    email: employee.email || "",
    phoneNumber: employee.phoneNumber || "",
    department: employee.department || "Unassigned",
    manager: employee.manager || "-",
    jobTitle: employee.jobTitle || role,
    role,
    status: employee.status || "Active",
    productivity: Number(employee.productivity) || 0,
    joinDate: employee.joinDate || "",
    createdAt: employee.createdAt || "",
  };
}

function getAuthHeaders() {
  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("hr_accessToken") ||
    localStorage.getItem("token");
  const userRole =
    localStorage.getItem("userRole") ||
    localStorage.getItem("hr_userRole") ||
    "hr";
  const userName =
    localStorage.getItem("userName") ||
    localStorage.getItem("hr_userName") ||
    "HR";
  const userId =
    localStorage.getItem("userId") ||
    localStorage.getItem("hr_userEmail") ||
    localStorage.getItem("userEmail") ||
    "hr";

  return {
    "Content-Type": "application/json",
    "X-User-Role": userRole,
    "X-User-Name": userName,
    "X-User-Id": userId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiRequest<T>(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || data.message || "FastAPI request failed");
  }

  return data as T;
}

function buildEmptySummary(employee: EmployeeRecord): HrActionSummary {
  return {
    employee,
    cards: {
      attendance: {
        title: "Attendance",
        value: "-",
        detail: "Attendance data will load from FastAPI",
        status: "Not Started",
      },
      leaveBalance: {
        title: "Leave Balance",
        value: "-",
        detail: "Leave balance data will load from FastAPI",
        status: "Not Started",
      },
      pendingRequests: {
        title: "Pending Requests",
        value: "-",
        detail: "Pending requests will load from FastAPI",
        status: "Not Started",
      },
    },
    pendingRequests: {
      count: 0,
      leaves: [],
      profileUpdates: [],
    },
    leaveBalance: {
      earned: 0,
      used: 0,
      remaining: 0,
      year: new Date().getFullYear(),
      exists: false,
    },
  };
}

function normalizeSummary(
  summary: Partial<HrActionSummary> | undefined,
  baseEmployee: EmployeeRecord,
) {
  const localSummary = buildEmptySummary(baseEmployee);
  const normalizedEmployee = normalizeEmployee(summary?.employee || baseEmployee);

  return {
    ...localSummary,
    ...summary,
    employee: normalizedEmployee,
    cards: {
      ...localSummary.cards,
      ...(summary?.cards || {}),
    },
    pendingRequests: {
      ...localSummary.pendingRequests,
      ...(summary?.pendingRequests || {}),
      leaves: summary?.pendingRequests?.leaves || [],
      profileUpdates: summary?.pendingRequests?.profileUpdates || [],
    },
  };
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "E"
  );
}

function getEmployeeId(employee: EmployeeRecord) {
  return employee.id || employee.email || employee.name;
}

function normalizeStatus(status: string) {
  const value = status.toLowerCase();
  if (value.includes("inactive")) return "Inactive";
  if (value.includes("leave")) return "On Leave";
  if (value.includes("remote")) return "Remote";
  return "Active";
}

export default function MyAssignTasksPage() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [headerSearch] = useTopHeaderSearch();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    setEmployeesError("");
    try {
      const data = await apiRequest<{ data?: Partial<EmployeeRecord>[]; employees?: Partial<EmployeeRecord>[] }>(
        `${HR_ACTIONS_API_URL}/employees`,
      );
      const employeeList = Array.isArray(data)
        ? data
        : data.employees || data.data || [];
      const normalizedEmployees = employeeList.map(normalizeEmployee);

      setEmployees(normalizedEmployees);
      setSelectedEmployeeId((currentSelectedId) => {
        if (!normalizedEmployees.length) return null;
        if (
          currentSelectedId &&
          normalizedEmployees.some((employee) => getEmployeeId(employee) === currentSelectedId)
        ) {
          return currentSelectedId;
        }
        return getEmployeeId(normalizedEmployees[0]);
      });
    } catch (requestError) {
      setEmployees([]);
      setSelectedEmployeeId(null);
      setEmployeesError(requestError instanceof Error ? requestError.message : "Unable to load employees");
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchEmployees);
  }, [fetchEmployees]);

  const filteredEmployees = useMemo(() => {
    const query = [headerSearch, localSearch].join(" ").trim().toLowerCase();
    if (!query) return employees;

    return employees.filter((employee) =>
      [
        getEmployeeId(employee),
        employee.name,
        employee.email,
        employee.department,
        employee.jobTitle,
        employee.manager,
        employee.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [employees, headerSearch, localSearch]);

  const selectedEmployee =
    employees.find((employee) => {
      const id = getEmployeeId(employee);
      return id === selectedEmployeeId || employee.id === selectedEmployeeId;
    }) || null;

  const handleEmployeeUpdated = useCallback((updatedEmployee: EmployeeRecord) => {
    setEmployees((currentEmployees) =>
      currentEmployees.map((item) => {
        const id = getEmployeeId(item);
        return id === updatedEmployee.id || item.id === updatedEmployee.id
          ? normalizeEmployee({ ...item, ...updatedEmployee })
          : item;
      }),
    );
  }, []);

  return (
    <div className={`${hrPageWrap} h-full max-w-[1600px] mx-auto`}>
      {/* Desktop: 2 columns, Mobile: Conditional visibility */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        
        {/* LEFT LIST */}
        <section className={`rounded-2xl shadow-sm flex-col h-[620px] overflow-hidden ${selectedEmployee ? 'hidden lg:flex' : 'flex'}`} style={card}>
          <div className="p-5 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="text-lg font-bold" style={textPrimary}>
                  Employees
                </h1>
                <p className="text-xs mt-1" style={textSecondary}>
                  {filteredEmployees.length} employees
                </p>
              </div>

              <span
                className="min-w-9 h-8 px-3 rounded-full inline-flex items-center justify-center text-sm font-bold"
                style={getStatusStyle("In Progress")}
              >
                {employees.length}
              </span>
            </div>

            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={textSecondary}
              />
              <input
                value={localSearch}
                onChange={(event) => setLocalSearch(event.target.value)}
                placeholder="Search by name, email..."
                className="w-full rounded-lg pl-10 pr-3 py-3 text-sm outline-none"
                style={inputMuted}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {filteredEmployees.map((employee) => {
              const employeeId = getEmployeeId(employee);
              const isSelected = selectedEmployeeId === employeeId || selectedEmployeeId === employee.id;

              return (
                <button
                  key={`${employeeId}-${employee.email}`}
                  onClick={() => setSelectedEmployeeId(employeeId)}
                  className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition"
                  style={{
                    background: isSelected ? "var(--bg-hover)" : "transparent",
                    border: isSelected ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  <span
                    className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{
                      background: "var(--icon-accent-bg)",
                      color: "var(--accent)",
                    }}
                  >
                    {getInitials(employee.name)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate" style={textPrimary}>
                      {employee.name}
                    </span>
                    <span className="block text-xs truncate mt-0.5" style={textSecondary}>
                      {employee.email || employee.jobTitle}
                    </span>
                  </span>
                </button>
              );
            })}

            {employeesLoading && (
              <div className="py-12 text-center text-sm" style={textSecondary}>
                Loading employees...
              </div>
            )}

            {!employeesLoading && employeesError && (
              <div className="py-12 text-center text-sm" style={getStatusStyle("Rejected")}>
                {employeesError}
              </div>
            )}

            {!employeesLoading && !employeesError && filteredEmployees.length === 0 && (
              <div className="py-12 text-center text-sm" style={textSecondary}>
                No saved employees found
              </div>
            )}
          </div>
        </section>

        <section className={`rounded-2xl shadow-sm min-h-[620px] ${!selectedEmployee ? 'hidden lg:flex' : 'flex'}`} style={card}>
          {selectedEmployee ? (
            <EmployeeActionPanel
              key={getEmployeeId(selectedEmployee)}
              employee={selectedEmployee}
              onEmployeeUpdated={handleEmployeeUpdated}
              onBack={() => setSelectedEmployeeId(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div className="max-w-sm">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
                  style={cardInner}
                >
                  <UserRound size={32} style={textSecondary} />
                </div>
                <h2 className="text-lg font-bold" style={textPrimary}>
                  {employeesLoading ? "Loading Employees" : "Select an Employee"}
                </h2>
                <p className="text-sm leading-6 mt-2" style={textSecondary}>
                  {employeesError
                    ? employeesError
                    : employees.length
                      ? "Choose an employee from the list to view attendance, leave balance, and HR actions."
                      : "Saved employee records will appear here when FastAPI returns them."}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmployeeActionPanel({
  employee,
  onEmployeeUpdated,
  onBack,
}: {
  employee: EmployeeRecord;
  onEmployeeUpdated: (employee: EmployeeRecord) => void;
  onBack?: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const employeeRef = getEmployeeId(employee);
  const [summary, setSummary] = useState<HrActionSummary>(() => buildEmptySummary(employee));
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [statusForm, setStatusForm] = useState({
    status: normalizeStatus(employee.status),
    reason: "",
  });
  const [balanceForm, setBalanceForm] = useState({
    remainingDelta: "1",
    reason: "Manual HR adjustment",
  });
  const [reviewForm, setReviewForm] = useState({
    reviewDate: today,
    reviewType: "Performance Review",
    notes: "",
  });

  const employeeRefObj = useRef(employee);
  useEffect(() => {
    employeeRefObj.current = employee;
  }, [employee]);

  const onEmployeeUpdatedRef = useRef(onEmployeeUpdated);
  useEffect(() => {
    onEmployeeUpdatedRef.current = onEmployeeUpdated;
  }, [onEmployeeUpdated]);

  const loadSummary = useCallback(async () => {
    setSummary(buildEmptySummary(employeeRefObj.current));
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<HrActionSummary>(
        `${HR_ACTIONS_API_URL}/employees/${encodeURIComponent(employeeRef)}`,
      );
      const normalized = normalizeSummary(data, employeeRefObj.current);
      setSummary(normalized);
      onEmployeeUpdatedRef.current(normalized.employee);
    } catch (requestError) {
      setSummary(buildEmptySummary(employeeRefObj.current));
      setError(requestError instanceof Error ? requestError.message : "Unable to load HR action details");
    } finally {
      setLoading(false);
    }
  }, [employeeRef]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const panelEmployee = summary.employee || employee;
  const panelEmployeeRef = getEmployeeId(panelEmployee);
  const normalizedStatus = normalizeStatus(panelEmployee.status);
  const pendingLeaves = summary.pendingRequests.leaves || [];
  const actionCards = [
    {
      ...summary.cards.attendance,
      icon: <Clock3 size={18} />,
    },
    {
      ...summary.cards.leaveBalance,
      icon: <WalletCards size={18} />,
    },
    {
      ...summary.cards.pendingRequests,
      icon: <FileCheck2 size={18} />,
    },
  ];

  const hrReviewableLeave = pendingLeaves.find((leave) => leave.internal_status === "manager_approved");
  const selectedLeave = hrReviewableLeave || pendingLeaves[0];

  async function submitStatus() {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const data = await apiRequest<{
        message: string;
        employee: EmployeeRecord;
        summary?: HrActionSummary;
      }>(`${HR_ACTIONS_API_URL}/employees/${encodeURIComponent(panelEmployeeRef)}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: statusForm.status,
          reason: statusForm.reason,
        }),
      });
      const updatedEmployee = normalizeEmployee(data.employee || panelEmployee);
      onEmployeeUpdated(updatedEmployee);
      setSummary(normalizeSummary(data.summary, updatedEmployee));
      setMessage(data.message || "Status updated");
      setActiveAction(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update status");
    } finally {
      setSubmitting(false);
    }
  }

  async function approveLeave() {
    if (!hrReviewableLeave) {
      setError("No manager-approved leave request is available for HR review");
      setMessage("");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const data = await apiRequest<{ message: string; summary?: HrActionSummary }>(
        `${HR_ACTIONS_API_URL}/leaves/${hrReviewableLeave.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "approved",
            comment: "Approved from HR Actions",
          }),
        },
      );
      setSummary(normalizeSummary(data.summary, panelEmployee));
      setMessage(data.message || "Leave approved");
      setActiveAction(null);
      await loadSummary();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to approve leave");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitBalanceAdjustment() {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const delta = Number(balanceForm.remainingDelta);
      if (!Number.isFinite(delta)) throw new Error("Enter a valid balance adjustment");

      await apiRequest(`${HR_ACTIONS_API_URL}/employees/${encodeURIComponent(panelEmployeeRef)}/leave-balance`, {
        method: "PATCH",
        body: JSON.stringify({
          remainingDelta: delta,
          reason: balanceForm.reason,
        }),
      });
      setMessage("Leave balance updated");
      setActiveAction(null);
      await loadSummary();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to adjust leave balance");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReview() {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const data = await apiRequest<{ message: string }>(
        `${HR_ACTIONS_API_URL}/employees/${encodeURIComponent(panelEmployeeRef)}/reviews`,
        {
          method: "POST",
          body: JSON.stringify(reviewForm),
        },
      );
      setMessage(data.message || "Review scheduled");
      setActiveAction(null);
      await loadSummary();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to schedule review");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 p-5 lg:p-7 overflow-y-auto">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 pb-6 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-start gap-4 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="lg:hidden p-2 -ml-2 rounded-full shrink-0 flex items-center justify-center mt-3"
              style={{ color: "var(--text-secondary)", background: "var(--bg-secondary)" }}
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div
            className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-lg font-bold"
            style={{
              background: "var(--icon-accent-bg)",
              color: "var(--accent)",
              border: "1px solid var(--border)",
            }}
          >
            {getInitials(panelEmployee.name)}
          </div>

          <div className="min-w-0">
            <h2 className="text-2xl font-bold truncate" style={textPrimary}>
              {panelEmployee.name}
            </h2>
            <p className="text-sm mt-1 truncate" style={textSecondary}>
              {panelEmployee.email || "-"}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-3 py-1 rounded-full text-xs font-semibold" style={getStatusStyle(normalizedStatus)}>
                {normalizedStatus}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold" style={btnSecondary}>
                {panelEmployee.department}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold" style={btnSecondary}>
                {panelEmployee.jobTitle}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setActiveAction(activeAction === "status" ? null : "status")}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
          style={btnPrimary}
        >
          <BadgeCheck size={16} />
          Update Status
        </button>
      </div>

      {(loading || message || error) && (
        <div
          className="mt-4 rounded-lg px-4 py-3 text-sm font-semibold"
          style={error ? getStatusStyle("Rejected") : getStatusStyle(loading ? "In Progress" : "Completed")}
        >
          {loading ? "Loading HR action data..." : error || message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        {actionCards.map((item) => (
          <div key={item.title} className="rounded-xl p-4" style={cardInner}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={getStatusStyle(item.status)}
              >
                {item.icon}
              </div>
              <span className="text-xs font-semibold" style={textSecondary}>
                {item.title}
              </span>
            </div>
            <p className="text-xl font-bold" style={textPrimary}>
              {item.value}
            </p>
            <p className="text-xs leading-5 mt-1" style={textSecondary}>
              {item.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] gap-5">
        <div className="rounded-xl p-5 min-w-0 overflow-hidden" style={cardInner}>
          <h3 className="text-base font-bold mb-4" style={textPrimary}>
            HR Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: "leave" as const, label: "Approve Leave", icon: <CheckCircle2 size={16} /> },
              { key: "balance" as const, label: "Adjust Leave Balance", icon: <WalletCards size={16} /> },
              { key: "review" as const, label: "Schedule Review", icon: <CalendarDays size={16} /> },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => setActiveAction(activeAction === action.key ? null : action.key)}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-left min-w-0"
                style={btnSecondary}
              >
                {action.icon}
                <span className="truncate">{action.label}</span>
              </button>
            ))}
          </div>

          {activeAction && (
            <div className="mt-4 rounded-xl p-4 overflow-hidden" style={card}>
              {activeAction === "status" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={statusForm.status}
                    onChange={(event) => setStatusForm((form) => ({ ...form, status: event.target.value }))}
                    className="rounded-lg px-3 py-3 text-sm outline-none min-w-0"
                    style={inputMuted}
                  >
                    <option>Active</option>
                    <option>On Leave</option>
                    <option>Remote</option>
                    <option>Inactive</option>
                  </select>
                  <input
                    value={statusForm.reason}
                    onChange={(event) => setStatusForm((form) => ({ ...form, reason: event.target.value }))}
                    placeholder="Reason"
                    className="rounded-lg px-3 py-3 text-sm outline-none min-w-0"
                    style={inputMuted}
                  />
                  <button onClick={submitStatus} disabled={submitting} className="rounded-lg px-4 py-3 text-sm font-semibold md:col-span-2 md:justify-self-end w-full md:w-auto min-w-[120px]" style={btnPrimary}>
                    Save
                  </button>
                </div>
              )}

              {activeAction === "leave" && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1 text-sm" style={textSecondary}>
                    {selectedLeave
                      ? `${selectedLeave.leave_type} - ${selectedLeave.days} day(s) on ${selectedLeave.leave_date}${
                          selectedLeave.internal_status === "manager_approved" ? "" : " (waiting for manager approval)"
                        }`
                      : "No pending leave request"}
                  </div>
                  <button onClick={approveLeave} disabled={submitting || !hrReviewableLeave} className="rounded-lg px-4 py-3 text-sm font-semibold" style={btnPrimary}>
                    Approve
                  </button>
                </div>
              )}

              {activeAction === "balance" && (
                <div className="grid grid-cols-1 md:grid-cols-[150px_minmax(0,1fr)] gap-3">
                  <input
                    type="number"
                    step="0.5"
                    value={balanceForm.remainingDelta}
                    onChange={(event) => setBalanceForm((form) => ({ ...form, remainingDelta: event.target.value }))}
                    className="rounded-lg px-3 py-3 text-sm outline-none min-w-0"
                    style={inputMuted}
                  />
                  <input
                    value={balanceForm.reason}
                    onChange={(event) => setBalanceForm((form) => ({ ...form, reason: event.target.value }))}
                    placeholder="Reason"
                    className="rounded-lg px-3 py-3 text-sm outline-none min-w-0"
                    style={inputMuted}
                  />
                  <button onClick={submitBalanceAdjustment} disabled={submitting} className="rounded-lg px-4 py-3 text-sm font-semibold md:col-span-2 md:justify-self-end w-full md:w-auto min-w-[120px]" style={btnPrimary}>
                    Adjust
                  </button>
                </div>
              )}

              {activeAction === "review" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={reviewForm.reviewDate}
                    onChange={(event) => setReviewForm((form) => ({ ...form, reviewDate: event.target.value }))}
                    className="rounded-lg px-3 py-3 text-sm outline-none min-w-0"
                    style={inputMuted}
                  />
                  <input
                    value={reviewForm.reviewType}
                    onChange={(event) => setReviewForm((form) => ({ ...form, reviewType: event.target.value }))}
                    className="rounded-lg px-3 py-3 text-sm outline-none min-w-0"
                    style={inputMuted}
                  />
                  <input
                    value={reviewForm.notes}
                    onChange={(event) => setReviewForm((form) => ({ ...form, notes: event.target.value }))}
                    placeholder="Notes"
                    className="rounded-lg px-3 py-3 text-sm outline-none min-w-0 md:col-span-2"
                    style={inputMuted}
                  />
                  <button onClick={submitReview} disabled={submitting} className="rounded-lg px-4 py-3 text-sm font-semibold md:col-span-2 md:justify-self-end w-full md:w-auto min-w-[120px]" style={btnPrimary}>
                    Save
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl p-5 min-w-0" style={cardInner}>
          <h3 className="text-base font-bold mb-4" style={textPrimary}>
            Employee Info
          </h3>
          <InfoRow label="Manager" value={panelEmployee.manager || "-"} />
          <InfoRow label="Role" value={panelEmployee.role || "-"} />
          <InfoRow label="Phone" value={panelEmployee.phoneNumber || "-"} />
          <InfoRow label="Joined" value={panelEmployee.joinDate || panelEmployee.createdAt || "-"} />
          <InfoRow label="Productivity" value={`${panelEmployee.productivity || 0}%`} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <span className="text-sm" style={textSecondary}>
        {label}
      </span>
      <span className="text-sm font-semibold text-right truncate" style={textPrimary}>
        {value}
      </span>
    </div>
  );
}
