import {
  Building2,
  Calendar,
  ChevronDown,
  Eye,
  Filter,
  Mail,
  MoreHorizontal,
  Phone,
  Search,
  Trash2,
  UserCircle,
  Users,
  X,
  Check,
  Clock,
  MessageCircle,
  BarChart3,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { getApiBaseUrl, getFrontendOrigin } from "../../config/apiConfig";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";

const EMPLOYEES_API_URL = `${getApiBaseUrl()}/api/employees`;
const AUTH_API_URL = `${getApiBaseUrl()}/api/auth`;

type EmployeeType = {
  id?: string;
  employeeId?: string;
  name: string;
  email: string;
  phoneNumber?: string;
  department: string;
  role: string;
  productivity?: number;
  status: string;
  joinDate?: string;
  createdAt?: string;
  accessPermissions?: string[];
};

type InviteForm = {
  email: string;
  role: string;
  department: string;
  accessPermissions: string[];
};

const emptyInviteForm: InviteForm = {
  email: "",
  role: "employee",
  department: "",
  accessPermissions: ["timesheet", "leaves", "organization"],
};

import { DEPARTMENT_OPTIONS } from "../../constants/departments";

const departmentOptions = [...DEPARTMENT_OPTIONS];
const roleOptions = ["employee", "manager", "hr", "admin"];
const statusOptions = ["Active", "Inactive", "Pending", "Suspended"];

const accessOptions = [
  { id: "timesheet", label: "Timesheet", icon: <Clock size={16} /> },
  { id: "leaves", label: "Leaves", icon: <Calendar size={16} /> },
  { id: "sprints", label: "Sprint Board", icon: <BarChart3 size={16} /> },
  { id: "organization", label: "Organization", icon: <Users size={16} /> },
  { id: "chat", label: "Chat", icon: <MessageCircle size={16} /> },
];

const roleLabels: Record<string, string> = {
  admin: "Admin",
  manager: "Manager", 
  hr: "HR",
  employee: "Employee",
};

const normalizeEmployee = (employee: Partial<EmployeeType>): EmployeeType => ({
  id: employee.id,
  employeeId: employee.employeeId || "",
  name: employee.name || "Pending Registration",
  email: employee.email || "",
  phoneNumber: employee.phoneNumber || "",
  department: employee.department || "General",
  role: employee.role || "employee",
  productivity: Number(employee.productivity) || 0,
  status: employee.status || "Pending",
  joinDate: employee.joinDate || "",
  createdAt: employee.createdAt || "",
  accessPermissions: employee.accessPermissions || [],
});

const getInitials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "E";

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  Active: { bg: "rgba(16, 185, 129, 0.1)", text: "#059669", dot: "#10b981" },
  Inactive: { bg: "rgba(107, 114, 128, 0.1)", text: "#4b5563", dot: "#6b7280" },
  Pending: { bg: "rgba(245, 158, 11, 0.1)", text: "#d97706", dot: "#f59e0b" },
  Remote: { bg: "rgba(59, 130, 246, 0.1)", text: "#2563eb", dot: "#3b82f6" },
  "On Leave": { bg: "rgba(245, 158, 11, 0.1)", text: "#d97706", dot: "#f59e0b" },
  Probation: { bg: "rgba(168, 85, 247, 0.1)", text: "#7c3aed", dot: "#a855f7" },
  "Notice Period": { bg: "rgba(249, 115, 22, 0.1)", text: "#ea580c", dot: "#f97316" },
  Terminated: { bg: "rgba(239, 68, 68, 0.1)", text: "#dc2626", dot: "#ef4444" },
  Suspended: { bg: "rgba(239, 68, 68, 0.1)", text: "#dc2626", dot: "#ef4444" },
};

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] || statusColors.Active;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: colors.bg, color: colors.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.dot }} />
      {status}
    </span>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 shadow-sm">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}15`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-tight text-[var(--text-primary)]">{value}</p>
        <p className="truncate text-sm text-[var(--text-secondary)]">{label}</p>
      </div>
    </div>
  );
}

export default function Employee() {
  const [employees, setEmployees] = useState<EmployeeType[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showActionsFor, setShowActionsFor] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [inviteForm, setInviteForm] = useState<InviteForm>(emptyInviteForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewEmployee, setViewEmployee] = useState<EmployeeType | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(EMPLOYEES_API_URL);
      if (!response.ok) return;
      const data = await response.json();
      const employeeList = Array.isArray(data) ? data : data.employees || data.data || [];
      setEmployees(employeeList.map(normalizeEmployee));
    } catch {
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer fetching to avoid synchronous setState calls inside the effect
    const id = setTimeout(() => {
      fetchEmployees();
    }, 0);

    return () => clearTimeout(id);
  }, [fetchEmployees]);

  // Sync with TopHeader search bar
  useEffect(() => {
    const handler = (e: Event) => {
      setSearch((e as CustomEvent<string>).detail || "");
    };
    window.addEventListener(SEARCH_EVENT, handler);
    return () => window.removeEventListener(SEARCH_EVENT, handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActionsFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roles = useMemo(
    () => ["All Roles", ...roleOptions],
    []
  );

  const statuses = useMemo(
    () => ["All Status", ...statusOptions],
    []
  );

  const departments = useMemo(
    () => ["All Departments", ...new Set([...departmentOptions, ...employees.map((e) => e.department)].filter(Boolean))],
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        employee.phoneNumber?.toLowerCase().includes(query) ||
        employee.role.toLowerCase().includes(query) ||
        employee.department.toLowerCase().includes(query) ||
        employee.employeeId?.toLowerCase().includes(query);
      const matchesRole = roleFilter === "All Roles" || employee.role === roleFilter;
      const matchesStatus = statusFilter === "All Status" || employee.status === statusFilter;
      const matchesDept = departmentFilter === "All Departments" || employee.department === departmentFilter;
      return matchesSearch && matchesRole && matchesStatus && matchesDept;
    });
  }, [employees, roleFilter, search, statusFilter, departmentFilter]);

  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter((e) => e.status === "Active").length,
    onLeave: employees.filter((e) => e.status === "On Leave").length,
    remote: employees.filter((e) => e.status === "Remote").length,
  }), [employees]);

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("All Roles");
    setStatusFilter("All Status");
    setDepartmentFilter("All Departments");
  };

  const openInviteModal = () => {
    setInviteForm(emptyInviteForm);
    setFormError("");
    setShowInviteModal(true);
  };

  const openViewModal = (employee: EmployeeType) => {
    setViewEmployee(employee);
    setShowViewModal(true);
  };

  const closeInviteModal = () => {
    if (isSaving) return;
    setShowInviteModal(false);
    setInviteForm(emptyInviteForm);
    setFormError("");
  };

  const toggleAccess = (accessId: string) => {
    setInviteForm((prev) => ({
      ...prev,
      accessPermissions: prev.accessPermissions.includes(accessId)
        ? prev.accessPermissions.filter((id) => id !== accessId)
        : [...prev.accessPermissions, accessId],
    }));
  };

  const sendInvite = async () => {
    const email = inviteForm.email.trim();

    if (!email) {
      setFormError("Email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (!inviteForm.role) {
      setFormError("Please select a role.");
      return;
    }

    if (inviteForm.accessPermissions.length === 0) {
      setFormError("Please select at least one access permission.");
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        email: email,
        role: inviteForm.role,
        department: inviteForm.department || "General",
        accessPermissions: inviteForm.accessPermissions,
        inviteSource: "hr_employee_invite",
        loginUrl: `${getFrontendOrigin()}/login?invite=1`,
      };

      const response = await fetch(`${AUTH_API_URL}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setFormError(errData?.message || errData?.detail || "Failed to send invite");
        return;
      }

      const result = await response.json().catch(() => ({}));
      setFormError("");
      setSuccessMessage(
        result?.inviteEmailSent
          ? `Invite sent successfully to ${email}. They will receive an email to complete registration.`
          : `Invite saved for ${email}, but email was NOT sent. ${result?.emailError || "Check SMTP settings in backend/.env"}`
      );

      await fetchEmployees();
      closeInviteModal();
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch (err) {
      setFormError(String(err) || "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const resendInvite = async (employee: EmployeeType) => {
    if (!employee.email) return;
    try {
      const response = await fetch(`${AUTH_API_URL}/resend-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: employee.email }),
      });

      if (response.ok) {
        setSuccessMessage(`Invite resent to ${employee.email}`);
        setTimeout(() => setSuccessMessage(""), 4000);
      }
    } catch {
      // Silent fail
    }
    setShowActionsFor(null);
  };

  const suspendEmployee = async (employee: EmployeeType) => {
    if (!employee.id) return;
    try {
      await fetch(`${EMPLOYEES_API_URL}/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...employee, status: "Suspended" }),
      });
      setEmployees((prev) =>
        prev.map((item) => (item.id === employee.id ? { ...item, status: "Suspended" } : item))
      );
      setShowActionsFor(null);
    } catch {
      setShowActionsFor(null);
    }
  };

  const deleteEmployee = async (employee: EmployeeType) => {
    if (!employee.id) return;
    try {
      await fetch(`${EMPLOYEES_API_URL}/${employee.id}`, { method: "DELETE" });
      setEmployees((prev) => prev.filter((item) => item.id !== employee.id));
      setShowActionsFor(null);
    } catch {
      setShowActionsFor(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-5 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {/* <h1 className="text-2xl font-bold leading-tight text-[var(--text-primary)]">Employees</h1> */}
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {/* Manage employee invites, access, and workforce status. */}
            </p>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(16,185,129,0.12)" }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="flex-1 text-sm font-medium">{successMessage}</p>
            <button onClick={() => setSuccessMessage("")} className="p-1 rounded"
              style={{ color: "#10b981" }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Users size={24} />} label="Total Employees" value={stats.total} color="#3b82f6" />
          <StatCard icon={<UserCircle size={24} />} label="Active" value={stats.active} color="#10b981" />
          <StatCard icon={<Calendar size={24} />} label="On Leave" value={stats.onLeave} color="#f59e0b" />
          <StatCard icon={<Building2 size={24} />} label="Remote" value={stats.remote} color="#8b5cf6" />
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            {/* Search */}
            <div className="relative min-w-0 flex-1">
           
            </div>

            {/* Filter Dropdowns */}
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(160px,1fr)_minmax(140px,180px)_minmax(150px,190px)_auto] xl:w-auto xl:min-w-[620px]">
              <FilterDropdown className="w-full" value={departmentFilter} options={departments} onChange={setDepartmentFilter} icon={<Building2 size={16} />} />
              <FilterDropdown className="w-full" value={roleFilter} options={roles} onChange={setRoleFilter} icon={<UserCircle size={16} />} />
              <FilterDropdown className="w-full" value={statusFilter} options={statuses} onChange={setStatusFilter} icon={<Filter size={16} />} />
              
              {(search || roleFilter !== "All Roles" || statusFilter !== "All Status" || departmentFilter !== "All Departments") && (
                <button
                  onClick={resetFilters}
                  className="h-10 rounded-lg px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] sm:col-span-2 lg:col-span-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Showing <span className="font-semibold text-[var(--text-primary)]">{filteredEmployees.length}</span> of{" "}
              <span className="font-semibold text-[var(--text-primary)]">{employees.length}</span> employees
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--text-primary)", borderTopColor: "transparent" }}
              />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--bg-hover)] flex items-center justify-center mb-4">
                <Users size={32} className="text-[var(--text-secondary)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">No employees found</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[350px]">
              <table className="w-full min-w-[1040px] table-fixed">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[24%]" />
                  <col className="w-[15%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[9%]" />
                  <col className="w-[96px]" />
                </colgroup>
                <thead>
                  <tr className="bg-[var(--bg-hover)]">
                    {["Employee", "Contact", "Department", "Role", "Join Date", "Status", "Actions"].map((col) => (
                      <th
                        key={col}
                        className={`px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] ${col === "Actions" ? "text-right" : ""}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredEmployees.map((employee, index) => (
                    <tr
                      key={employee.id || employee.employeeId || employee.email || index}
                      className="hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                            style={{ background: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                          >
                            {getInitials(employee.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--text-primary)]">{employee.name}</p>
                            <p className="text-xs text-[var(--text-secondary)]">{employee.employeeId || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                            <Mail size={14} className="shrink-0" />
                            <span className="truncate max-w-[180px]">{employee.email || "-"}</span>
                          </div>
                          {employee.phoneNumber && (
                            <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                              <Phone size={14} className="shrink-0" />
                              <span className="truncate">{employee.phoneNumber}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-[var(--bg-hover)] px-2.5 py-1 text-sm text-[var(--text-primary)]">
                          <Building2 size={14} className="shrink-0 text-[var(--text-secondary)]" />
                          <span className="truncate">{employee.department}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle text-sm text-[var(--text-primary)]">
                        <span className="inline-flex max-w-full items-center rounded-lg bg-[var(--bg-hover)] px-2.5 py-1 font-medium">
                          {roleLabels[employee.role.toLowerCase()] || employee.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle text-sm text-[var(--text-secondary)]">
                        {formatDate(employee.joinDate || employee.createdAt)}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <StatusBadge status={employee.status} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="relative flex items-center justify-end gap-2" ref={showActionsFor === employee.id ? actionsRef : null}>
                          <button
                            onClick={() => openViewModal(employee)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => setShowActionsFor(showActionsFor === employee.id ? null : employee.id || null)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                            title="More actions"
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          {showActionsFor === employee.id && (
                            <div className={`absolute right-0 ${index >= filteredEmployees.length - 2 && filteredEmployees.length > 3 ? 'bottom-full mb-1' : 'top-full mt-1'} w-44 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-lg z-50 overflow-hidden`}>
                              <button
                                onClick={() => { resendInvite(employee); setShowActionsFor(null); }}
                                className="w-full px-4 py-2.5 text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2"
                              >
                                <Send size={16} />
                                Resend Invite
                              </button>
                              <button
                                onClick={() => suspendEmployee(employee)}
                                className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-2"
                                style={{ color: "#f59e0b" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(245,158,11,0.08)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <X size={16} />
                                Suspend
                              </button>
                              <button
                                onClick={() => deleteEmployee(employee)}
                                className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-2"
                                style={{ color: "#ef4444" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <Trash2 size={16} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <Modal onClose={closeInviteModal} title="Send Employee Invite">
          <div className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                Email Address *
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="employee@company.com"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border text-sm placeholder:text-[var(--text-secondary)] focus:outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                Employee will receive an email to complete registration with username, full name, and password.
              </p>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Role *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {roleOptions.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setInviteForm((prev) => ({ ...prev, role }))}
                    className="h-10 px-4 rounded-lg text-sm font-medium transition-all"
                    style={
                      inviteForm.role === role
                        ? { background: "var(--text-primary)", color: "var(--bg-primary)", border: "none" }
                        : { background: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" }
                    }
                  >
                    {roleLabels[role]}
                  </button>
                ))}
              </div>
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                Department (Optional)
              </label>
              <select
                value={inviteForm.department}
                onChange={(e) => setInviteForm((prev) => ({ ...prev, department: e.target.value }))}
                className="w-full h-11 px-4 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                <option value="">Select department</option>
                {departmentOptions.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Access Permissions */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Access Permissions *
              </label>
              <p className="text-xs text-[var(--text-secondary)] mb-3">
                Select which features this employee can access
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accessOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleAccess(option.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      inviteForm.accessPermissions.includes(option.id)
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${
                      inviteForm.accessPermissions.includes(option.id)
                        ? "bg-blue-600 text-white"
                        : "border border-[var(--border)] bg-[var(--bg-secondary)]"
                    }`}>
                      {inviteForm.accessPermissions.includes(option.id) && <Check size={14} />}
                    </div>
                    <span className="text-[var(--text-secondary)]">{option.icon}</span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {formError && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {formError}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={closeInviteModal}
              className="h-11 px-5 rounded-lg font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={sendInvite}
              disabled={isSaving}
              className="h-11 px-6 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={18} />
              )}
              Send Invite
            </button>
          </div>
        </Modal>
      )}

      {/* View Modal */}
      {showViewModal && viewEmployee && (
        <Modal onClose={() => setShowViewModal(false)} title="Employee Details">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold bg-gradient-to-br from-blue-500 to-blue-700 text-white mb-3">
              {getInitials(viewEmployee.name)}
            </div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">{viewEmployee.name}</h3>
            <p className="text-sm text-[var(--text-secondary)]">{roleLabels[viewEmployee.role.toLowerCase()] || viewEmployee.role}</p>
            <div className="mt-2">
              <StatusBadge status={viewEmployee.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InfoField label="Employee ID" value={viewEmployee.employeeId || "Auto-generated on profile complete"} />
            <InfoField label="Email" value={viewEmployee.email} />
            <InfoField label="Department" value={viewEmployee.department} />
            <InfoField label="Join Date" value={formatDate(viewEmployee.joinDate || viewEmployee.createdAt)} />
          </div>

          {viewEmployee.accessPermissions && viewEmployee.accessPermissions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-[var(--text-secondary)] mb-2">Access Permissions</p>
              <div className="flex flex-wrap gap-2">
                {viewEmployee.accessPermissions.map((perm) => {
                  const option = accessOptions.find((o) => o.id === perm);
                  return (
                    <span key={perm} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-primary)]">
                      {option?.icon}
                      {option?.label || perm}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowViewModal(false)}
              className="h-11 px-5 rounded-lg font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-[var(--bg-secondary)] rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg-hover)]">
      <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
      <p className="text-sm font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function FilterDropdown({
  value, options, onChange, icon, className = ""
}: { value: string; options: string[]; onChange: (v: string) => void; icon: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 pr-8 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
      >
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{value}</span>
        <ChevronDown size={16} className="absolute right-2.5 text-[var(--text-secondary)]" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[180px] max-h-60 overflow-auto rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] shadow-lg z-50">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--bg-hover)] transition-colors ${
                value === opt ? "font-semibold text-blue-500" : "text-[var(--text-primary)]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
