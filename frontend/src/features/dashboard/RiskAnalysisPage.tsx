import {
  Shield,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  BookOpen,
  Zap,
  Loader2,
  Users,
  Mail,
  Phone,
  Briefcase,
  Award,
  Wrench,
  Target,
  Star,
  Cpu,
  MessageCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import api from "../../utils/axiosInstance";
import Button from "../../components/button/Button";
import RefreshButton from "../../components/button/RefreshButton";

/* â”€â”€ Types â”€â”€ */
interface RiskAnalysis {
  risk_score: number;
  decision: string;
  semantic_similarity: number;
  skill_overlap_score: number;
  matched_skills: string[];
  missing_skills: string[];
  risk_factors: string[];
  grammar_score: number;
}

interface RankingResult {
  job_fit_score: number;
  ranking: string;
  skill_score: number;
  experience_score: number;
  semantic_similarity: number;
  matched_skills: string[];
  missing_skills: string[];
}

interface ParsedResume {
  personal_information?: {
    full_name?: string;
    email?: string;
    phone?: string;
    location?: string;
  };
  experience?: {
    experience?: {
      experience_text?: string;
      total_experience_years?: number;
      total_experience_months?: number;
      experience_details?: Record<string, unknown>[];
    };
  };
  skills?: {
    technical_skills?: string[];
    soft_skills?: string[];
    tools_and_technologies?: string[];
  };
  projects?: {
    project_name?: string;
    description?: string;
    technologies_used?: string[];
    project_duration_months?: number;
  }[];
  certifications?: {
    certificate_name?: string;
    issued_by?: string;
    year?: number;
  }[];
}

interface CandidateEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  appliedDate: string;
  matchScore: number;
  status: string;
  detectedSkills: string[];
  riskAnalysis: RiskAnalysis;
  rankingResult: RankingResult;
  analysis: { ai?: { parsedResume?: ParsedResume } };
}

/* â”€â”€ Helpers â”€â”€ */
const safety = (rs: number) => Math.min(100, Math.max(0, 100 - (rs ?? 0)));
const norm = (v: number) => {
  if (v == null || isNaN(v)) return 0;
  return v <= 1 ? Math.round(v * 100) : Math.round(v);
};

const riskColor = (s: number) => {
  if (s >= 70)
    return {
      hex: "#22c55e",
      bg: "rgba(34,197,94,0.08)",
      border: "rgba(34,197,94,0.3)",
      label: "Low Risk",
      msg: "This candidate has a low risk level. Overall profile looks good!",
    };
  if (s >= 45)
    return {
      hex: "#f59e0b",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.3)",
      label: "Medium Risk",
      msg: "Some improvements recommended.",
    };
  return {
    hex: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.3)",
    label: "High Risk",
    msg: "High risk detected. Review carefully.",
  };
};

const decisionStyle = (d: string) => {
  const u = (d ?? "").toUpperCase();
  if (u === "SAFE")
    return {
      label: "Shortlist",
      color: "#16a34a",
      bg: "#dcfce7",
      border: "#bbf7d0",
    };
  if (u === "REVIEW")
    return {
      label: "Review",
      color: "#d97706",
      bg: "#fef3c7",
      border: "#fde68a",
    };
  if (u === "REJECT")
    return {
      label: "Reject",
      color: "#dc2626",
      bg: "#fee2e2",
      border: "#fecaca",
    };
  return {
    label: d || "â€”",
    color: "var(--accent)",
    bg: "var(--icon-accent-bg)",
    border: "var(--border)",
  };
};

/* â”€â”€ Reusable Components â”€â”€ */
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span style={{ color: accent || "var(--text-secondary)" }}>{icon}</span>
      <span
        className="text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </span>
    </div>
  );
}

function ScoreBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const color = "#22c55e";

  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
        <span className="text-xs font-bold" style={{ color }}>
          {value}%
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--bg-hover)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: color,
            transition: "width .7s ease",
          }}
        />
      </div>
    </div>
  );
}

function Chip({
  label,
  color,
  bg,
  border,
}: {
  label: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-medium"
      style={{ color, background: bg, border: `1px solid ${border}` }}
    >
      {label}
    </span>
  );
}

export default function RiskAnalysisPage() {
  const [candidates, setCandidates] = useState<CandidateEntry[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/candidate/applications");
      setCandidates(res.data.candidates || []);
      setIdx(0);
    } catch (e) {
      const message = axios.isAxiosError<{ message?: string }>(e)
        ? e.response?.data?.message
        : e instanceof Error
          ? e.message
          : "Failed to load risk analysis";
      setError(message || "Failed to load risk analysis");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-60 gap-3">
        <Loader2
          size={28}
          style={{
            color: "var(--accent)",
            animation: "spin 1s linear infinite",
          }}
        />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  if (error) {
    return null;
  }
  if (!candidates.length)
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-3 text-center p-6">
        <Users size={40} style={{ color: "var(--text-secondary)" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          No candidates yet. Risk analysis appears once candidates upload
          resumes.
        </p>
        <RefreshButton
          onClick={load}
          style={{
            width: "auto",
          }}
        />
      </div>
    );

  /* â”€â”€ data â”€â”€ */
  const entry = candidates[idx];
  const hasRisk = !!(
    entry.riskAnalysis && Object.keys(entry.riskAnalysis).length
  );
  const risk = (hasRisk ? entry.riskAnalysis : {}) as RiskAnalysis;
  const ranking = (entry.rankingResult ?? {}) as Partial<RankingResult>;
  const parsed = (entry.analysis?.ai?.parsedResume ?? {}) as ParsedResume;

  const pi = parsed.personal_information ?? {};
  const exp = parsed.experience?.experience ?? {};
  const skills = parsed.skills ?? {};
  const projects = parsed.projects ?? [];
  const certs = parsed.certifications ?? [];

  const candidateName = entry.name || pi.full_name || "â€”";
  const ss = safety(risk.risk_score ?? 100);
  const rc = riskColor(ss);
  const dc = decisionStyle(risk.decision ?? "");

  const semanticPct = norm(
    risk.semantic_similarity ?? ranking.semantic_similarity ?? 0,
  );
  const overlapPct = norm(risk.skill_overlap_score ?? 0);
  const grammarPct = norm(risk.grammar_score ?? 90);
  const jobFitPct = norm(ranking.job_fit_score ?? 0);
  const skillScoPct = norm(ranking.skill_score ?? 0);
  const expScoPct = norm(ranking.experience_score ?? 0);

  const matchedSkills = [
    ...new Set([
      ...(risk.matched_skills ?? []),
      ...(ranking.matched_skills ?? []),
    ]),
  ];
  const missingSkills = [
    ...new Set([
      ...(risk.missing_skills ?? []),
      ...(ranking.missing_skills ?? []),
    ]),
  ];
  const riskFactors = risk.risk_factors ?? [];

  const R = 60;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="animate-fade-in"
      style={{
        padding: "0 0.5rem lg:0 1rem",
        minWidth: 0,
        overflowX: "hidden",
        width: "100%",
      }}
    >
     
      {/* â”€â”€ Navigation â”€â”€ */}
      <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setIdx((i) => (i - 1 + candidates.length) % candidates.length)
            }
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span
            className="text-sm font-medium px-3 py-1.5 rounded-xl"
            style={{
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
            }}
          >
            {idx + 1} / {candidates.length}
          </span>
          <button
            onClick={() => setIdx((i) => (i + 1) % candidates.length)}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {!hasRisk ? (
        <Card className="p-10 text-center">
          <Shield
            size={36}
            style={{ color: "var(--text-secondary)", margin: "0 auto 1rem" }}
          />
          <h3
            className="font-semibold mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            {candidateName}
          </h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Risk analysis not available â€” candidate hasn't applied to a
            specific job yet.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {/* â”€â”€ Row 1: Candidate Brief Intro â”€â”€ */}
          <Card>
            <div
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
                  style={{
                    background: "rgba(34,197,94,0.1)",
                    border: "1px solid rgba(34,197,94,0.25)",
                    color: "#16a34a",
                  }}
                >
                  <CheckCircle2 size={12} /> Resume Parsed
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {candidateName.replace(/\s+/g, "_")}_Resume.pdf
                </span>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: dc.bg,
                  border: `1px solid ${dc.border}`,
                  color: dc.color,
                }}
              >
                {dc.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 p-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--bg-hover)",
                  border: "1px solid var(--border)",
                }}
              >
                <FileText
                  size={20}
                  style={{ color: "var(--text-secondary)" }}
                />
              </div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield
                    size={14}
                    style={{ color: "var(--text-secondary)" }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Candidate Brief Intro
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
                    gap: "1rem",
                  }}
                >
                  <div style={{ paddingBottom: "0.5rem" }}>
                    <p
                      className="text-xs mb-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Name
                    </p>
                    <p
                      className="text-base font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {candidateName}
                    </p>
                    {pi.email && (
                      <p
                        className="text-xs mt-1 flex items-center gap-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Mail size={11} />
                        {pi.email}
                      </p>
                    )}
                    {pi.phone && (
                      <p
                        className="text-xs mt-0.5 flex items-center gap-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Phone size={11} />
                        {pi.phone}
                      </p>
                    )}
                  </div>
                  <div>
                    <p
                      className="text-xs mb-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Experience
                    </p>
                    <p
                      className="text-base font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {exp.total_experience_years != null
                        ? `${exp.total_experience_years} Years`
                        : "â€”"}
                    </p>
                    {exp.experience_text && (
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {exp.experience_text}
                      </p>
                    )}
                  </div>
                  <div>
                    <p
                      className="text-xs mb-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Applied Role
                    </p>
                    <p
                      className="text-sm font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {entry.role || "â€”"}
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Applied: {entry.appliedDate || "â€”"}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Status: {entry.status || "â€”"}
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-xs mb-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Matched Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedSkills.length > 0 ? (
                        matchedSkills
                          .slice(0, 6)
                          .map((s) => (
                            <Chip
                              key={s}
                              label={s}
                              color="var(--text-secondary)"
                              bg="var(--bg-hover)"
                              border="var(--border)"
                            />
                          ))
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          â€”
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* â”€â”€ Row 2: Risk Score + Score Breakdown â”€â”€ */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Risk Score */}
            <Card className="p-6">
              <SectionTitle icon={<Shield size={16} />} title="Risk Score" />
              <div className="flex flex-col items-center">
                <div className="relative" style={{ width: 160, height: 160 }}>
                  <svg
                    width="160"
                    height="160"
                    style={{ transform: "rotate(-90deg)" }}
                  >
                    <circle
                      cx="80"
                      cy="80"
                      r={R}
                      stroke="var(--border)"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r={R}
                      stroke={rc.hex}
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={C}
                      strokeDashoffset={C * (1 - ss / 100)}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset .7s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className="text-5xl font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {ss}
                    </span>
                    <span
                      className="text-base"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      /100
                    </span>
                  </div>
                </div>
                <span
                  className="mt-4 px-4 py-1 rounded-full text-sm font-medium"
                  style={{
                    background: rc.bg,
                    border: `1px solid ${rc.border}`,
                    color: rc.hex,
                  }}
                >
                  {rc.label}
                </span>
                <p
                  className="text-center text-sm mt-3 leading-relaxed"
                  style={{ color: "var(--text-secondary)", maxWidth: 220 }}
                >
                  {rc.msg}
                </p>
                <Button
                  style={{
                    width: "auto",
                    minWidth: 160,
                    padding: "0.625rem 2rem",
                    marginTop: "1.25rem",
                    fontSize: "0.875rem",
                  }}
                >
                  {ss >= 70
                    ? "Schedule Interview"
                    : ss >= 45
                      ? "Review Profile"
                      : "Reject"}
                </Button>
              </div>
            </Card>

            {/* Score Breakdown */}
            <Card className="p-6">
              <SectionTitle
                icon={<Target size={16} />}
                title="Score Breakdown"
                accent="#6366f1"
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
                  gap: "1.25rem 2rem",
                }}
              >
                <ScoreBar
                  label="Semantic Similarity"
                  value={semanticPct}
                />
                <ScoreBar
                  label="Skill Overlap"
                  value={overlapPct}
                />
                <ScoreBar
                  label="Grammar Score"
                  value={grammarPct}
                />
                <ScoreBar label="Risk Score" value={ss} />
                <ScoreBar
                  label="Job Fit Score"
                  value={jobFitPct}
                />
                <ScoreBar
                  label="Skill Score"
                  value={skillScoPct}
                />
                <ScoreBar
                  label="Experience Score"
                  value={expScoPct}
                />
                {ranking.ranking && (
                  <div className="flex flex-col justify-center">
                    <p
                      className="text-xs mb-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Ranking
                    </p>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold w-fit"
                      style={{
                        background:
                          jobFitPct >= 80
                            ? "rgba(34,197,94,0.1)"
                            : jobFitPct >= 60
                              ? "rgba(59,130,246,0.1)"
                              : jobFitPct >= 40
                                ? "rgba(245,158,11,0.1)"
                                : "rgba(239,68,68,0.1)",
                        color:
                          jobFitPct >= 80
                            ? "#22c55e"
                            : jobFitPct >= 60
                              ? "#3b82f6"
                              : jobFitPct >= 40
                                ? "#f59e0b"
                                : "#ef4444",
                        border: `1px solid ${jobFitPct >= 80 ? "rgba(34,197,94,0.3)" : jobFitPct >= 60 ? "rgba(59,130,246,0.3)" : "rgba(245,158,11,0.3)"}`,
                      }}
                    >
                      {ranking.ranking}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* â”€â”€ Row 3: Missing Skills + Risk Factors â”€â”€ */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
              gap: "1.25rem",
            }}
          >
            <Card className="p-5">
              <SectionTitle
                icon={<BookOpen size={15} />}
                title="Missing Skills"
                accent="var(--text-secondary)"
              />
              {missingSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {missingSkills.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      color="var(--text-secondary)"
                      bg="var(--bg-hover)"
                      border="var(--border)"
                    />
                  ))}
                </div>
              ) : (
                <p
                  className="text-sm flex items-center gap-2"
                  style={{ color: "#22c55e" }}
                >
                  <CheckCircle2 size={14} />
                  No missing skills â€” full match!
                </p>
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle
                icon={<AlertTriangle size={15} />}
                title="Risk Factors"
                accent="var(--text-secondary)"
              />
              {riskFactors.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {riskFactors.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Zap
                        size={13}
                        className="shrink-0 mt-0.5"
                        style={{ color: "#f59e0b" }}
                      />
                      <span
                        className="text-sm"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  className="text-sm flex items-center gap-2"
                  style={{ color: "#22c55e" }}
                >
                  <CheckCircle2 size={14} />
                  No risk factors identified.
                </p>
              )}
            </Card>
          </div>

          {/* â”€â”€ Row 4: Skills (3 equal columns) â”€â”€ */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
              gap: "1.25rem",
            }}
          >
            <Card className="p-5">
              <SectionTitle
                icon={<Cpu size={15} />}
                title="Technical Skills"
                accent="var(--text-secondary)"
              />
              {skills.technical_skills?.length ? (
                <div className="flex flex-wrap gap-2">
                  {skills.technical_skills.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      color="var(--text-secondary)"
                      bg="var(--bg-hover)"
                      border="var(--border)"
                    />
                  ))}
                </div>
              ) : (
                <p
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  None detected
                </p>
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle
                icon={<MessageCircle size={15} />}
                title="Soft Skills"
                accent="var(--text-secondary)"
              />
              {skills.soft_skills?.length ? (
                <div className="flex flex-wrap gap-2">
                  {skills.soft_skills.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      color="var(--text-secondary)"
                      bg="var(--bg-hover)"
                      border="var(--border)"
                    />
                  ))}
                </div>
              ) : (
                <p
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  None detected
                </p>
              )}
            </Card>
            <Card className="p-5">
              <SectionTitle
                icon={<Wrench size={15} />}
                title="Tools & Technologies"
                accent="var(--text-secondary)"
              />
              {skills.tools_and_technologies?.length ? (
                <div className="flex flex-wrap gap-2">
                  {skills.tools_and_technologies.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      color="var(--text-secondary)"
                      bg="var(--bg-hover)"
                      border="var(--border)"
                    />
                  ))}
                </div>
              ) : (
                <p
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  None detected
                </p>
              )}
            </Card>
          </div>

          {/* â”€â”€ Row 5: Projects + Certifications â”€â”€ */}
          {(projects.length > 0 || certs.length > 0) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
                gap: "1.25rem",
              }}
            >
              {projects.length > 0 && (
                <Card className="p-5">
                  <SectionTitle
                    icon={<Briefcase size={15} />}
                    title={`Projects (${projects.length})`}
                    accent="#f59e0b"
                  />
                  <div className="flex flex-col gap-3">
                    {projects.map((p, i) => (
                      <div
                        key={i}
                        className="rounded-xl p-3"
                        style={{
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <p
                          className="text-sm font-semibold mb-1"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {p.project_name || `Project ${i + 1}`}
                        </p>
                        {p.description && (
                          <p
                            className="text-xs mb-2 leading-relaxed"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {p.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {p.technologies_used?.map((t) => (
                            <Chip
                              key={t}
                              label={t}
                              color="var(--text-secondary)"
                              bg="var(--bg-hover)"
                              border="var(--border)"
                            />
                          ))}
                        </div>
                        {(p.project_duration_months ?? 0) > 0 && (
                          <p
                            className="text-xs mt-1.5"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Duration: {p.project_duration_months} months
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              {certs.length > 0 && (
                <Card className="p-5">
                  <SectionTitle
                    icon={<Award size={15} />}
                    title={`Certifications (${certs.length})`}
                    accent="#f59e0b"
                  />
                  <div className="flex flex-col gap-3">
                    {certs.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl p-3"
                        style={{
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: "rgba(245,158,11,0.1)",
                            border: "1px solid rgba(245,158,11,0.2)",
                          }}
                        >
                          <Star size={14} style={{ color: "#f59e0b" }} />
                        </div>
                        <div>
                          <p
                            className="text-sm font-medium"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {c.certificate_name}
                          </p>
                          {c.issued_by && (
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {c.issued_by}
                            </p>
                          )}
                          {(c.year ?? 0) > 0 && (
                            <p
                              className="text-xs"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {c.year}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* â”€â”€ Row 6: All Detected Skills â”€â”€ */}
          {entry.detectedSkills?.length > 0 && (
            <Card className="p-5">
              <SectionTitle
                icon={<CheckCircle2 size={15} />}
                title={`All Detected Skills (${entry.detectedSkills.length})`}
                accent="#22c55e"
              />
              <div className="flex flex-wrap gap-2">
                {entry.detectedSkills.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    color="var(--text-secondary)"
                    bg="var(--bg-hover)"
                    border="var(--border)"
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
