import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowDownUp,
  ChevronDown,
  Download,
  Mail,
  Phone,
} from "lucide-react";
import { MetricCard } from "../../components/hrDashboard";
import Button from "../../components/button/Button";
import PaginationControls from "../../components/PaginationControls";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";

type Candidate = {
  id: string | number;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  softskills: string[];
  techStack?: string;
  experience: number;
  status: string;
  uploadedAt?: string;
  resumeOriginalName?: string;
  matchScore?: number;
  role?: string;
  riskDecision?: string;
  riskScore?: number;
};

type SortKey = "name" | "experience" | "status" | "uploadedAt";
type SortDirection = "asc" | "desc";

type CandidateApiRow = {
  id?: string | number;
  _id?: string | number;
  name?: string;
  email?: string;
  status?: string;
  uploadedAt?: string;
  appliedDate?: string;
  matchScore?: number;
  role?: string;
  detectedExperience?: {
    total_experience_years?: number;
  };
  detectedSkills?: string[];
  riskAnalysis?: {
    risk_score?: number;
    decision?: string;
  };
  analysis?: {
    ai?: {
      parsedResume?: {
        personal_information?: {
          full_name?: string;
          email?: string;
          phone?: string;
        };
        experience?: {
          experience?: {
            total_experience_years?: number;
          };
        };
        skills?: {
          technical_skills?: string[];
          tools_and_technologies?: string[];
          soft_skills?: string[];
        };
        job_title?: string;
        desired_role?: string;
        objective?: string;
      };
    };
    application?: {
      role?: string;
      status?: string;
      matchScore?: number;
    };
    resume?: {
      originalName?: string;
    };
  };
};

type CandidatesApiResponse = CandidateApiRow[] | { candidates?: CandidateApiRow[] };

const statusColors: Record<string, { bg: string; color: string }> = {
  Applied: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  Shortlisted: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  "Interview Scheduled": { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
  Rejected: { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
  Offering: { bg: "rgba(168,85,247,0.12)", color: "#a855f7" },
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const PAGE_SIZE = 10;

const softSkillKeywords = [
  "communication",
  "teamwork",
  "problem solving",
  "time management",
  "leadership",
  "adaptability",
  "critical thinking",
  "collaboration",
  "creativity",
  "interpersonal skills",
  "work ethic",
  "emotional intelligence",
];

const normalizeCandidates = (data: CandidatesApiResponse): Candidate[] => {
  const rows = Array.isArray(data) ? data : data?.candidates || [];
  return rows.map((c, index: number) => {
    const parsedResume = c.analysis?.ai?.parsedResume ?? {};
    const pi = parsedResume.personal_information ?? {};
    const expData =
      c.detectedExperience ?? parsedResume.experience?.experience ?? {};
    const skillsBlock = parsedResume.skills ?? {};

    const techSkills: string[] = [
      ...(skillsBlock.technical_skills ?? []),
      ...(skillsBlock.tools_and_technologies ?? []),
    ];
    const softSkills: string[] = skillsBlock.soft_skills ?? [];

    if (!techSkills.length && !softSkills.length && c.detectedSkills?.length) {
      const detected = c.detectedSkills;
      techSkills.push(
        ...detected.filter(
          (s: string) => !softSkillKeywords.includes(s.toLowerCase()),
        ),
      );
      softSkills.push(
        ...detected.filter((s: string) =>
          softSkillKeywords.includes(s.toLowerCase()),
        ),
      );
    }

    const riskAnalysis = c.riskAnalysis ?? {};
    const riskScore =
      typeof riskAnalysis.risk_score === "number"
        ? Math.min(100, Math.max(0, 100 - riskAnalysis.risk_score))
        : null;

    const role =
      c.role && c.role !== "Applied Role"
        ? c.role
        : c.analysis?.application?.role &&
            c.analysis.application.role !== "Applied Role"
          ? c.analysis.application.role
          : parsedResume.job_title ||
            parsedResume.desired_role ||
            parsedResume.objective?.split(" ").slice(0, 4).join(" ") ||
            "";

    return {
      id: c.id || c._id || index + 1,
      name: c.name || pi.full_name || "Unknown",
      email: c.email || pi.email || "",
      phone: pi.phone || "",
      skills: techSkills,
      softskills: softSkills,
      techStack: techSkills.slice(0, 4).join(", "),
      experience: Number(expData.total_experience_years ?? 0),
      status: c.status || c.analysis?.application?.status || "Applied",
      uploadedAt: c.uploadedAt || c.appliedDate,
      resumeOriginalName: c.analysis?.resume?.originalName || "",
      matchScore: c.matchScore ?? c.analysis?.application?.matchScore ?? 0,
      role,
      riskDecision: riskAnalysis.decision ?? "",
      riskScore: riskScore ?? undefined,
    };
  });
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("uploadedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setLoading(true);
        setError(null);
        const token =
          localStorage.getItem("hr_accessToken") ||
          localStorage.getItem("accessToken");
        const response = await fetch(`${API_BASE}/api/candidate/applications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Unable to fetch candidates");
        const data = await response.json();
        setCandidates(normalizeCandidates(data));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load candidates");
      } finally {
        setLoading(false);
      }
    };
    fetchCandidates();
  }, []);

  useEffect(() => {
    const handleHeaderSearch = (event: Event) => {
      setSearchQuery((event as CustomEvent<string>).detail || "");
    };

    window.addEventListener(SEARCH_EVENT, handleHeaderSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleHeaderSearch);
  }, []);

  const statuses = useMemo(
    () => ["All", ...Array.from(new Set(candidates.map((c) => c.status)))],
    [candidates],
  );

  const visibleCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return candidates
      .filter((c) => {
        const matchesSearch =
          !query ||
          c.name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          c.phone.toLowerCase().includes(query) ||
          c.skills.some((s) => s.toLowerCase().includes(query)) ||
          c.softskills.some((s) => s.toLowerCase().includes(query));
        const matchesStatus =
          statusFilter === "All" || c.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dir = sortDirection === "asc" ? 1 : -1;
        const av = a[sortKey] || "";
        const bv = b[sortKey] || "";
        if (typeof av === "number" && typeof bv === "number")
          return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
  }, [candidates, searchQuery, statusFilter, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(visibleCandidates.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedCandidates = visibleCandidates.slice(pageStart, pageEnd);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, sortKey, sortDirection]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  };

  const stats = useMemo(
    () => ({
      total: candidates.length,
      shortlisted: candidates.filter((c) => c.status === "Shortlisted").length,
      interviews: candidates.filter((c) => c.status === "Interview Scheduled")
        .length,
      averageExperience:
        candidates.length === 0
          ? 0
          : Math.round(
              candidates.reduce((t, c) => t + c.experience, 0) /
                candidates.length,
            ),
    }),
    [candidates],
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const exportExcel = () => {
    const data = visibleCandidates.map((c) => ({
      Name: c.name,
      Email: c.email,
      Phone: c.phone,
      "Technical Skills": c.skills.join(", "),
      "Soft Skills": c.softskills.join(", "),
      Experience: `${c.experience} yrs`,
      Status: c.status,
      "Upload Date": c.uploadedAt
        ? new Date(c.uploadedAt).toLocaleDateString()
        : "-",
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 18 },
      { wch: 40 },
      { wch: 35 },
      { wch: 15 },
      { wch: 20 },
      { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Candidates");
    XLSX.writeFile(workbook, "Candidates.xlsx");
  };

  const renderStatusBadge = (status: string) => {
    const colors = statusColors[status] || statusColors.Applied;
    return (
      <span
        className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
        style={{ background: colors.bg, color: colors.color }}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="animate-fade-in px-2 sm:px-4">
     

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <MetricCard
          label="Total Candidates"
          value={String(stats.total)}
          change=""
          positive={true}
        />
        <MetricCard
          label="Shortlisted"
          value={String(stats.shortlisted)}
          change=""
          positive={true}
        />
        <MetricCard
          label="Interviews"
          value={String(stats.interviews)}
          change=""
          positive={true}
        />
        <MetricCard
          label="Avg Experience"
          value={`${stats.averageExperience} yrs`}
          change=""
          positive={true}
        />
      </div>

      {/* Main card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Toolbar */}
        <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div
              className="relative"
              tabIndex={0}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setStatusMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                onClick={() => setStatusMenuOpen((open) => !open)}
                className="py-2.5 px-4 rounded-xl text-sm focus:outline-none flex items-center justify-between gap-3"
                style={{
                  background: "var(--dropdown-bg)",
                  border: "1px solid var(--border)",
                  color: "var(--dropdown-text)",
                  minWidth: "160px",
                }}
              >
                <span>{statusFilter}</span>
                <ChevronDown size={15} />
              </button>

              {statusMenuOpen && (
                <div
                  className="absolute left-0 top-[calc(100%+0.4rem)] z-30 w-full overflow-hidden rounded-xl shadow-lg"
                  style={{
                    background: "var(--dropdown-bg)",
                    border: "1px solid var(--border)",
                    color: "var(--dropdown-text)",
                  }}
                >
                  {statuses.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setStatusFilter(s);
                        setStatusMenuOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm"
                      style={{
                        background:
                          statusFilter === s
                            ? "var(--dropdown-selected-bg)"
                            : "var(--dropdown-bg)",
                        color: "var(--dropdown-text)",
                        border: "none",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = "var(--dropdown-hover-bg)";
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background =
                          statusFilter === s ? "var(--dropdown-selected-bg)" : "var(--dropdown-bg)";
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={exportExcel}
            style={{
              width: "auto",
              padding: "0.625rem 1.25rem",
              display: "inline-flex",
              gap: "0.5rem",
              flexShrink: 0,
            }}
          >
            <Download size={15} /> Export Excel
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto px-4 sm:px-6 pb-6">
          <table
            className="w-full text-left border-collapse"
            style={{ minWidth: "900px" }}
          >
            <thead>
              <tr
                className="text-xs font-semibold"
                style={{
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {[
                  { key: "name", label: "Name" },
                  { key: "experience", label: "Experience" },
                  { key: "status", label: "Status" },
                  { key: "uploadedAt", label: "Upload Date" },
                ].map((col, index) => (
                  <th
                    key={col.key}
                    className={`py-4 px-4 whitespace-nowrap ${index === 0 ? "rounded-l-xl" : ""}`}
                  >
                    <button
                      onClick={() => handleSort(col.key as SortKey)}
                      className="flex items-center gap-1.5"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                      }}
                    >
                      {col.label} <ArrowDownUp size={13} />
                    </button>
                  </th>
                ))}
                <th className="py-4 px-4 whitespace-nowrap">Role</th>
                <th className="py-4 px-4 whitespace-nowrap">Match</th>
                <th className="py-4 px-4 whitespace-nowrap">Contact</th>
                <th className="py-4 px-4 whitespace-nowrap">
                  Technical Skills
                </th>
                <th className="py-4 px-4 whitespace-nowrap rounded-r-xl">Soft Skills</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Loading candidates...
                  </td>
                </tr>
              )}
              {!loading && visibleCandidates.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    No candidates found.
                  </td>
                </tr>
              )}
              {!loading &&
                paginatedCandidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="text-sm transition-colors"
                    style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--bg-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {/* Name */}
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-semibold text-sm"
                          style={{
                            background: "var(--icon-accent-bg)",
                            color: "var(--accent)",
                          }}
                        >
                          {candidate.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div
                            className="font-medium"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {candidate.name}
                          </div>
                          <div
                            className="text-xs mt-0.5"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {candidate.techStack ||
                              candidate.resumeOriginalName ||
                              "â€”"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Experience */}
                    <td
                      className="py-4 px-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {candidate.experience} yrs
                    </td>

                    {/* Status */}
                    <td className="py-4 px-2">
                      {renderStatusBadge(candidate.status)}
                    </td>

                    {/* Upload Date */}
                    <td
                      className="py-4 px-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {candidate.uploadedAt
                        ? new Date(candidate.uploadedAt).toLocaleDateString()
                        : "â€”"}
                    </td>

                    {/* Role */}
                    <td
                      className="py-4 px-2 whitespace-nowrap"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {candidate.role || "â€”"}
                    </td>

                    {/* Match */}
                    <td className="py-4 px-2 whitespace-nowrap font-semibold">
                      {candidate.matchScore != null &&
                      candidate.matchScore > 0 ? (
                        <span
                          style={{
                            color:
                              candidate.matchScore >= 70
                                ? "#10b981"
                                : candidate.matchScore >= 50
                                  ? "#f59e0b"
                                  : "#ef4444",
                          }}
                        >
                          {candidate.matchScore}%
                        </span>
                      ) : (
                        "â€”"
                      )}
                    </td>

                    {/* Contact */}
                    <td className="py-4 px-2">
                      <div
                        className="flex items-center gap-1.5 mb-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Mail size={13} className="shrink-0" />
                        <span className="text-xs">
                          {candidate.email || "â€”"}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-1.5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Phone size={13} className="shrink-0" />
                        <span className="text-xs">
                          {candidate.phone || "â€”"}
                        </span>
                      </div>
                    </td>

                    {/* Technical Skills */}
                    <td className="py-4 px-2">
                      <div
                        className="flex flex-wrap gap-1"
                        style={{ maxWidth: "220px" }}
                      >
                        {candidate.skills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 rounded-md text-xs"
                            style={{
                              background: "var(--icon-accent-bg)",
                              color: "var(--accent)",
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 4 && (
                          <span
                            className="px-2 py-0.5 rounded-md text-xs"
                            style={{
                              background: "var(--bg-hover)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            +{candidate.skills.length - 4}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Soft Skills */}
                    <td className="py-4 px-2">
                      <div
                        className="flex flex-wrap gap-1"
                        style={{ maxWidth: "220px" }}
                      >
                        {candidate.softskills.slice(0, 3).map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 rounded-md text-xs"
                            style={{
                              background: "var(--bg-hover)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                        {candidate.softskills.length > 3 && (
                          <span
                            className="px-2 py-0.5 rounded-md text-xs"
                            style={{
                              background: "var(--bg-hover)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            +{candidate.softskills.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!loading && (
          <PaginationControls
            currentPage={safeCurrentPage}
            totalItems={visibleCandidates.length}
            pageSize={PAGE_SIZE}
            itemLabel="candidates"
            onPageChange={goToPage}
          />
        )}
      </div>
                    </div>
  );
}
