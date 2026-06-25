import { useEffect, useMemo, useState } from "react";
import { Clock3, Loader2, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import api from "../../utils/axiosInstance";
import {
  btnPrimary,
  card,
  getStatusStyle,
  hrPageWrap,
  inputMuted,
  tableHead,
  textPrimary,
  textSecondary,
} from "./hrTheme";

type OnboardingStatus = "Not Initiated" | "Pending" | "In Progress" | "Completed";

type OnboardingEmployee = {
  id?: string;
  initials: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  reportingManager: string;
  startDate: string;
  employmentType: string;
  documentStatus: string;
  assetStatus: string;
  status: OnboardingStatus;
  notes: string;
};

const statusOptions = ["All Status", "Not Initiated", "Pending", "In Progress", "Completed"];
const documentStatusOptions = ["Pending", "Submitted", "Verified", "Rejected"];
const assetStatusOptions = ["Pending", "Assigned", "Not Required"];
const employmentTypeOptions = ["Full-time", "Intern", "Contract", "Probation"];

const emptyOnboardingForm = {
  employeeId: "",
  name: "",
  email: "",
  department: "",
  designation: "",
  reportingManager: "",
  startDate: "2026-06-01",
  employmentType: "Full-time",
  documentStatus: "Pending",
  assetStatus: "Pending",
  status: "Pending" as OnboardingStatus,
  notes: "",
};

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
function normalizeRecord(record: Partial<OnboardingEmployee>): OnboardingEmployee {
  return {
    id: record.id,
    initials: getInitials(record.name || ""),
    employeeId: record.employeeId || "",
    name: record.name || "",
    email: record.email || "",
    department: record.department || "",
    designation: record.designation || "",
    reportingManager: record.reportingManager || "",
    startDate: record.startDate || "",
    employmentType: record.employmentType || "",
    documentStatus: record.documentStatus || "Pending",
    assetStatus: record.assetStatus || "Pending",
    status: record.status || "Pending",
    notes: record.notes || "-",
  };
}
export default function EmployeeOnboardingPage() {
  const [search] = useTopHeaderSearch();
  const [employees, setEmployees] = useState<OnboardingEmployee[]>([]);
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEmployee, setNewEmployee] = useState(emptyOnboardingForm);

  const fetchOnboardingRecords = async () => {
    try {
      const response = await api.get("/api/onboarding");
      setEmployees((response.data.records || []).map(normalizeRecord));
    } catch {
      setEmployees([]);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchOnboardingRecords();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        [
          employee.employeeId,
          employee.name,
          employee.email,
          employee.department,
          employee.designation,
          employee.reportingManager,
          employee.startDate,
          employee.employmentType,
          employee.documentStatus,
          employee.assetStatus,
          employee.status,
          employee.notes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesStatus = statusFilter === "All Status" || employee.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [employees, search, statusFilter]);

  const stats = useMemo(
    () => [
      {
        label: "Not Initiated",
        value: employees.filter((employee) => employee.status === "Not Initiated").length,
        color: "#64748b",
        icon: <UserRound size={18} />,
      },
      {
        label: "Pending",
        value: employees.filter((employee) => employee.status === "Pending").length,
        color: "#f59e0b",
        icon: <Clock3 size={18} />,
      },
      {
        label: "In Progress",
        value: employees.filter((employee) => employee.status === "In Progress").length,
        color: "#3b82f6",
        icon: <Loader2 size={18} />,
      },
      {
        label: "Completed",
        value: employees.filter((employee) => employee.status === "Completed").length,
        color: "#10b981",
        icon: <UserRound size={18} />,
      },
      {
        label: "Total",
        value: employees.length,
        color: "#6366f1",
        icon: <UserRound size={18} />,
      },
    ],
    [employees],
  );

  const openCreateModal = () => {
    setEditingId(null);
    setNewEmployee(emptyOnboardingForm);
    setShowModal(true);
  };

  const openEditModal = (employee: OnboardingEmployee) => {
    setEditingId(employee.id || null);
    setNewEmployee({
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      designation: employee.designation,
      reportingManager: employee.reportingManager,
      startDate: employee.startDate,
      employmentType: employee.employmentType,
      documentStatus: employee.documentStatus,
      assetStatus: employee.assetStatus,
      status: employee.status,
      notes: employee.notes === "-" ? "" : employee.notes,
    });
    setShowModal(true);
  };

  const deleteEmployee = async (employee: OnboardingEmployee) => {
    if (!employee.id) return;

    setEmployees((prev) => prev.filter((item) => item.id !== employee.id));

    try {
      await api.delete(`/api/onboarding/${employee.id}`);
    } catch {
      fetchOnboardingRecords();
    }
  };

  const handleSaveEmployee = async () => {
    if (
      !newEmployee.name.trim() ||
      !newEmployee.employeeId.trim() ||
      !newEmployee.email.trim() ||
      !newEmployee.department.trim() ||
      !newEmployee.designation.trim() ||
      !newEmployee.reportingManager.trim() ||
      !newEmployee.startDate
    ) {
      return;
    }

    const savedEmployee: OnboardingEmployee = {
      initials: getInitials(newEmployee.name),
      employeeId: newEmployee.employeeId,
      name: newEmployee.name,
      email: newEmployee.email,
      department: newEmployee.department,
      designation: newEmployee.designation,
      reportingManager: newEmployee.reportingManager,
      startDate: newEmployee.startDate,
      employmentType: newEmployee.employmentType,
      documentStatus: newEmployee.documentStatus,
      assetStatus: newEmployee.assetStatus,
      status: newEmployee.status,
      notes: newEmployee.notes || "-",
    };

    try {
      if (editingId) {
        const response = await api.put(`/api/onboarding/${editingId}`, savedEmployee);
        const updatedRecord = normalizeRecord(response.data.record);

        setEmployees((prev) =>
          prev.map((employee) => (employee.id === editingId ? updatedRecord : employee)),
        );
      } else {
        const response = await api.post("/api/onboarding", savedEmployee);
        const createdRecord = normalizeRecord(response.data.record);

        setEmployees((prev) => [createdRecord, ...prev]);
      }

      setNewEmployee(emptyOnboardingForm);
      setEditingId(null);
      setShowModal(false);
    } catch {
      // API fail ho to koi message show nahi hoga
    }
  };

  return (
    <div className={hrPageWrap}>
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-56">
            <ConstrainedDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              buttonStyle={inputMuted}
            />
          </div>

          <button
            onClick={openCreateModal}
            className="h-10 px-4 rounded-lg font-semibold inline-flex items-center gap-2 hover:opacity-90 transition"
            style={btnPrimary}
          >
            <Plus size={16} />
            Initiate Onboarding
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg p-4 flex items-center gap-4"
              style={{
                ...card,
                borderLeft: `4px solid ${stat.color}`,
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${stat.color}22`, color: stat.color }}
              >
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold leading-7" style={textPrimary}>
                  {stat.value}
                </p>
                <p className="text-xs mt-1" style={textSecondary}>
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg p-4" style={card}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px]">
              <thead style={tableHead}>
                <tr>
                  {[
                    "Employee",
                    "Department",
                    "Designation",
                    "Manager",
                    "Joining Date",
                    "Type",
                    "Document",
                    "Asset",
                    "Status",
                    "Notes",
                    "Action",
                  ].map(
                    (column) => (
                      <th key={column} className="px-4 py-4 text-left text-xs font-semibold">
                        {column}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.email} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{
                            background: "var(--icon-accent-bg)",
                            color: "var(--accent)",
                          }}
                        >
                          {employee.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={textPrimary}>
                            {employee.name}
                          </p>
                          <p className="text-xs truncate" style={textSecondary}>
                            {employee.employeeId} • {employee.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm" style={textSecondary}>
                      {employee.department}
                    </td>
                    <td className="px-4 py-4 text-sm" style={textSecondary}>
                      {employee.designation}
                    </td>
                    <td className="px-4 py-4 text-sm" style={textSecondary}>
                      {employee.reportingManager}
                    </td>
                    <td className="px-4 py-4 text-sm" style={textSecondary}>
                      {employee.startDate}
                    </td>
                    <td className="px-4 py-4 text-sm" style={textSecondary}>
                      {employee.employmentType}
                    </td>
                    <td className="px-4 py-4 text-sm" style={textSecondary}>
                      {employee.documentStatus}
                    </td>
                    <td className="px-4 py-4 text-sm" style={textSecondary}>
                      {employee.assetStatus}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="inline-flex px-3 py-1 rounded-full text-xs font-semibold uppercase"
                        style={getStatusStyle(employee.status)}
                      >
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm" style={textSecondary}>
                      {employee.notes || "-"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(employee)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                          style={inputMuted}
                          aria-label={`Edit onboarding for ${employee.name}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                  onClick={() => deleteEmployee(employee)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                          style={getStatusStyle("Rejected")}
                          aria-label={`Delete onboarding for ${employee.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-sm" style={textSecondary}>
                      No onboarding records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-lg shadow-2xl" style={card}>
              <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-lg font-bold" style={textPrimary}>
                  {editingId ? "Update Employee Onboarding" : "Initiate Employee Onboarding"}
                </h2>
                <button className="rounded-lg p-2" onClick={() => setShowModal(false)} aria-label="Close modal">
                  <X size={18} style={textSecondary} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    label="Employee ID *"
                    value={newEmployee.employeeId}
                    onChange={(value) => setNewEmployee({ ...newEmployee, employeeId: value })}
                    placeholder="EMP-006"
                  />
                  <FormField
                    label="Employee Name *"
                    value={newEmployee.name}
                    onChange={(value) => setNewEmployee({ ...newEmployee, name: value })}
                    placeholder="Employee name"
                  />
                  <FormField
                    label="Email *"
                    value={newEmployee.email}
                    onChange={(value) => setNewEmployee({ ...newEmployee, email: value })}
                    placeholder="employee@company.com"
                  />
                  <FormField
                    label="Department *"
                    value={newEmployee.department}
                    onChange={(value) => setNewEmployee({ ...newEmployee, department: value })}
                    placeholder="Engineering"
                  />
                  <FormField
                    label="Designation *"
                    value={newEmployee.designation}
                    onChange={(value) => setNewEmployee({ ...newEmployee, designation: value })}
                    placeholder="Frontend Developer"
                  />
                  <FormField
                    label="Reporting Manager *"
                    value={newEmployee.reportingManager}
                    onChange={(value) => setNewEmployee({ ...newEmployee, reportingManager: value })}
                    placeholder="Manager name"
                  />
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold" style={textPrimary}>
                      Joining Date *
                    </span>
                    <input
                      type="date"
                      value={newEmployee.startDate}
                      onChange={(event) =>
                        setNewEmployee({ ...newEmployee, startDate: event.target.value })
                      }
                      className="h-12 w-full rounded-lg px-4 text-sm outline-none"
                      style={inputMuted}
                    />
                  </label>
                  <ConstrainedDropdown
                    label="Employment Type *"
                    value={newEmployee.employmentType}
                    onChange={(value) =>
                      setNewEmployee({ ...newEmployee, employmentType: value })
                    }
                    options={employmentTypeOptions}
                    buttonStyle={inputMuted}
                    labelStyle={textPrimary}
                  />
                  <ConstrainedDropdown
                    label="Document Status *"
                    value={newEmployee.documentStatus}
                    onChange={(value) =>
                      setNewEmployee({ ...newEmployee, documentStatus: value })
                    }
                    options={documentStatusOptions}
                    buttonStyle={inputMuted}
                    labelStyle={textPrimary}
                  />
                  <ConstrainedDropdown
                    label="Asset Status *"
                    value={newEmployee.assetStatus}
                    onChange={(value) =>
                      setNewEmployee({ ...newEmployee, assetStatus: value })
                    }
                    options={assetStatusOptions}
                    buttonStyle={inputMuted}
                    labelStyle={textPrimary}
                  />
                  <ConstrainedDropdown
                    label="Onboarding Status *"
                    value={newEmployee.status}
                    onChange={(value) =>
                      setNewEmployee({ ...newEmployee, status: value as OnboardingStatus })
                    }
                    options={["Not Initiated", "Pending", "In Progress", "Completed"]}
                    buttonStyle={inputMuted}
                    labelStyle={textPrimary}
                  />
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold" style={textPrimary}>
                      Notes
                    </span>
                    <textarea
                      value={newEmployee.notes}
                      onChange={(event) =>
                        setNewEmployee({ ...newEmployee, notes: event.target.value })
                      }
                      className="min-h-[48px] w-full rounded-lg px-4 py-3 text-sm outline-none"
                      style={inputMuted}
                      placeholder="Optional notes"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t px-6 py-5" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold"
                  style={inputMuted}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEmployee}
                  className="rounded-lg px-4 py-2 text-sm font-semibold inline-flex items-center gap-2"
                  style={btnPrimary}
                >
                  <Plus size={15} />
                  {editingId ? "Update Onboarding" : "Create Onboarding"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold" style={textPrimary}>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-lg px-4 text-sm outline-none"
        style={inputMuted}
        placeholder={placeholder}
      />
    </label>
  );
}
