import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Plus, X } from "lucide-react";
import ConstrainedDropdown from "../../../components/ConstrainedDropdown";
import type { ApiTask } from "../SprintBoardDetailPage";
import { getApiBaseUrl } from "../../../config/apiConfig";

interface TeamUser {
  _id: string;
  name: string;
  email: string;
  role: "hr" | "employee";
}

interface TeamUsersResponse {
  success: boolean;
  data?: TeamUser[];
  message?: string;
}

interface TaskCreateResponse {
  success: boolean;
  data?: ApiTask;
  message?: string;
}

interface Props {
  onClose: () => void;
  onCreated?: (task: ApiTask) => void;
  sprintId?: string;
  initialStatus?: string;
}

export default function CreateTaskModal({ onClose, onCreated, sprintId, initialStatus = "TO DO" }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const currentUserName =
    localStorage.getItem("userName") ||
    localStorage.getItem("hr_userName") ||
    localStorage.getItem("employeeName") ||
    "You";
  const [form, setForm] = useState({
    title: "", workType: "Task - General work item", description: "",
    priority: "Medium", dueDate: "", estimateH: "-", estimateM: "-",
    labels: "", assignee: "Unassigned", reporter: currentUserName,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [, setError] = useState("");
  const [employees, setEmployees] = useState<string[]>([]);
  const [reporters, setReporters] = useState<string[]>([currentUserName]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/auth/team-users`);
        const data = (await res.json()) as TeamUsersResponse;
        if (!res.ok || !data.success || !Array.isArray(data.data)) return;

        const employeeNames = data.data
          .filter((user) => user.role === "employee")
          .map((user) => user.name)
          .filter(Boolean);
        const reporterNames = data.data
          .map((user) => user.name)
          .filter(Boolean);

        setEmployees(employeeNames);
        setReporters(Array.from(new Set([currentUserName, ...reporterNames])));
      } catch (err) {
        console.error(err);
      }
    };

    loadUsers();
  }, [currentUserName]);

  const handleSubmit = async () => {
    if (!form.title) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          workType: form.workType,
          description: form.description,
          priority: form.priority,
          dueDate: form.dueDate,
          estimatedHours: form.estimateH,
          estimatedMinutes: form.estimateM,
          assignee: form.assignee,
          reporter: form.reporter,
          labels: form.labels,
          status: initialStatus,
          sprintId: sprintId || null,
        }),
      });
      const data = (await res.json()) as TaskCreateResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Task create nahi ho paya.");
      }
      if (!data.data) {
        throw new Error("Task create response empty hai.");
      }
      setSuccess(true);
      onCreated?.(data.data);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Task create nahi ho paya.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));
  const setValue = (k: keyof typeof form) => (value: string) =>
    setForm((p) => ({ ...p, [k]: value }));

  const labelStyle: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.375rem", display: "block" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none" };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer", appearance: "auto" };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div style={{ width: "100%", maxWidth: 480, background: "var(--bg-secondary)", borderRadius: "0.875rem", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-primary)" }}>Create New Task</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", padding: "0 0.25rem" }}><X size={15} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={labelStyle}>Title <span style={{ color: "#ef4444" }}>*</span></label>
              <input style={inputStyle} placeholder="Enter task title" value={form.title} onChange={set("title")} />
            </div>
            <div>
              <label style={labelStyle}>Work Type <span style={{ color: "#ef4444" }}>*</span></label>
              <ConstrainedDropdown
                value={form.workType}
                onChange={setValue("workType")}
                options={["Task - General work item", "Bug - Defect or issue", "Feature - New functionality", "Story - User story"]}
                buttonStyle={selectStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 80 }} placeholder="Describe the task..." value={form.description} onChange={set("description")} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={labelStyle}>Priority</label>
              <ConstrainedDropdown
                value={form.priority}
                onChange={setValue("priority")}
                options={["Low", "Medium", "High", "Critical"]}
                buttonStyle={selectStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" style={inputStyle} value={form.dueDate} onChange={set("dueDate")} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={labelStyle}>Estimated time</label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 3 }}>HOURS</div>
                  <ConstrainedDropdown
                    value={form.estimateH}
                    onChange={setValue("estimateH")}
                    options={["-", ...Array.from({ length: 24 }, (_, i) => String(i))]}
                    buttonStyle={selectStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 3 }}>MINUTES</div>
                  <ConstrainedDropdown
                    value={form.estimateM}
                    onChange={setValue("estimateM")}
                    options={["-", "0", "15", "30", "45"]}
                    buttonStyle={selectStyle}
                  />
                </div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Labels</label>
              <input style={inputStyle} placeholder="e.g. frontend, urgent" value={form.labels} onChange={set("labels")} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={labelStyle}>Assignee</label>
              <ConstrainedDropdown
                value={form.assignee}
                onChange={setValue("assignee")}
                options={["Unassigned", ...employees]}
                buttonStyle={selectStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Reporter</label>
              <ConstrainedDropdown
                value={form.reporter}
                onChange={setValue("reporter")}
                options={reporters}
                buttonStyle={selectStyle}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderTop: "1px solid var(--border)" }}>
          <div>
            {success && (
              <span style={{ color: "#10b981", fontSize: "0.85rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <CheckCircle2 size={14} /> Task created successfully!
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.625rem" }}>
            <button onClick={onClose} style={{ padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading || success} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "none", background: "var(--accent)", color: "var(--accent-text)", fontSize: "0.8125rem", fontWeight: 600, cursor: (loading || success) ? "not-allowed" : "pointer", opacity: (loading || success) ? 0.7 : 1 }}>
              <Plus size={14} /> {loading ? "Creating..." : success ? "Created!" : "Create Task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
