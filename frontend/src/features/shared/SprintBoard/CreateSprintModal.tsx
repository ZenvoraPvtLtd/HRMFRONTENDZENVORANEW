import { useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { getApiBaseUrl } from "../../../config/apiConfig";

type Sprint = Record<string, unknown>;

interface Props {
  onClose: () => void;
  onCreated: (sprint: Sprint) => void;
}

export default function CreateSprintModal({ onClose, onCreated }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const currentUser = localStorage.getItem("userName") || localStorage.getItem("hr_userName") || "";

  const [form, setForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    owner: currentUser,
    team: "Zenvora Product Team",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Sprint name is required"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/sprints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create sprint");
      onCreated(data.sprint);
      onClose();
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to create sprint");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.5rem",
    border: "1px solid var(--border)", background: "var(--bg-primary)",
    color: "var(--text-primary)", fontSize: "0.875rem", outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)",
    display: "block", marginBottom: "0.4rem",
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
    >
      <div style={{ width: "100%", maxWidth: 500, background: "var(--bg-secondary)", borderRadius: "0.875rem", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>Create New Sprint</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex" }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "70vh", overflowY: "auto" }}>
          <div>
            <label style={labelStyle}>Name <span style={{ color: "#ef4444" }}>*</span></label>
            <input style={inputStyle} placeholder="e.g. Sprint 1 - Q3 2026" value={form.name} onChange={set("name")} />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
              placeholder="Brief description of this sprint..."
              value={form.description}
              onChange={set("description")}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="datetime-local" style={inputStyle} value={form.start_date} onChange={set("start_date")} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="datetime-local" style={inputStyle} value={form.end_date} onChange={set("end_date")} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Owner <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>(Optional — defaults to you)</span></label>
            <input style={inputStyle} placeholder={currentUser || "Enter owner name"} value={form.owner} onChange={set("owner")} />
          </div>

          <div>
            <label style={labelStyle}>Team</label>
            <input style={inputStyle} placeholder="Team name" value={form.team} onChange={set("team")} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderTop: "1px solid var(--border)" }}>
          <span style={{ color: "#ef4444", fontSize: "0.85rem", fontWeight: 600 }}>{error}</span>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={onClose} style={{ padding: "0.55rem 1.25rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.55rem 1.25rem", borderRadius: "0.5rem", border: "none", background: "var(--accent)", color: "var(--accent-text)", fontSize: "0.875rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              <Plus size={14} style={{ color: "currentColor" }} /> {loading ? "Creating..." : "Create Sprint"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
