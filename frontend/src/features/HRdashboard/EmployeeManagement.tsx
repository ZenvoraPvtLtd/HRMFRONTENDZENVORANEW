import { Download, Eye, Pencil, Search, UserCheck, UserX, ClipboardCheck, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import ResetButton from "../../components/button/ResetButton";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import {
  hrPageWrap,
  btnPrimary,
  btnSecondary,
  card,
  getStatusStyle,
  inputMuted,
  rowHover,
  tableHead,
  textPrimary,
  textSecondary,
} from "./hrTheme";
import {
  fetchEmployeeList,
  fetchEmployeeStats,
  updateEmployee,
} from "../../services/employeeApi";

import { DEPARTMENT_OPTIONS } from "../../constants/departments";

const defaultDepartments = [...DEPARTMENT_OPTIONS];

type EmployeeRecord = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phoneNumber: string;
  department: string;
  manager: string;
  jobTitle: string;
  role: string;
  status: string;
  profileCompletion: number;
  productivity: number;
  hireDate: string;
  joinDate: string;
  skills: string[];
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  salary?: string;
  uanNumber?: string;
  simNumber?: string;
  probationPeriodDays?: number;
  noticePeriodDays?: number;
  fnfDueDays?: number;
  reportingTime?: string;
  workingHoursPerDay?: number;
  onboardingStatus?: string;
};

const emptyEditForm = {
  name: "",
  email: "",
  phoneNumber: "",
  dateOfBirth: "",
  jobTitle: "",
  hireDate: "",
  department: "",
  manager: "",
  role: "employee",
  salary: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  uanNumber: "",
  simNumber: "",
  probationPeriodDays: "",
  noticePeriodDays: "",
  fnfDueDays: "",
  status: "Active",
  skillsText: "",
  reportingTime: "09:00 AM",
  workingHoursPerDay: "8",
};

function normalizeEmployee(employee: Partial<EmployeeRecord>): EmployeeRecord {
  const role = employee.role || "employee";
  return {
    id: employee.id || "",
    employeeId: employee.employeeId || employee.id || "",
    name: employee.name || "Unnamed Employee",
    email: employee.email || "",
    phoneNumber: employee.phoneNumber || "",
    department: employee.department || "Unassigned",
    manager: employee.manager || "-",
    jobTitle: employee.jobTitle || role,
    role,
    status: employee.status || "Active",
    profileCompletion: Number(employee.profileCompletion ?? employee.productivity ?? 0),
    productivity: Number(employee.productivity ?? employee.profileCompletion ?? 0),
    hireDate: employee.hireDate || employee.joinDate || "",
    joinDate: employee.joinDate || employee.hireDate || "",
    skills: Array.isArray(employee.skills) ? employee.skills : [],
    dateOfBirth: employee.dateOfBirth,
    address: employee.address,
    emergencyContactName: employee.emergencyContactName,
    emergencyContactPhone: employee.emergencyContactPhone,
    salary: employee.salary,
    uanNumber: employee.uanNumber,
    simNumber: employee.simNumber,
    probationPeriodDays: employee.probationPeriodDays,
    noticePeriodDays: employee.noticePeriodDays,
    fnfDueDays: employee.fnfDueDays,
    reportingTime: employee.reportingTime || "09:00 AM",
    workingHoursPerDay: employee.workingHoursPerDay || 8,
    onboardingStatus: employee.onboardingStatus || "Completed",
  };
}

function normalizeStatus(status: string) {
  const value = (status || "").toLowerCase();
  if (value.includes("inactive")) return "Inactive";
  if (value.includes("leave")) return "On Leave";
  if (value.includes("remote")) return "Remote";
  if (value.includes("suspend")) return "Suspended";
  return "Active";
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "E";
}

function roleBadgeStyle(role: string) {
  const value = role.toLowerCase();
  if (value.includes("admin")) return { background: "rgba(239,68,68,0.12)", color: "#ef4444" };
  if (value.includes("hr")) return { background: "rgba(168,85,247,0.12)", color: "#a855f7" };
  if (value.includes("manager")) return { background: "rgba(59,130,246,0.12)", color: "#3b82f6" };
  return { background: "rgba(16,185,129,0.12)", color: "#10b981" };
}

function profileBarColor(value: number) {
  if (value >= 80) return "#10b981";
  if (value >= 50) return "#f59e0b";
  return "#ef4444";
}

export default function EmployeeManagement() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0,
    onboardingDone: 0,
    avgProfileCompletion: 0,
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [search, setSearch] = useTopHeaderSearch();
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [pageSize, setPageSize] = useState("25");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadEmployees() {
    try {
      const data = await fetchEmployeeList();
      const list = Array.isArray(data) ? data : data.employees || data.data || [];
      setEmployees(list.map(normalizeEmployee));
      setError("");
    } catch {
      setError("Failed to load employees.");
      setEmployees([]);
    }
  }

  async function loadStats() {
    try {
      const payload = await fetchEmployeeStats();
      setStats({
        totalEmployees: payload.totalEmployees ?? 0,
        activeEmployees: payload.activeEmployees ?? 0,
        inactiveEmployees: payload.inactiveEmployees ?? 0,
        onboardingDone: payload.onboardingDone ?? 0,
        avgProfileCompletion: payload.avgProfileCompletion ?? payload.avgProductivity ?? 0,
      });
    } catch {
      setStats({
        totalEmployees: employees.length,
        activeEmployees: employees.filter((e) => normalizeStatus(e.status) === "Active").length,
        inactiveEmployees: employees.filter((e) => normalizeStatus(e.status) === "Inactive").length,
        onboardingDone: employees.filter((e) => (e.onboardingStatus || "Completed") === "Completed").length,
        avgProfileCompletion: employees.length
          ? Math.round(employees.reduce((sum, e) => sum + e.profileCompletion, 0) / employees.length)
          : 0,
      });
    }
  }

  useEffect(() => {
    const initialize = async () => {
      await loadEmployees();
      await loadStats();
    };

    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const departments = useMemo(
    () => ["All Departments", ...Array.from(new Set([...defaultDepartments, ...employees.map((e) => e.department)]))],
    [employees],
  );

  const statuses = useMemo(() => {
    const set = new Set(employees.map((e) => normalizeStatus(e.status)));
    return ["All Status", "Active", ...Array.from(set).filter((s) => s !== "Active")];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return employees.filter((employee) => {
      const text = [
        employee.employeeId,
        employee.name,
        employee.email,
        employee.phoneNumber,
        employee.department,
        employee.manager,
        employee.jobTitle,
        employee.role,
        ...(employee.skills || []),
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !q || text.includes(q);
      const matchesDept = departmentFilter === "All Departments" || employee.department === departmentFilter;
      const matchesStatus =
        statusFilter === "All Status" || normalizeStatus(employee.status) === statusFilter;
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [departmentFilter, employees, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / Number(pageSize)));
  const paginatedEmployees = filteredEmployees.slice((page - 1) * Number(pageSize), page * Number(pageSize));

  useEffect(() => {
    if (page !== 1) {
      const timer = window.setTimeout(() => {
        setPage(1);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [search, departmentFilter, statusFilter, pageSize, page]);

  const openEditModal = (employee: EmployeeRecord) => {
    setSelectedEmployee(employee);
    setEditForm({
      name: employee.name,
      email: employee.email,
      phoneNumber: employee.phoneNumber,
      dateOfBirth: employee.dateOfBirth || "",
      jobTitle: employee.jobTitle,
      hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : "",
      department: employee.department,
      manager: employee.manager === "-" ? "" : employee.manager,
      role: employee.role,
      salary: employee.salary || "",
      address: employee.address || "",
      emergencyContactName: employee.emergencyContactName || "",
      emergencyContactPhone: employee.emergencyContactPhone || "",
      uanNumber: employee.uanNumber || "",
      simNumber: employee.simNumber || "",
      probationPeriodDays: employee.probationPeriodDays ? String(employee.probationPeriodDays) : "",
      noticePeriodDays: employee.noticePeriodDays ? String(employee.noticePeriodDays) : "",
      fnfDueDays: employee.fnfDueDays ? String(employee.fnfDueDays) : "",
      status: employee.status,
      skillsText: (employee.skills || []).join(", "),
      reportingTime: employee.reportingTime || "09:00 AM",
      workingHoursPerDay: String(employee.workingHoursPerDay || 8),
    });
    setShowEditModal(true);
  };

  const handleSaveEmployee = async () => {
    if (!selectedEmployee) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setError("Full name and email are required.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
        dateOfBirth: editForm.dateOfBirth || undefined,
        jobTitle: editForm.jobTitle.trim(),
        hireDate: editForm.hireDate || undefined,
        department: editForm.department.trim(),
        manager: editForm.manager.trim(),
        role: editForm.role,
        salary: editForm.salary.trim() || undefined,
        address: editForm.address.trim() || undefined,
        emergencyContactName: editForm.emergencyContactName.trim() || undefined,
        emergencyContactPhone: editForm.emergencyContactPhone.trim() || undefined,
        uanNumber: editForm.uanNumber.trim() || undefined,
        simNumber: editForm.simNumber.trim() || undefined,
        probationPeriodDays: editForm.probationPeriodDays ? Number(editForm.probationPeriodDays) : undefined,
        noticePeriodDays: editForm.noticePeriodDays ? Number(editForm.noticePeriodDays) : undefined,
        fnfDueDays: editForm.fnfDueDays ? Number(editForm.fnfDueDays) : undefined,
        status: editForm.status,
        skills: editForm.skillsText
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        reportingTime: editForm.reportingTime,
        workingHoursPerDay: Number(editForm.workingHoursPerDay || 8),
      };

      const res = await updateEmployee(selectedEmployee.id, payload);
      const updated = normalizeEmployee({ ...selectedEmployee, ...payload, ...(res?.employee || res) });
      setEmployees((prev) => prev.map((e) => (e.id === selectedEmployee.id ? updated : e)));
      await loadStats();
      setShowEditModal(false);
      setSuccessMessage("Employee updated successfully.");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch {
      setError("Failed to update employee.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "Emp ID",
      "Name",
      "Email",
      "Phone",
      "Department",
      "Manager",
      "Job Title",
      "Role",
      "Status",
      "Profile %",
      "Hire Date",
      "Skills",
    ];
    const rows = filteredEmployees.map((e) => [
      e.employeeId,
      e.name,
      e.email,
      e.phoneNumber,
      e.department,
      e.manager,
      e.jobTitle,
      e.role,
      normalizeStatus(e.status),
      e.profileCompletion,
      formatDate(e.hireDate),
      (e.skills || []).join("; "),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "employee-management.csv";
    link.click();
  };

  return (
    <div className={`${hrPageWrap} px-4 sm:px-5 lg:px-6 py-5`}>
      <div className="max-w-[1600px] mx-auto space-y-5">

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm font-medium" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
            {error}
          </div>
        )}
        {successMessage && (
          <div className="rounded-lg px-4 py-3 text-sm font-medium" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={<UserCheck size={18} />} title="Active" value={`${stats.activeEmployees}`} />
          <StatCard icon={<UserX size={18} />} title="Inactive" value={`${stats.inactiveEmployees}`} />
          <StatCard icon={<ClipboardCheck size={18} />} title="Onboarding Done" value={`${stats.onboardingDone}`} />
          <StatCard icon={<TrendingUp size={18} />} title="Avg Profile" value={`${stats.avgProfileCompletion}%`} />
        </div>

        <div className="rounded-[24px] p-4 flex flex-col xl:flex-row gap-4 xl:items-center justify-between shadow-sm border" style={{ ...card, borderColor: "var(--border)" }}>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, ID or phone..."
              className="w-full rounded-2xl pl-11 pr-4 py-3 text-sm outline-none"
              style={{ ...inputMuted, background: "var(--card)" }}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <ConstrainedDropdown value={departmentFilter} onChange={setDepartmentFilter} options={departments} className="w-full sm:w-52" />
            <ConstrainedDropdown value={statusFilter} onChange={setStatusFilter} options={statuses} className="w-full sm:w-40" />
            <ResetButton onClick={() => { setSearch(""); setDepartmentFilter("All Departments"); setStatusFilter("Active"); }} style={btnSecondary} />
          </div>
        </div>

        <div className="rounded-2xl p-4 shadow-sm" style={card}>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold" style={textSecondary}>{filteredEmployees.length} employees</p>
              <ConstrainedDropdown value={pageSize} onChange={setPageSize} options={["10", "25", "50", "100"]} className="w-28" />
            </div>
            <button type="button" onClick={handleExport} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold" style={btnSecondary}>
              <Download size={15} /> Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px]">
              <thead>
                <tr style={tableHead}>
                  {["Emp ID", "Name", "Email", "Phone", "Department", "Manager", "Job Title", "Role", "Status", "Profile %", "Hire Date", "Skills", "Actions"].map((c) => (
                    <th key={c} className="px-4 py-4 text-left text-xs font-semibold">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.length === 0 ? (
                  <tr><td colSpan={13} className="px-4 py-14 text-center text-sm" style={textSecondary}>No employees found</td></tr>
                ) : (
                  paginatedEmployees.map((employee) => (
                    <tr key={employee.id} style={{ borderTop: "1px solid var(--border)" }} {...rowHover}>
                      <td className="px-4 py-4 text-sm" style={textSecondary}>{employee.employeeId || "-"}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
                            {getInitials(employee.name)}
                          </div>
                          <span className="text-sm font-semibold" style={textPrimary}>{employee.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm" style={textSecondary}>{employee.email}</td>
                      <td className="px-4 py-4 text-sm" style={textSecondary}>{employee.phoneNumber || "-"}</td>
                      <td className="px-4 py-4 text-sm" style={textSecondary}>{employee.department}</td>
                      <td className="px-4 py-4 text-sm" style={textSecondary}>{employee.manager}</td>
                      <td className="px-4 py-4 text-sm" style={textSecondary}>{employee.jobTitle}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold capitalize" style={roleBadgeStyle(employee.role)}>
                          {employee.role}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold" style={getStatusStyle(normalizeStatus(employee.status))}>
                          {normalizeStatus(employee.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                            <div className="h-full rounded-full" style={{ width: `${employee.profileCompletion}%`, background: profileBarColor(employee.profileCompletion) }} />
                          </div>
                          <span className="text-xs font-semibold" style={textSecondary}>{employee.profileCompletion}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm" style={textSecondary}>{formatDate(employee.hireDate)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(employee.skills || []).slice(0, 3).map((skill) => (
                            <span key={skill} className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>
                              {skill}
                            </span>
                          ))}
                          {(employee.skills || []).length > 3 && (
                            <span className="text-[10px]" style={textSecondary}>+{(employee.skills || []).length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => navigate(`/employees/${employee.id}`)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={btnSecondary}>
                            <Eye size={14} /> View
                          </button>
                          <button type="button" onClick={() => openEditModal(employee)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={btnSecondary}>
                            <Pencil size={14} /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm" style={textSecondary}>
            <span>
              {filteredEmployees.length === 0
                ? "0 employees"
                : `${(page - 1) * Number(pageSize) + 1} to ${Math.min(page * Number(pageSize), filteredEmployees.length)} of ${filteredEmployees.length}`}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={btnSecondary} className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-50">Prev</button>
              <span>Page {page} of {pageCount}</span>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} style={btnSecondary} className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      </div>

      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl p-5 border my-8" style={{ ...card, borderColor: "var(--border)" }}>
            <div className="mb-5">
              <h2 className="text-xl font-bold" style={textPrimary}>Edit — {selectedEmployee.name}</h2>
              <p className="text-sm mt-1" style={textSecondary}>Update employee information and HR details</p>
            </div>

            <Section title="Basic Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Full Name *" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} />
                <Input label="Email *" value={editForm.email} onChange={(v) => setEditForm({ ...editForm, email: v })} />
                <Input label="Phone" value={editForm.phoneNumber} onChange={(v) => setEditForm({ ...editForm, phoneNumber: v })} />
                <Input label="Date of Birth" type="date" value={editForm.dateOfBirth} onChange={(v) => setEditForm({ ...editForm, dateOfBirth: v })} />
              </div>
            </Section>

            <Section title="Employment Details">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Job Title" value={editForm.jobTitle} onChange={(v) => setEditForm({ ...editForm, jobTitle: v })} />
                <Input label="Hire Date" type="date" value={editForm.hireDate} onChange={(v) => setEditForm({ ...editForm, hireDate: v })} />
                <Input label="Department" value={editForm.department} onChange={(v) => setEditForm({ ...editForm, department: v })} />
                <Input label="Manager" value={editForm.manager} onChange={(v) => setEditForm({ ...editForm, manager: v })} />
                <Input label="Role" value={editForm.role} onChange={(v) => setEditForm({ ...editForm, role: v })} />
                <Input label="Salary" value={editForm.salary} onChange={(v) => setEditForm({ ...editForm, salary: v })} />
                <Input label="Reporting Time" value={editForm.reportingTime} onChange={(v) => setEditForm({ ...editForm, reportingTime: v })} />
                <Input label="Working Hours / Day" value={editForm.workingHoursPerDay} onChange={(v) => setEditForm({ ...editForm, workingHoursPerDay: v })} />
                <Input label="Skills (comma separated)" value={editForm.skillsText} onChange={(v) => setEditForm({ ...editForm, skillsText: v })} />
                <Input label="Status" value={editForm.status} onChange={(v) => setEditForm({ ...editForm, status: v })} />
              </div>
            </Section>

            <Section title="Contact & Emergency">
              <div className="grid grid-cols-1 gap-3">
                <TextArea label="Address" value={editForm.address} onChange={(v) => setEditForm({ ...editForm, address: v })} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Emergency Contact Name" value={editForm.emergencyContactName} onChange={(v) => setEditForm({ ...editForm, emergencyContactName: v })} />
                  <Input label="Emergency Contact Phone" value={editForm.emergencyContactPhone} onChange={(v) => setEditForm({ ...editForm, emergencyContactPhone: v })} />
                </div>
              </div>
            </Section>

            <Section title="Statutory & HR">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="UAN Number" value={editForm.uanNumber} onChange={(v) => setEditForm({ ...editForm, uanNumber: v })} />
                <Input label="SIM Number" value={editForm.simNumber} onChange={(v) => setEditForm({ ...editForm, simNumber: v })} />
                <Input label="Probation Period (days)" value={editForm.probationPeriodDays} onChange={(v) => setEditForm({ ...editForm, probationPeriodDays: v })} />
                <Input label="Notice Period (days)" value={editForm.noticePeriodDays} onChange={(v) => setEditForm({ ...editForm, noticePeriodDays: v })} />
                <Input label="F&F Due (days)" value={editForm.fnfDueDays} onChange={(v) => setEditForm({ ...editForm, fnfDueDays: v })} />
              </div>
            </Section>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowEditModal(false)} className="h-11 px-4 rounded-xl text-sm" style={btnSecondary}>Cancel</button>
              <button type="button" onClick={handleSaveEmployee} disabled={submitting} className="h-11 px-4 rounded-xl text-sm" style={btnPrimary}>
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-2xl p-5 shadow-sm" style={card}>
      <div className="text-slate-500">{icon}</div>
      <p className="mt-5 text-sm" style={textSecondary}>{title}</p>
      <p className="mt-2 text-2xl font-bold" style={textPrimary}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--accent)" }}>{title}</h3>
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1.5" style={textSecondary}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-11 rounded-xl px-4 outline-none text-sm" style={inputMuted} />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1.5" style={textSecondary}>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded-xl px-4 py-3 outline-none text-sm resize-y" style={inputMuted} />
    </label>
  );
}
