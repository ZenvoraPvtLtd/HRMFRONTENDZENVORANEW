import {
  Plus,
  ChevronDown,
  FolderKanban,
  X,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  MoreHorizontal,
} from "lucide-react";

import { useState, useEffect, useRef } from "react";
import api from "../../../utils/axiosInstance";
import { SEARCH_EVENT } from "../../../components/layout/TopHeader";

type Project = {
  id?: string;
  _id?: string;
  code: string;
  name?: string;
  project_name?: string;
  type: string;
  status: string;
  manager: string;
  members: string;
  duration: string;
};

type ProjectForm = {
  code: string;
  name: string;
  type: string;
  status: string;
  manager: string;
  members: string;
  duration: string;
};

const EMPTY_FORM: ProjectForm = {
  code: "", name: "", type: "", status: "", manager: "", members: "", duration: "",
};

export default function ProjectsPage() {
  const [projects, setProjects]         = useState<Project[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // modal state
  const [showModal, setShowModal]       = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [form, setForm]                 = useState<ProjectForm>(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState<string | null>(null);

  // delete confirm
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // action menu
  const [openMenuId, setOpenMenuId]     = useState<string | null>(null);
  const menuRef                         = useRef<HTMLDivElement>(null);

  // filters
  const [typeFilter, setTypeFilter]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handler = (e: Event) => setSearch((e as CustomEvent<string>).detail || "");
    window.addEventListener(SEARCH_EVENT, handler);
    return () => window.removeEventListener(SEARCH_EVENT, handler);
  }, []);
 const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await api.get("/api/projects");
      const data = res.data?.data ?? res.data ?? [];
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  // close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // header search
  useEffect(() => {
    const handler = (e: Event) => setSearch((e as CustomEvent<string>).detail || "");
    window.addEventListener(SEARCH_EVENT, handler);
    return () => window.removeEventListener(SEARCH_EVENT, handler);
  }, []);

  // ── helpers ──────────────────────────────────────────────────
  const getId = (p: Project) => p.id ?? p._id ?? "";
  const getName = (p: Project) => p.name ?? p.project_name ?? "—";

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (p: Project) => {
    setEditingId(getId(p));
    setForm({
      code:     p.code,
      name:     getName(p),
      type:     p.type,
      status:   p.status,
      manager:  p.manager,
      members:  p.members,
      duration: p.duration,
    });
    setFormError(null);
    setShowModal(true);
    setOpenMenuId(null);
  };

  // ── save (create or update) ──────────────────────────────────
  const handleSave = async () => {
    const { code, name, type, status, manager, members, duration } = form;
    if (!code || !name || !type || !status || !manager || !members || !duration) {
      setFormError("Please fill all fields");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        code,
        project_name: name,
        type,
        status,
        manager,
        members,
        duration,
      };
      if (editingId) {
        await api.put(`/api/projects/${editingId}`, payload);
      } else {
        await api.post("/api/projects/create", payload);
      }
      setShowModal(false);
      fetchProjects();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  // ── delete ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/projects/${deletingId}`);
      setDeletingId(null);
      fetchProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  // ── filter ───────────────────────────────────────────────────
  const filtered = projects.filter((p) => {
    const typeOk   = !typeFilter   || p.type   === typeFilter;
    const statusOk = !statusFilter || p.status === statusFilter;
    const name = (p.name ?? p.project_name ?? "").toLowerCase();
    const searchOk = !search || name.includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.manager.toLowerCase().includes(search.toLowerCase());
    return typeOk && statusOk && searchOk;
  });

  const stats = [
    { label: "Total",     value: filtered.length },
    { label: "Active",    value: filtered.filter((p) => p.status === "Active").length },
    { label: "On Hold",   value: filtered.filter((p) => p.status === "On Hold").length },
    { label: "Completed", value: filtered.filter((p) => p.status === "Completed").length },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "Inter, sans-serif" }}>

      {/* ── PROJECT MODAL (Create / Edit) ─────────────────────── */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: "2rem 1rem", overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: 640, borderRadius: "1.5rem", overflow: "hidden", boxShadow: "0 25px 50px rgba(0,0,0,0.4)", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", padding: "1.75rem 2rem 1.25rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                  {editingId ? "Edit Project" : "New Project"}
                </h2>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--text-secondary)" }}>
                  {editingId ? "Update project details below" : "Fill project details below"}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ width: 36, height: 36, borderRadius: "0.6rem", border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Error */}
            {formError && (
              <div style={{ margin: "0 2rem 0.75rem", padding: "0.65rem 1rem", borderRadius: "0.5rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: "0.825rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <AlertCircle size={14} /> {formError}
              </div>
            )}

            {/* Form grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", padding: "0 2rem", maxHeight: "55vh", overflowY: "auto" }}>
              <ModalInput  label="Code"         placeholder="EXT-004"      value={form.code}     onChange={(v) => setForm({ ...form, code: v })} />
              <ModalInput  label="Project Name" placeholder="Project Name"  value={form.name}     onChange={(v) => setForm({ ...form, name: v })} />
              <ModalSelect label="Type"   value={form.type}   onChange={(v) => setForm({ ...form, type: v })}   options={["External", "Internal"]} />
              <ModalSelect label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["Active", "Completed", "On Hold"]} />
              <ModalInput  label="Manager" placeholder="Manager Name"   value={form.manager}  onChange={(v) => setForm({ ...form, manager: v })} />
              <ModalInput  label="Members" placeholder="Team Members"   value={form.members}  onChange={(v) => setForm({ ...form, members: v })} />
              <div style={{ gridColumn: "1 / -1" }}>
                <ModalInput label="Duration" placeholder="e.g. 3 months" value={form.duration} onChange={(v) => setForm({ ...form, duration: v })} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1.25rem 2rem 1.75rem", borderTop: "1px solid var(--border)", marginTop: "1.25rem" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: "0.6rem 1.25rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: "0.6rem 1.5rem", borderRadius: "0.6rem", border: "none", background: "var(--text-primary)", color: "var(--bg-primary)", fontSize: "0.875rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.65 : 1, display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ─────────────────────────────── */}
      {deletingId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: "1rem" }}>
          <div style={{ width: "100%", maxWidth: 420, borderRadius: "1.25rem", padding: "2rem", background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem", fontWeight: 700 }}>Delete Project?</h3>
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              This action cannot be undone. The project will be permanently removed.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                onClick={() => setDeletingId(null)}
                style={{ padding: "0.6rem 1.25rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ padding: "0.6rem 1.25rem", borderRadius: "0.6rem", border: "none", background: "#ef4444", color: "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.65 : 1, display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                {deleting && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENT ─────────────────────────────────────────────── */}
      <main style={{ padding: "1.5rem 2rem" }}>

        {/* Filters + New Project button */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <FilterSelect
              value={typeFilter}
              placeholder="All Types"
              options={["External", "Internal"]}
              onChange={setTypeFilter}
            />
            <FilterSelect
              value={statusFilter}
              placeholder="All Statuses"
              options={["Active", "On Hold", "Completed"]}
              onChange={setStatusFilter}
            />
          </div>
          <button
            onClick={openCreate}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.25rem", borderRadius: "0.65rem", border: "none", background: "var(--text-primary)", color: "var(--bg-primary)", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <Plus size={16} /> New Project
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.75rem" }}>
          {stats.map((s) => (
            <div key={s.label} style={{ borderRadius: "1rem", padding: "1.25rem 1.5rem", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>{s.label}</p>
              <p style={{ margin: "0.5rem 0 0", fontSize: "2rem", fontWeight: 700 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
            <Loader2 size={30} style={{ color: "var(--text-secondary)", animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ borderRadius: "1rem", padding: "2rem", textAlign: "center", border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)" }}>
            <AlertCircle size={26} color="#ef4444" style={{ marginBottom: "0.75rem" }} />
            <p style={{ color: "#ef4444", margin: "0 0 1rem" }}>{error}</p>
            <button onClick={fetchProjects} style={{ padding: "0.5rem 1.25rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <>
            <div style={{ borderRadius: "1rem", overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Code", "Project Name", "Type", "Status", "Manager", "Members", "Duration", "Actions"].map((h) => (
                        <th key={h} style={{ padding: "0.875rem 1.25rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((project, idx) => {
                      const pid = getId(project);
                      return (
                        <tr
                          key={pid || idx}
                          style={{ borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "1rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, whiteSpace: "nowrap" }}>{project.code}</td>
                          <td style={{ padding: "1rem 1.25rem", fontSize: "0.875rem", minWidth: "140px" }}>{getName(project)}</td>
                          <td style={{ padding: "1rem 1.25rem", fontSize: "0.875rem", whiteSpace: "nowrap" }}>{project.type}</td>
                          <td style={{ padding: "1rem 1.25rem" }}>
                            <StatusBadge status={project.status} />
                          </td>
                          <td style={{ padding: "1rem 1.25rem", fontSize: "0.875rem", whiteSpace: "nowrap" }}>{project.manager}</td>
                          <td style={{ padding: "1rem 1.25rem", fontSize: "0.875rem" }}>{project.members}</td>
                          <td style={{ padding: "1rem 1.25rem", fontSize: "0.875rem", whiteSpace: "nowrap" }}>{project.duration}</td>
                          <td style={{ padding: "1rem 1.25rem" }}>
                            <div style={{ position: "relative", display: "inline-block" }} ref={openMenuId === pid ? menuRef : undefined}>
                              <button
                                onClick={() => setOpenMenuId(openMenuId === pid ? null : pid)}
                                style={{ width: 32, height: 32, borderRadius: "0.5rem", border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <MoreHorizontal size={15} />
                              </button>
                              {openMenuId === pid && (
                                <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 40, minWidth: 130, borderRadius: "0.65rem", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", border: "1px solid var(--border)", background: "var(--bg-secondary)", overflow: "hidden" }}>
                                  <button
                                    onClick={() => openEdit(project)}
                                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.6rem 1rem", border: "none", background: "transparent", color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", textAlign: "left" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                  >
                                    <Pencil size={14} /> Edit
                                  </button>
                                  <button
                                    onClick={() => { setDeletingId(pid); setOpenMenuId(null); }}
                                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.6rem 1rem", border: "none", background: "transparent", color: "#ef4444", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", textAlign: "left" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div style={{ borderRadius: "1rem", minHeight: "18rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", marginTop: "1rem", border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                <div style={{ width: "4.5rem", height: "4.5rem", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem", border: "1px solid var(--border)", background: "var(--bg-primary)" }}>
                  <FolderKanban size={28} style={{ color: "var(--text-secondary)" }} />
                </div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>No Projects Found</h3>
                <p style={{ margin: "0.5rem 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  Create a new project to get started.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function ModalInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "0.6rem 0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
      />
    </div>
  );
}

function ModalSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "0.6rem 2.25rem 0.6rem 0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none", appearance: "none", boxSizing: "border-box", cursor: "pointer" }}
      >
        <option value="">Select {label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={14} style={{ position: "absolute", right: "0.75rem", top: "calc(50% + 0.6rem)", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-secondary)" }} />
    </div>
  );
}

function FilterSelect({ value, placeholder, options, onChange }: { value: string; placeholder: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "0.55rem 2.5rem 0.55rem 1rem", borderRadius: "0.65rem", border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none", appearance: "none", cursor: "pointer", minWidth: "140px" }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={13} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-secondary)" }} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, { bg: string; color: string; border?: string }> = {
    Active:    { bg: "#16a34a",          color: "#fff" },
    "On Hold": { bg: "rgba(234,179,8,0.15)", color: "#ca8a04", border: "1px solid rgba(234,179,8,0.3)" },
    Completed: { bg: "rgba(99,102,241,0.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)" },
  };
  const style = colorMap[status] ?? { bg: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" };
  return (
    <span style={{ display: "inline-block", padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, background: style.bg, color: style.color, border: style.border ?? "none", whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}
