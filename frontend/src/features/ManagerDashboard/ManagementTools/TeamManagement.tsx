import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SEARCH_EVENT } from "../../../components/layout/TopHeader";
import api from "../../../utils/axiosInstance";

// ── Types ──────────────────────────────────────────────────────────────────

type Member = {
  _id: string;
  name: string;
  email: string;
  employeeId: string;
  contact: string;
  projects: string | string[];
  skills: string[];
  shift: string;
};

type TeamLeader = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

type TeamData = {
  _id: string;
  name: string;
  department: string;
  leader: TeamLeader;
  members: Member[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function projectsText(projects: string | string[] | undefined): string {
  if (!projects) return "—";
  if (Array.isArray(projects)) return projects.join(", ") || "—";
  return projects || "—";
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TeamManagementPage() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    employeeId: "",
    contact: "",
    projects: "",
    skills: "",
    shift: "",
  });

  // ── Fetch team data ──────────────────────────────────────────────────────

  async function fetchTeam() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: boolean; teams: TeamData[] }>("/api/teams");
      const teams: TeamData[] = res.data?.teams ?? [];

      // Identify the current manager by their stored email
      const managerEmail = (
        localStorage.getItem("manager_userEmail") ||
        localStorage.getItem("hr_userEmail") ||
        localStorage.getItem("userEmail") ||
        ""
      ).toLowerCase().trim();

      let myTeam: TeamData | null = null;

      if (managerEmail) {
        myTeam =
          teams.find(
            (t) =>
              t.leader?.email?.toLowerCase().trim() === managerEmail
          ) ?? null;
      }

      // Fallback: first non-unassigned team
      if (!myTeam) {
        myTeam =
          teams.find((t) => t._id !== "team-unassigned") ?? teams[0] ?? null;
      }

      setTeam(myTeam);
      setMembers(myTeam?.members ?? []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load team data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeam();
  }, []);

  // ── Search event from TopHeader ──────────────────────────────────────────

  useEffect(() => {
    function onSearch(e: Event) {
      setSearch((e as CustomEvent<string>).detail);
    }
    window.addEventListener(SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(SEARCH_EVENT, onSearch);
  }, []);

  // ── Filtered members ─────────────────────────────────────────────────────

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  // ── Add member locally (optimistic) ─────────────────────────────────────

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    const newMember: Member = {
      _id: `local-${Date.now()}`,
      name: form.name,
      email: form.email,
      employeeId: form.employeeId,
      contact: form.contact,
      projects: form.projects,
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      shift: form.shift,
    };
    setMembers((prev) => [...prev, newMember]);
    setForm({
      name: "",
      email: "",
      employeeId: "",
      contact: "",
      projects: "",
      skills: "",
      shift: "",
    });
    setShowModal(false);
  }

  // ── Leader display info ──────────────────────────────────────────────────

  const leaderName =
    team?.leader?.name ||
    localStorage.getItem("manager_userName") ||
    localStorage.getItem("hr_userName") ||
    "Manager";
  const leaderEmail = team?.leader?.email || "";
  const leaderInitials = getInitials(leaderName);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full px-4 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {/* Team Management */}
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {/* Manage your team members */}
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-4 h-11 rounded-xl text-sm font-medium w-full sm:w-auto"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          <Plus size={16} />
          Add Member
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2
            size={22}
            className="animate-spin"
            style={{ color: "var(--text-secondary)" }}
          />
          <span style={{ color: "var(--text-secondary)" }} className="text-sm">
            Loading team…
          </span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          className="rounded-2xl px-5 py-4 text-sm flex items-center justify-between gap-4"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444",
          }}
        >
          <span>{error}</span>
          <button
            onClick={fetchTeam}
            className="text-xs font-medium underline underline-offset-2 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Card */}
      {!loading && !error && (
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Manager row */}
          <div
            className="px-4 sm:px-6 py-5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                {leaderInitials}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    className="font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {leaderName}
                  </h2>

                  <span
                    className="text-[10px] uppercase px-2 py-1 rounded-full font-semibold"
                    style={{
                      background: "rgba(99,102,241,0.12)",
                      color: "#6366F1",
                    }}
                  >
                    Manager
                  </span>

                  <span
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {members.length} member{members.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {leaderEmail && (
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {leaderEmail}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-16 text-center px-6"
              style={{ color: "var(--text-secondary)" }}
            >
              <p className="text-sm">
                {search ? "No members match your search." : "No team members yet."}
              </p>
            </div>
          )}

          {/* Desktop Table */}
          {filtered.length > 0 && (
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-275">
                <thead>
                  <tr
                    className="text-xs"
                    style={{
                      color: "var(--text-secondary)",
                      borderTop: "1px solid var(--border)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <th className="px-6 py-4 text-left">Member</th>
                    <th className="px-4 py-4 text-left">Employee ID</th>
                    <th className="px-4 py-4 text-left">Email</th>
                    <th className="px-4 py-4 text-left">Contact</th>
                    <th className="px-4 py-4 text-left">Projects</th>
                    <th className="px-4 py-4 text-left">Skills</th>
                    <th className="px-4 py-4 text-left">Shift</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((member, index) => (
                    <tr
                      key={member._id || index}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold"
                            style={{
                              background: "var(--bg-primary)",
                              border: "1px solid var(--border)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {getInitials(member.name)}
                          </div>
                          <div>
                            <p
                              className="text-sm font-medium"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {member.name}
                            </p>
                            <p
                              className="text-xs"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              Team Member
                            </p>
                          </div>
                        </div>
                      </td>

                      <td
                        className="px-4 py-4 text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {member.employeeId || "—"}
                      </td>

                      <td
                        className="px-4 py-4 text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {member.email || "—"}
                      </td>

                      <td
                        className="px-4 py-4 text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {member.contact || "—"}
                      </td>

                      <td
                        className="px-4 py-4 text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {projectsText(member.projects)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {member.skills?.length > 0
                            ? member.skills.map((skill, i) => (
                                <span
                                  key={i}
                                  className="text-[11px] px-2 py-1 rounded-lg"
                                  style={{
                                    background: "var(--bg-primary)",
                                    border: "1px solid var(--border)",
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  {skill}
                                </span>
                              ))
                            : <span style={{ color: "var(--text-secondary)" }}>—</span>}
                        </div>
                      </td>

                      <td
                        className="px-4 py-4 text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {member.shift || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile Cards */}
          {filtered.length > 0 && (
            <div className="lg:hidden p-4 space-y-4">
              {filtered.map((member, index) => (
                <div
                  key={member._id || index}
                  className="rounded-2xl p-4"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {getInitials(member.name)}
                    </div>

                    <div className="min-w-0">
                      <h3
                        className="text-sm font-semibold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {member.name}
                      </h3>
                      <p
                        className="text-xs truncate mt-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-5">
                    <Info label="Employee ID" value={member.employeeId || "—"} />
                    <Info label="Shift" value={member.shift || "—"} />
                    <Info label="Contact" value={member.contact || "—"} />
                    <Info label="Projects" value={projectsText(member.projects)} />
                  </div>

                  <div className="mt-4">
                    <p
                      className="text-[11px] mb-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Skills
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {member.skills?.length > 0
                        ? member.skills.map((skill, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2 py-1 rounded-lg"
                              style={{
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                              }}
                            >
                              {skill}
                            </span>
                          ))
                        : <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>—</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg rounded-3xl p-6"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Add Member
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X size={20} style={{ color: "var(--text-primary)" }} />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <ModalInput
                placeholder="Full Name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <ModalInput
                placeholder="Email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
              <ModalInput
                placeholder="Employee ID"
                value={form.employeeId}
                onChange={(v) => setForm({ ...form, employeeId: v })}
              />
              <ModalInput
                placeholder="Contact"
                value={form.contact}
                onChange={(v) => setForm({ ...form, contact: v })}
              />
              <ModalInput
                placeholder="Projects"
                value={form.projects}
                onChange={(v) => setForm({ ...form, projects: v })}
              />
              <ModalInput
                placeholder="Skills (React, Node)"
                value={form.skills}
                onChange={(v) => setForm({ ...form, skills: v })}
              />
              <ModalInput
                placeholder="Shift"
                value={form.shift}
                onChange={(v) => setForm({ ...form, shift: v })}
              />

              <button
                type="submit"
                className="w-full h-11 rounded-xl text-sm font-medium"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                Add Member
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p
        className="text-sm font-medium mt-1"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

function ModalInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 px-4 rounded-xl outline-none text-sm"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}
    />
  );
}
