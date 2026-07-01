import { FileText, Mail, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import api from "../../utils/axiosInstance";
import {
  fetchEmployeeById,
  fetchEmployeeOnboardingChecklist,
  updateEmployeeOnboardingTask,
} from "../../services/employeeApi";
import { btnPrimary, btnSecondary, card, getStatusStyle, textPrimary, textSecondary } from "./hrTheme";

type EmployeeDetail = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: string;
  status: string;
  department?: string;
  manager?: string;
  jobTitle?: string;
  hireDate?: string;
  dateOfBirth?: string;
  onboardingStatus?: string;
  reportingTime?: string;
  workingHoursPerDay?: number;
  profileCompletion?: number;
};

type ChecklistItem = {
  id: string;
  title: string;
  status: string;
  completedAt?: string | null;
};

type UploadedDocument = {
  id: string;
  document_type: string;
  file_name: string;
  status: string;
  uploaded_at?: string;
  email?: string;
};

const REQUIRED_DOCUMENTS = [
  {
    key: "Id Proof",
    title: "Government-approved National Identity Proof",
    description: "Aadhar card, PAN card, Passport, or Driver's License",
  },
  {
    key: "Bank Details",
    title: "Bank account details",
    description: "Bank account statement or cancelled cheque",
  },
  {
    key: "Education Certificate",
    title: "All educational certificates and mark sheets",
    description: "All degrees, diplomas, and academic transcripts",
  },
  {
    key: "Experience Letter",
    title: "Previous employment documents",
    description: "Offer letter, experience letter, and salary slips for the last 3 months",
  },
  {
    key: "Offer Letter",
    title: "Recent passport-size photograph",
    description: "Digital copy of a recent passport-size photograph",
  },
];

const checklistStatuses = ["Pending", "In Progress", "Completed"];

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN");
}

function roleBadgeStyle(role: string) {
  const value = role.toLowerCase();
  if (value.includes("admin")) return { background: "rgba(239,68,68,0.12)", color: "#ef4444" };
  if (value.includes("hr")) return { background: "rgba(168,85,247,0.12)", color: "#a855f7" };
  if (value.includes("manager")) return { background: "rgba(59,130,246,0.12)", color: "#3b82f6" };
  return { background: "rgba(16,185,129,0.12)", color: "#10b981" };
}

export default function EmployeeDetailPage() {
  const { employeeId = "" } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistStats, setChecklistStats] = useState({ total: 0, completed: 0, pending: 0, percent: 0 });
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "onboarding" | "documents">("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  const loadEmployee = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError("");
    try {
      const [employeeData, checklistData, documentsResponse] = await Promise.all([
        fetchEmployeeById(employeeId),
        fetchEmployeeOnboardingChecklist(employeeId),
        api.get<UploadedDocument[]>("/api/documents"),
      ]);

      setEmployee(employeeData);
      setChecklist(checklistData.checklist || []);
      setChecklistStats(checklistData.stats || { total: 0, completed: 0, pending: 0, percent: 0 });

      const employeeEmail = String(employeeData.email || "").toLowerCase();
      const employeeDocs = (documentsResponse.data || []).filter(
        (doc) => String(doc.email || "").toLowerCase() === employeeEmail,
      );
      setDocuments(employeeDocs);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load employee");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    let isMounted = true;
    void Promise.resolve().then(() => {
      if (isMounted) {
        loadEmployee();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [loadEmployee]);

  const documentProgress = useMemo(() => {
    const submitted = REQUIRED_DOCUMENTS.filter((required) =>
      documents.some((doc) => doc.document_type === required.key),
    ).length;
    const completed = documents.filter((doc) => doc.status === "Approved").length;
    const pending = documents.filter((doc) => doc.status === "Pending For Review").length;
    return {
      submitted,
      completed,
      pending,
      total: REQUIRED_DOCUMENTS.length,
      percent: REQUIRED_DOCUMENTS.length ? Math.round((submitted / REQUIRED_DOCUMENTS.length) * 100) : 0,
    };
  }, [documents]);

  const updateTaskStatus = async (taskId: string, status: string) => {
    if (!employeeId) return;
    setSavingTaskId(taskId);
    try {
      const result = await updateEmployeeOnboardingTask(employeeId, taskId, status);
      setChecklist(result.checklist || []);
      setChecklistStats(result.stats || checklistStats);
      if (employee) {
        setEmployee({ ...employee, onboardingStatus: result.onboardingStatus });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update task");
    } finally {
      setSavingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]" style={textSecondary}>
        Loading employee...
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-sm font-medium text-red-500">{error || "Employee not found"}</p>
        <button type="button" onClick={() => navigate("/employees")} className="mt-4 px-4 py-2 rounded-lg" style={btnSecondary}>
          Back to Employees
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "onboarding" as const, label: `Onboarding Checklist (${checklistStats.completed}/${checklistStats.total})` },
    { id: "documents" as const, label: `Documents (${documents.length})` },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <button type="button" onClick={() => navigate("/employees")} className="text-sm mb-2" style={textSecondary}>
            ← Back to Employees
          </button>
          <h1 className="text-2xl font-bold" style={textPrimary}>{employee.name}</h1>
          <p className="text-sm mt-1 inline-flex items-center gap-2" style={textSecondary}>
            <Mail size={14} /> {employee.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold capitalize" style={roleBadgeStyle(employee.role)}>
            {employee.role}
          </span>
          <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold" style={getStatusStyle(employee.status)}>
            {employee.status}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-3 text-sm font-semibold border-b-2 -mb-px"
            style={{
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
              borderColor: activeTab === tab.id ? "var(--accent)" : "transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl p-5" style={card}>
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--accent)" }}>Profile Summary</h2>
            <div className="space-y-3 text-sm">
              <OverviewRow label="Role" value={employee.role} />
              <OverviewRow label="Status" value={employee.status} />
              <OverviewRow label="Onboarding Status" value={employee.onboardingStatus || "Pending"} />
              <OverviewRow label="Employee ID" value={employee.employeeId || "Not assigned"} />
              <OverviewRow label="Department" value={employee.department || "Not assigned"} />
              <OverviewRow label="Manager" value={employee.manager || "Not assigned"} />
              <OverviewRow label="Job Title" value={employee.jobTitle || "-"} />
              <OverviewRow label="Hire Date" value={formatDate(employee.hireDate)} />
              <OverviewRow label="Date of Birth" value={formatDate(employee.dateOfBirth) || "Not provided"} />
              <OverviewRow label="Phone" value={employee.phoneNumber || "Not provided"} />
            </div>
          </div>

          <div className="rounded-2xl p-5" style={card}>
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--accent)" }}>Attendance Settings</h2>
            <div className="space-y-3 text-sm">
              <OverviewRow label="Reporting Time" value={employee.reportingTime || "09:00 AM"} />
              <OverviewRow label="Working Hours Per Day" value={`${employee.workingHoursPerDay || 8} hours`} />
              <OverviewRow label="Profile Completion" value={`${employee.profileCompletion ?? 0}%`} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "onboarding" && (
        <div className="rounded-2xl p-5 space-y-4" style={card}>
          <div>
            <p className="text-sm font-semibold" style={textPrimary}>
              Progress: {checklistStats.completed} of {checklistStats.total} items completed ({checklistStats.percent}%)
            </p>
            <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${checklistStats.percent}%` }} />
            </div>
          </div>

          <div className="space-y-2">
            {checklist.map((task) => {
              const completed = task.status === "Completed";
              return (
                <div
                  key={task.id}
                  className="rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  style={{
                    background: completed ? "rgba(16,185,129,0.08)" : "var(--bg-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={textPrimary}>{task.title}</p>
                    {task.completedAt && (
                      <p className="text-xs mt-1" style={textSecondary}>Completed {formatDate(task.completedAt)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ConstrainedDropdown
                      value={task.status}
                      onChange={(value) => updateTaskStatus(task.id, value)}
                      options={checklistStatuses}
                      disabled={savingTaskId === task.id}
                      className="w-40"
                    />
                    <button type="button" className="px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1" style={btnSecondary}>
                      <FileText size={14} /> Request
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="rounded-2xl p-5 space-y-4" style={card}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--accent)" }}>Employee Documents</h2>
              <p className="text-sm mt-1" style={textSecondary}>
                Submitted: {documentProgress.submitted}/{documentProgress.total} · Completed: {documentProgress.completed}/{documentProgress.total} · Pending: {documentProgress.pending}
              </p>
            </div>
            <button type="button" style={btnPrimary} className="px-4 py-2 rounded-lg text-sm font-semibold">
              Request Document
            </button>
          </div>

          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${documentProgress.percent}%` }} />
          </div>

          <div className="space-y-3">
            {REQUIRED_DOCUMENTS.map((required) => {
              const uploaded = documents.find((doc) => doc.document_type === required.key);
              const status = uploaded ? uploaded.status : "Not Submitted";
              const isPending = status === "Pending For Review";
              return (
                <div
                  key={required.key}
                  className="rounded-xl p-4"
                  style={{
                    background: isPending ? "rgba(245,158,11,0.08)" : "var(--bg-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={textPrimary}>{required.title}</p>
                      <p className="text-xs mt-1" style={textSecondary}>{required.description}</p>
                      {uploaded && (
                        <p className="text-xs mt-2 inline-flex items-center gap-1" style={textSecondary}>
                          <User size={12} /> {uploaded.file_name} · {formatDate(uploaded.uploaded_at)}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-xs font-semibold px-3 py-1 rounded-full self-start"
                      style={{
                        background: uploaded ? "rgba(59,130,246,0.12)" : "rgba(107,114,128,0.12)",
                        color: uploaded ? "#2563eb" : "#6b7280",
                      }}
                    >
                      {status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
      <span style={textSecondary}>{label}</span>
      <span className="font-semibold text-right" style={textPrimary}>{value}</span>
    </div>
  );
}
