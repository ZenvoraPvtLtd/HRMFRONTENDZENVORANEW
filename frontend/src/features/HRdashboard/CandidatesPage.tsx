import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ChevronDown, Eye, Loader2, Mail, Phone, X } from "lucide-react";
import { MetricCard } from "../../components/hrDashboard";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import PaginationControls from "../../components/PaginationControls";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";
import { getApiBaseUrl } from "../../config/apiConfig";

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  company: string;
  status: string;
  appliedDate: string;
  resumeUrl: string;
  resumeOriginalName: string;
  portfolio: string;
  linkedin: string;
  technicalSkills: string[];
  softSkills: string[];
  matchScore: number;
};

type SortKey = "name" | "role" | "status" | "appliedDate";
type SortDirection = "asc" | "desc";

const statusColors: Record<string, { bg: string; color: string }> = {
  pending:               { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  Applied:               { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  Shortlisted:           { bg: "rgba(16,185,129,0.12)",  color: "#10b981" },
  shortlisted:           { bg: "rgba(16,185,129,0.12)",  color: "#10b981" },
  "Interview Scheduled": { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  Rejected:              { bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
  rejected:              { bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
  Offering:              { bg: "rgba(168,85,247,0.12)",  color: "#a855f7" },
};

const API_BASE = getApiBaseUrl();
const PAGE_SIZE = 10;

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState("All");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("appliedDate");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [resumePreview, setResumePreview] = useState<{ url: string; name: string } | null>(null);
  const [resumeLoadingId, setResumeLoadingId] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setLoading(true);
        setError(null);
        const token =
          localStorage.getItem("hr_accessToken") ||
          localStorage.getItem("accessToken");
        const res = await fetch(`${API_BASE}/api/candidate/applications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        console.log("[CandidatesPage] Candidate applications API response:", data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = Array.isArray(data) ? data : data?.candidates || [];
        setCandidates(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows.map((c: any, i: number) => ({
            id: c.id || c._id || String(i + 1),
            name: c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Unknown",
            email: c.email || "",
            phone: String(c.phone || ""),
            role: c.role || c.jobTitle || "",
            company: c.company || "",
            status: c.status || "pending",
            appliedDate: c.appliedDate || c.createdAt || "",
            resumeUrl: c.resumeUrl || "",
            resumeOriginalName: c.resumeOriginalName || "",
            portfolio: c.portfolio || "",
            linkedin: c.linkedin || "",
            technicalSkills: Array.isArray(c.technicalSkills) ? c.technicalSkills : [],
            softSkills: Array.isArray(c.softSkills) ? c.softSkills : [],
            matchScore: c.matchScore || 0,
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load candidates");
      } finally {
        setLoading(false);
      }
    };
    fetchCandidates();
  }, []);

  useEffect(() => {
    const handleSearch = (e: Event) => {
      setSearchQuery((e as CustomEvent<string>).detail || "");
      setCurrentPage(1);
    };
    window.addEventListener(SEARCH_EVENT, handleSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleSearch);
  }, []);

  const statuses = useMemo(
    () => ["All", ...Array.from(new Set(candidates.map((c) => c.status)))],
    [candidates]
  );

  const visible = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return candidates
      .filter((c) => {
        const matchSearch =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.technicalSkills.some((s) => s.toLowerCase().includes(q));
        const matchStatus = statusFilter === "All" || c.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        return String(a[sortKey] || "").localeCompare(String(b[sortKey] || "")) * dir;
      });
  }, [candidates, debouncedSearch, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const resolveResumeUrl = (resumeUrl: string) => {
    if (/^https?:\/\//i.test(resumeUrl)) return resumeUrl;
    const path = resumeUrl.startsWith("/") ? resumeUrl : `/${resumeUrl}`;
    return `${API_BASE}${path}`;
  };

  const handleViewResume = async (candidate: Candidate) => {
    if (!candidate.resumeUrl) return;

    const fileUrl = resolveResumeUrl(candidate.resumeUrl);
    console.log("[CandidatesPage] Resume URL being used:", fileUrl);
    setResumeLoadingId(candidate.id);
    setResumeError(null);

    try {
      const res = await fetch(fileUrl, { method: "HEAD" });
      const contentType = res.headers.get("content-type") || "";
      const exists = res.ok && contentType.toLowerCase().includes("application/pdf");
      console.log("[CandidatesPage] Resume file existence check result:", {
        url: fileUrl,
        status: res.status,
        ok: res.ok,
        contentType,
        exists,
      });

      if (exists) {
        setResumePreview({
          url: fileUrl,
          name: candidate.resumeOriginalName || `${candidate.name} resume`,
        });
        return;
      }

      setResumeError("Resume is currently unavailable.");
    } catch (err) {
      console.log("[CandidatesPage] Resume file existence check result:", {
        url: fileUrl,
        exists: false,
        error: err instanceof Error ? err.message : String(err),
      });
      setResumeError("Resume is currently unavailable.");
    } finally {
      setResumeLoadingId(null);
    }
  };

  const stats = useMemo(() => ({
    total: candidates.length,
    shortlisted: candidates.filter((c) => c.status.toLowerCase() === "shortlisted").length,
    interviews: candidates.filter((c) => c.status === "Interview Scheduled").length,
    pending: candidates.filter((c) => c.status.toLowerCase() === "pending").length,
  }), [candidates]);

  const renderStatus = (status: string) => {
    const col = statusColors[status] || statusColors.pending;
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return (
      <span
        className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
        style={{ background: col.bg, color: col.color }}
      >
        {label}
      </span>
    );
  };

  const SORT_COLS: { key: SortKey; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "role", label: "Job Applied For" },
    { key: "status", label: "Status" },
    { key: "appliedDate", label: "Applied Date" },
  ];

  return (
    <div className="animate-fade-in px-2 sm:px-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <MetricCard label="Total Candidates" value={String(stats.total)} change="" positive={true} />
        <MetricCard label="Pending" value={String(stats.pending)} change="" positive={true} />
        <MetricCard label="Shortlisted" value={String(stats.shortlisted)} change="" positive={true} />
        <MetricCard label="Interviews" value={String(stats.interviews)} change="" positive={true} />
      </div>

      {/* Card */}
      <div
        className="rounded-2xl"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        {/* Toolbar */}
        <div className="p-4 sm:p-6 flex items-center gap-4 relative z-20">
          <div
            className="relative"
            tabIndex={0}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                setStatusMenuOpen(false);
            }}
          >
            <button
              type="button"
              onClick={() => setStatusMenuOpen((o) => !o)}
              className="py-2.5 px-4 rounded-xl text-sm focus:outline-none flex items-center gap-3"
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
                className="absolute left-0 top-[calc(100%+0.4rem)] z-50 w-full overflow-hidden rounded-xl shadow-lg"
                style={{ background: "var(--dropdown-bg)", border: "1px solid var(--border)" }}
              >
                {statuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setStatusFilter(s); setStatusMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm"
                    style={{
                      background: statusFilter === s ? "var(--dropdown-selected-bg)" : "var(--dropdown-bg)",
                      color: "var(--dropdown-text)",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--dropdown-hover-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = statusFilter === s ? "var(--dropdown-selected-bg)" : "var(--dropdown-bg)")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto px-4 sm:px-6 pb-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className="text-xs font-semibold"
                style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                {SORT_COLS.map((col, i) => (
                  <th key={col.key} className={`py-4 px-4 whitespace-nowrap ${i === 0 ? "rounded-l-xl" : ""}`}>
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1.5"
                      style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}
                    >
                      {col.label} <ArrowDownUp size={13} />
                    </button>
                  </th>
                ))}
                <th className="py-4 px-4 whitespace-nowrap">Contact</th>
                <th className="py-4 px-4 whitespace-nowrap">Technical Skills</th>
                <th className="py-4 px-4 whitespace-nowrap">Soft Skills</th>
                <th className="py-4 px-4 whitespace-nowrap rounded-r-xl">Resume</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                    Loading candidates...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm" style={{ color: "#ef4444" }}>
                    Error: {error}
                  </td>
                </tr>
              )}
              {!loading && !error && visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                    No candidates found.
                  </td>
                </tr>
              )}
              {!loading &&
                paginated.map((c) => (
                  <tr
                    key={c.id}
                    className="text-sm transition-colors"
                    style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Candidate */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-semibold text-sm"
                          style={{ background: "var(--icon-accent-bg)", color: "var(--accent)" }}
                        >
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                            {c.name}
                          </div>
                          {c.portfolio && (
                            <a href={c.portfolio} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: "var(--accent)" }}>
                              Portfolio
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Job Applied For */}
                    <td className="py-4 px-4" style={{ color: "var(--text-primary)" }}>
                      <div className="font-medium">{c.role || "—"}</div>
                      {c.company && (
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{c.company}</div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">{renderStatus(c.status)}</td>

                    {/* Applied Date */}
                    <td className="py-4 px-4" style={{ color: "var(--text-secondary)" }}>
                      {c.appliedDate ? new Date(c.appliedDate).toLocaleDateString() : "—"}
                    </td>

                    {/* Contact */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 mb-1" style={{ color: "var(--text-secondary)" }}>
                        <Mail size={13} className="shrink-0" />
                        <span className="text-xs">{c.email || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                        <Phone size={13} className="shrink-0" />
                        <span className="text-xs">{c.phone || "—"}</span>
                      </div>
                    </td>

                    {/* Technical Skills */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1" style={{ maxWidth: "200px" }}>
                        {c.technicalSkills.length > 0 ? (
                          <>
                            {c.technicalSkills.slice(0, 4).map((skill) => (
                              <span
                                key={skill}
                                className="px-2 py-0.5 rounded-md text-xs"
                                style={{ background: "var(--icon-accent-bg)", color: "var(--accent)" }}
                              >
                                {skill}
                              </span>
                            ))}
                            {c.technicalSkills.length > 4 && (
                              <span className="px-2 py-0.5 rounded-md text-xs" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                                +{c.technicalSkills.length - 4}
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Soft Skills */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1" style={{ maxWidth: "180px" }}>
                        {c.softSkills.length > 0 ? (
                          <>
                            {c.softSkills.slice(0, 3).map((skill) => (
                              <span
                                key={skill}
                                className="px-2 py-0.5 rounded-md text-xs"
                                style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                              >
                                {skill}
                              </span>
                            ))}
                            {c.softSkills.length > 3 && (
                              <span className="px-2 py-0.5 rounded-md text-xs" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                                +{c.softSkills.length - 3}
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Resume */}
                    <td className="py-4 px-4">
                      {c.resumeUrl ? (
                        <button
                          type="button"
                          onClick={() => handleViewResume(c)}
                          disabled={resumeLoadingId === c.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{
                            background: "var(--icon-accent-bg)",
                            color: "var(--accent)",
                            border: "none",
                            cursor: resumeLoadingId === c.id ? "wait" : "pointer",
                            opacity: resumeLoadingId === c.id ? 0.75 : 1,
                          }}
                        >
                          {resumeLoadingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                          {resumeLoadingId === c.id ? "Loading" : "View"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Resume not uploaded."
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{
                            background: "var(--bg-hover)",
                            color: "var(--text-secondary)",
                            border: "none",
                            cursor: "not-allowed",
                            opacity: 0.65,
                          }}
                        >
                          <Eye size={13} /> View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {resumeError && (
            <div className="mt-4 rounded-lg px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
              {resumeError}
            </div>
          )}
        </div>

        {!loading && (
          <PaginationControls
            currentPage={safePage}
            totalItems={visible.length}
            pageSize={PAGE_SIZE}
            itemLabel="candidates"
            onPageChange={(p) => setCurrentPage(Math.min(Math.max(p, 1), totalPages))}
          />
        )}
      </div>
      {resumePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.72)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Resume preview"
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between gap-4 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {resumePreview.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResumePreview(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "var(--bg-hover)", color: "var(--text-primary)", border: "none", cursor: "pointer" }}
                aria-label="Close resume preview"
              >
                <X size={16} />
              </button>
            </div>
            <iframe
              title="Resume preview"
              src={resumePreview.url}
              className="block w-full"
              style={{ height: "min(78vh, 760px)", background: "var(--bg-primary)", border: 0 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
