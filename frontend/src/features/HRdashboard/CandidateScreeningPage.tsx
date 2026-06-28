import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";

// ─── Types ───────────────────────────────────────────────────────────────────

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  appliedDate: string;
  resumeUrl: string;
  technicalSkills: string[];
  softSkills: string[];
  matchScore: number;
};

type ScreenedCandidate = Candidate & {
  computedScore: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  statusUpdating: boolean;
};

type FilterTab = "All" | "Shortlisted" | "Review" | "Rejected" | "Pending";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the","a","an","and","or","in","of","to","for","with","on","at","by","from",
    "as","is","are","was","were","be","been","being","have","has","had","do","does",
    "did","will","would","could","should","may","might","shall","can","need","dare",
    "ought","used","we","our","you","your","they","their","it","its","this","that",
    "these","those","not","but","if","than","then","so","yet","both","either",
    "neither","whether","while","although","though","because","since","unless",
    "until","when","where","how","what","which","who","whom","whose","experience",
    "work","working","strong","skills","knowledge","ability","years","looking",
    "responsible","required","preferred","must","plus","good","excellent","great",
    "team","role","position","candidate","job","employment","opportunity","include",
    "including","such","well","also","use","using","help","ensure","provide","manage",
    "minimum","maximum","least","degree","bachelor","master","equivalent","desired",
    "proven","demonstrated","effective","communicate","communication","collaborate",
    "collaboration","environment","capable","familiar","familiarity","understanding",
    "proficiency","proficient","hands","based","driven","oriented","focus","focused",
    "solid","deep","broad","concepts","principles","design","development","build",
    "building","implement","implementing","develop","developing","create","creating",
    "maintain","maintaining","support","supporting",
  ]);

  // Multi-word skill aliases — extract these first as single tokens
  const multiWordAliases: [RegExp, string][] = [
    [/machine\s+learning/gi, "machine learning"],
    [/deep\s+learning/gi, "deep learning"],
    [/natural\s+language\s+processing/gi, "nlp"],
    [/large\s+language\s+model/gi, "llm"],
    [/generative\s+ai/gi, "generative ai"],
    [/data\s+science/gi, "data science"],
    [/data\s+engineering/gi, "data engineering"],
    [/data\s+analysis/gi, "data analysis"],
    [/business\s+intelligence/gi, "business intelligence"],
    [/power\s+bi/gi, "power bi"],
    [/google\s+cloud(\s+platform)?/gi, "gcp"],
    [/amazon\s+web\s+services/gi, "aws"],
    [/microsoft\s+azure/gi, "azure"],
    [/spring\s+boot/gi, "spring boot"],
    [/ruby\s+on\s+rails/gi, "ruby on rails"],
    [/react\s+native/gi, "react native"],
    [/node\.?js/gi, "node.js"],
    [/next\.?js/gi, "next.js"],
    [/vue\.?js/gi, "vue.js"],
    [/react\.?js/gi, "react.js"],
    [/express\.?js/gi, "express.js"],
    [/angular\.?js/gi, "angular.js"],
    [/rest(ful)?\s+api/gi, "rest api"],
    [/object[\s-]oriented/gi, "oop"],
    [/test[\s-]driven/gi, "tdd"],
    [/ci\/cd/gi, "ci/cd"],
    [/shell\s+scripting/gi, "shell scripting"],
    [/version\s+control/gi, "git"],
    [/github\s+actions/gi, "github actions"],
    [/apache\s+kafka/gi, "kafka"],
    [/apache\s+spark/gi, "apache spark"],
    [/smart\s+contract/gi, "smart contracts"],
    [/ethical\s+hacking/gi, "ethical hacking"],
    [/penetration\s+testing/gi, "penetration testing"],
    [/prompt\s+engineering/gi, "prompt engineering"],
    [/hugging\s+face/gi, "hugging face"],
    [/scikit[\s-]learn/gi, "scikit-learn"],
    [/sql\s+server/gi, "sql server"],
    [/c\+\+/gi, "c++"],
    [/c#/gi, "c#"],
    [/\.net/gi, ".net"],
    [/asp\.net/gi, "asp.net"],
  ];

  const extracted: string[] = [];
  let cleaned = text.toLowerCase();

  for (const [pattern, canonical] of multiWordAliases) {
    if (pattern.test(cleaned)) {
      extracted.push(canonical);
      cleaned = cleaned.replace(pattern, " ");
    }
  }

  // Tokenise remaining text
  const tokens = cleaned
    .replace(/[^a-z0-9#+./\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[-./]+|[-./]+$/g, "").trim())
    .filter((w) => w.length >= 2 && w.length <= 25 && !stopWords.has(w) && /[a-z]/.test(w) && !/^\d+$/.test(w));

  return [...new Set([...extracted, ...tokens])];
}

function clientSideMatch(candidate: Candidate, jdKeywords: string[]): {
  computedScore: number;
  matchedSkills: string[];
  missingSkills: string[];
} {
  if (!jdKeywords.length) {
    return { computedScore: candidate.matchScore || 0, matchedSkills: [], missingSkills: [] };
  }

  // Build a normalised version of the candidate's skill set + full resume-like text
  const skillText = [
    ...candidate.technicalSkills,
    ...candidate.softSkills,
    candidate.role,
  ].join(" ").toLowerCase();

  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of jdKeywords) {
    const kwNorm = normalise(kw);
    const kwLower = kw.toLowerCase();

    const directHit  = skillText.includes(kwLower);
    const tokenHit   = normalise(skillText).includes(kwNorm);
    const partialHit = candidate.technicalSkills.some(
      (s) => normalise(s).includes(kwNorm) || kwNorm.includes(normalise(s))
    );

    if (directHit || tokenHit || partialHit) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  const score = jdKeywords.length > 0
    ? Math.round((matched.length / jdKeywords.length) * 100)
    : 0;

  return { computedScore: score, matchedSkills: matched, missingSkills: missing };
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Shortlisted: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  shortlisted:  { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  Review:       { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  review:       { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  Rejected:     { bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
  rejected:     { bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
  Pending:      { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  pending:      { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  Applied:      { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
};

function StatusBadge({ status }: { status: string }) {
  const col = STATUS_COLORS[status] || STATUS_COLORS.Pending;
  return (
    <span
      style={{
        background: col.bg,
        color: col.color,
        padding: "0.2rem 0.65rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>—</span>;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 100 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color, minWidth: 30 }}>{score}%</span>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}
function StatCard({ label, value, icon, accent }: StatCardProps) {
  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "0.875rem",
        padding: "1.25rem 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: "0.625rem",
          background: `${accent}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: accent,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>{label}</div>
      </div>
    </div>
  );
}

// ─── StatusDropdown ───────────────────────────────────────────────────────────

interface StatusDropdownProps {
  candidateId: string;
  currentStatus: string;
  isUpdating: boolean;
  onStatusChange: (id: string, status: string) => void;
}

const STATUS_OPTIONS = ["Shortlisted", "Review", "Rejected"];

function StatusDropdown({ candidateId, currentStatus, isUpdating, onStatusChange }: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const col = STATUS_COLORS[currentStatus] || STATUS_COLORS.Pending;

  return (
    <div style={{ position: "relative" }} tabIndex={0} onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button
        disabled={isUpdating}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          background: col.bg,
          color: col.color,
          border: `1px solid ${col.color}40`,
          borderRadius: "0.5rem",
          padding: "0.3rem 0.65rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          cursor: isUpdating ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          opacity: isUpdating ? 0.7 : 1,
        }}
      >
        {isUpdating ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : null}
        {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "0.625rem",
            overflow: "hidden",
            minWidth: 130,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const c = STATUS_COLORS[opt] || STATUS_COLORS.Pending;
            return (
              <button
                key={opt}
                onClick={() => { setOpen(false); onStatusChange(candidateId, opt); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 0.875rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: c.color,
                  background: currentStatus === opt ? c.bg : "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = c.bg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = currentStatus === opt ? c.bg : "transparent")}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CandidateScreeningPage() {
  const [candidates, setCandidates] = useState<ScreenedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jdText, setJdText] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [screening, setScreening] = useState(false);
  const [screened, setScreened] = useState(false);

  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");

  // header search
  useEffect(() => {
    const handler = (e: Event) => setSearch((e as CustomEvent<string>).detail || "");
    window.addEventListener(SEARCH_EVENT, handler);
    return () => window.removeEventListener(SEARCH_EVENT, handler);
  }, []);

  // ── Fetch candidates ──────────────────────────────────────────────────────

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axiosInstance.get("/api/candidate/applications");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = Array.isArray(res.data) ? res.data : res.data?.candidates || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCandidates(rows.map((c: any, i: number): ScreenedCandidate => ({
          id: c.id || c._id || String(i + 1),
          name: c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Unknown",
          email: c.email || "",
          phone: String(c.phone || ""),
          role: c.role || c.jobTitle || "",
          status: c.status || "Pending",
          appliedDate: c.appliedDate || c.createdAt || "",
          resumeUrl: c.resumeUrl || "",
          technicalSkills: Array.isArray(c.technicalSkills) ? c.technicalSkills : [],
          softSkills: Array.isArray(c.softSkills) ? c.softSkills : [],
          matchScore: c.matchScore ?? 0,
          computedScore: c.matchScore ?? null,
          matchedSkills: [],
          missingSkills: [],
          statusUpdating: false,
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load candidates");
      } finally {
        setLoading(false);
      }
    };
    fetchCandidates();
  }, []);

  // ── Auto-screen (client-side keyword match) + auto-status ───────────────

  const handleAutoScreen = () => {
    if (!jdText.trim()) return;
    setScreening(true);
    const keywords = extractKeywords(jdText);
    setTimeout(() => {
      setCandidates((prev) =>
        prev.map((c) => {
          const result = clientSideMatch(c, keywords);
          // Auto-assign status based on score
          let autoStatus = c.status;
          if (result.computedScore >= 70) autoStatus = "Shortlisted";
          else if (result.computedScore >= 40) autoStatus = "Review";
          else autoStatus = "Rejected";
          return { ...c, ...result, status: autoStatus };
        })
      );
      setScreened(true);
      setScreening(false);
    }, 600);
  };

  // ── Status update ─────────────────────────────────────────────────────────

  const handleStatusChange = async (id: string, newStatus: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, statusUpdating: true } : c))
    );
    try {
      const params = new URLSearchParams({ status: newStatus });
      if (jobTitle.trim()) params.append("job_title", jobTitle.trim());
      await axiosInstance.patch(`/api/candidates/${id}/status?${params.toString()}`);
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: newStatus, statusUpdating: false } : c
        )
      );
    } catch {
      setCandidates((prev) =>
        prev.map((c) => (c.id === id ? { ...c, statusUpdating: false } : c))
      );
    }
  };

  // ── Derived stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: candidates.length,
    shortlisted: candidates.filter((c) => c.status.toLowerCase() === "shortlisted").length,
    review: candidates.filter((c) => c.status.toLowerCase() === "review").length,
    rejected: candidates.filter((c) => c.status.toLowerCase() === "rejected").length,
    pending: candidates.filter(
      (c) => !["shortlisted", "review", "rejected"].includes(c.status.toLowerCase())
    ).length,
  }), [candidates]);

  // ── Filtered list (sorted by score after screening) ──────────────────────

  const filtered = useMemo(() => {
    let list = candidates;
    if (activeTab !== "All") {
      list = candidates.filter((c) => {
        const s = c.status.toLowerCase();
        if (activeTab === "Shortlisted") return s === "shortlisted";
        if (activeTab === "Review") return s === "review";
        if (activeTab === "Rejected") return s === "rejected";
        if (activeTab === "Pending") return !["shortlisted", "review", "rejected"].includes(s);
        return true;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q)
      );
    }
    // After screening, sort by score descending
    if (screened) {
      list = [...list].sort((a, b) => (b.computedScore ?? 0) - (a.computedScore ?? 0));
    }
    return list;
  }, [candidates, activeTab, screened, search]);

  // ── Tabs config ───────────────────────────────────────────────────────────

  const TABS: { label: FilterTab; count: number }[] = [
    { label: "All", count: stats.total },
    { label: "Shortlisted", count: stats.shortlisted },
    { label: "Review", count: stats.review },
    { label: "Rejected", count: stats.rejected },
    { label: "Pending", count: stats.pending },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Page Header
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            width: 40, height: 40, borderRadius: "0.625rem",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-primary)",
          }}
        >
          <UserCheck size={20} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Candidate Screening
          </h1>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Review applicants, run JD matching, and manage candidate status
          </p>
        </div>
      </div> */}

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
        <StatCard label="Total Candidates" value={stats.total}    icon={<Users size={18} />}        accent="#6366f1" />
        <StatCard label="Shortlisted"       value={stats.shortlisted} icon={<CheckCircle2 size={18} />} accent="#10b981" />
        <StatCard label="Under Review"      value={stats.review}   icon={<Clock size={18} />}         accent="#3b82f6" />
        <StatCard label="Rejected"          value={stats.rejected} icon={<XCircle size={18} />}       accent="#ef4444" />
      </div>

      {/* JD Input + Screen Button */}
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: "0.875rem",
          padding: "1.25rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <FileText size={16} style={{ color: "var(--text-secondary)" }} />
          <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>
            Job Description (JD) — Auto-Screen
          </span>
        </div>
        <input
          type="text"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="Job Title (e.g. Senior React Developer) — used for rejection email"
          style={{
            width: "100%",
            padding: "0.6rem 1rem",
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: "0.625rem",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the job description here. Skills extracted from the JD will be matched against each candidate's technical skills to compute a match score."
          rows={5}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: "0.625rem",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={handleAutoScreen}
            disabled={screening || !jdText.trim()}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.6rem 1.25rem",
              background: "var(--text-primary)",
              color: "var(--bg-primary)",
              border: "none",
              borderRadius: "0.625rem",
              fontWeight: 600, fontSize: "0.875rem",
              cursor: (screening || !jdText.trim()) ? "not-allowed" : "pointer",
              opacity: (screening || !jdText.trim()) ? 0.65 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {screening
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Screening…</>
              : <><BrainCircuit size={15} /> Auto-Screen All</>
            }
          </button>
          {screened && (
            <span style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 600 }}>
              ✓ Match scores updated — candidates sorted by score. Rejected candidates will receive an email in 3 days.
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex", gap: "0.35rem", flexWrap: "wrap",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: "0.875rem",
          padding: "0.5rem 0.75rem",
        }}
      >
        {TABS.map(({ label, count }) => {
          const isActive = activeTab === label;
          return (
            <button
              key={label}
              onClick={() => setActiveTab(label)}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                padding: "0.4rem 0.875rem",
                borderRadius: "0.5rem",
                border: "none",
                background: isActive ? "var(--text-primary)" : "transparent",
                color: isActive ? "var(--bg-primary)" : "var(--text-secondary)",
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.85rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {label}
              <span
                style={{
                  background: isActive ? "var(--bg-secondary)" : "var(--border)",
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  borderRadius: "9999px",
                  padding: "0.05rem 0.45rem",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Candidate Table */}
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: "0.875rem",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-primary)",
                }}
              >
                {["Candidate", "Role / Position", "Applied", "Match Score", "Matched Skills", "Missing Skills", "Status", "Update Status"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "0.875rem 1rem",
                      textAlign: "left",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                      whiteSpace: "nowrap",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                    <Loader2 size={20} style={{ animation: "spin 1s linear infinite", display: "inline-block", marginBottom: 4 }} />
                    <div>Loading candidates…</div>
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={8} style={{ padding: "3rem", textAlign: "center", color: "#ef4444", fontSize: "0.875rem" }}>
                    Error: {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                    No candidates found for this filter.
                  </td>
                </tr>
              )}

              {!loading && !error && filtered.map((c, idx) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: idx === filtered.length - 1 ? "none" : "1px solid var(--border)",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Candidate */}
                  <td style={{ padding: "0.875rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: "var(--bg-hover)",
                          color: "var(--text-primary)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 700, fontSize: "0.875rem", flexShrink: 0,
                          border: "1px solid var(--border)",
                        }}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>{c.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{c.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td style={{ padding: "0.875rem 1rem" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 500 }}>{c.role || "—"}</span>
                  </td>

                  {/* Applied date */}
                  <td style={{ padding: "0.875rem 1rem", whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {c.appliedDate ? new Date(c.appliedDate).toLocaleDateString() : "—"}
                    </span>
                  </td>

                  {/* Match Score */}
                  <td style={{ padding: "0.875rem 1rem", minWidth: 130 }}>
                    <ScoreBar score={c.computedScore} />
                  </td>

                  {/* Matched Skills */}
                  <td style={{ padding: "0.875rem 1rem", maxWidth: 200 }}>
                    {c.matchedSkills.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {c.matchedSkills.slice(0, 4).map((sk) => (
                          <span
                            key={sk}
                            style={{
                              background: "rgba(16,185,129,0.1)", color: "#10b981",
                              padding: "0.1rem 0.4rem", borderRadius: "0.375rem",
                              fontSize: "0.7rem", fontWeight: 600,
                            }}
                          >
                            {sk}
                          </span>
                        ))}
                        {c.matchedSkills.length > 4 && (
                          <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>+{c.matchedSkills.length - 4}</span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {screened ? "None" : "—"}
                      </span>
                    )}
                  </td>

                  {/* Missing Skills */}
                  <td style={{ padding: "0.875rem 1rem", maxWidth: 200 }}>
                    {c.missingSkills.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {c.missingSkills.slice(0, 4).map((sk) => (
                          <span
                            key={sk}
                            style={{
                              background: "rgba(239,68,68,0.08)", color: "#ef4444",
                              padding: "0.1rem 0.4rem", borderRadius: "0.375rem",
                              fontSize: "0.7rem", fontWeight: 600,
                            }}
                          >
                            {sk}
                          </span>
                        ))}
                        {c.missingSkills.length > 4 && (
                          <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>+{c.missingSkills.length - 4}</span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {screened ? "None" : "—"}
                      </span>
                    )}
                  </td>

                  {/* Current Status badge */}
                  <td style={{ padding: "0.875rem 1rem" }}>
                    <StatusBadge status={c.status} />
                  </td>

                  {/* Update Status dropdown */}
                  <td style={{ padding: "0.875rem 1rem" }}>
                    <StatusDropdown
                      candidateId={c.id}
                      currentStatus={c.status}
                      isUpdating={c.statusUpdating}
                      onStatusChange={handleStatusChange}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
