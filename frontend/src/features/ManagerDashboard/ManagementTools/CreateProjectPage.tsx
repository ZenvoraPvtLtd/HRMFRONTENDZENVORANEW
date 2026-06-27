import { useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../../utils/axiosInstance";

type ProjectForm = {
  code: string;
  name: string;
  type: string;
  status: string;
  manager: string;
  members: string;
  duration: string;
};

const initialProject: ProjectForm = {
  code: "",
  name: "",
  type: "External",
  status: "Active",
  manager: "",
  members: "",
  duration: "",
};

const projectTypes    = ["External", "Internal", "Client", "Research"];
const projectStatuses = ["Active", "On Hold", "Completed"];

export default function CreateProjectPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const backPath  = location.pathname.startsWith("/manager-tools")
    ? "/manager-tools/projects"
    : "/manager/projects";

  const [project,     setProject]     = useState<ProjectForm>(initialProject);
  const [created,     setCreated]     = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError,    setApiError]    = useState<string | null>(null);

  const updateField =
    (field: keyof ProjectForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setProject((curr) => ({ ...curr, [field]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setApiError(null);
    setIsSubmitting(true);
    try {
      await api.post("/api/projects/create", {
        code:         project.code,
        project_name: project.name,
        type:         project.type,
        status:       project.status,
        manager:      project.manager,
        members:      project.members,
        duration:     project.duration,
      });
      setCreated(true);
      window.setTimeout(() => navigate(backPath, { replace: true }), 700);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100%", background: "var(--bg-primary)", color: "var(--text-primary)", padding: "1.5rem 1.25rem" }}>

      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate(backPath)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          background: "none", border: "none", cursor: "pointer",
          fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.25rem",
          padding: 0,
        }}
      >
        <ArrowLeft size={15} /> Back to Projects
      </button>

      {/* Card */}
      <div style={{
        maxWidth: 720,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "1rem",
        overflow: "hidden",
      }}>
        {/* Card header */}
        <div style={{
          background: "#ffffff",
          borderBottom: "1px solid var(--border)",
          padding: "0.5rem 1.5rem",
        }}>
          <h2 style={{ fontSize: "0.95rem", color: "#111827", margin: 0, fontWeight: 700 }}>Project Details</h2>
        </div>

        {/* Error banner */}
        {apiError && (
          <div style={{
            margin: "1rem 1.5rem 0",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444",
            fontSize: "0.85rem",
          }}>
            {apiError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}>
            <Field label="Code">
              <input
                required
                value={project.code}
                onChange={updateField("code")}
                placeholder="EXT-008"
              />
            </Field>

            <Field label="Project Name">
              <input
                required
                value={project.name}
                onChange={updateField("name")}
                placeholder="Project name"
              />
            </Field>

            <Field label="Type">
              <select value={project.type} onChange={updateField("type")}>
                {projectTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Status">
              <select value={project.status} onChange={updateField("status")}>
                {projectStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Manager">
              <input
                required
                value={project.manager}
                onChange={updateField("manager")}
                placeholder="Manager name"
              />
            </Field>

            <Field label="Members">
              <input
                required
                value={project.members}
                onChange={updateField("members")}
                placeholder="Team member names"
              />
            </Field>

            <Field label="Duration">
              <input
                required
                value={project.duration}
                onChange={updateField("duration")}
                placeholder="e.g. 3 months"
              />
            </Field>
          </div>

          {/* Actions */}
          <div style={{
            marginTop: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}>
            {created && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", color: "#10b981", marginRight: "auto" }}>
                <Check size={15} /> Project created!
              </span>
            )}

            <button
              type="button"
              onClick={() => navigate(backPath)}
              style={{
                padding: "0.65rem 1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "0.65rem 1.5rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "var(--accent)",
                color: "var(--accent-text)",
                fontSize: "0.875rem",
                fontWeight: 700,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.65 : 1,
              }}
            >
              {isSubmitting ? "Creating…" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
        {label}
      </span>
      <style>{`
        .zenvora-field input,
        .zenvora-field select {
          width: 100%;
          padding: 0.65rem 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.875rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .zenvora-field input:focus,
        .zenvora-field select:focus {
          border-color: var(--accent);
        }
        .zenvora-field input::placeholder {
          color: var(--text-secondary);
          opacity: 0.7;
        }
      `}</style>
      <div className="zenvora-field">{children}</div>
    </label>
  );
}
