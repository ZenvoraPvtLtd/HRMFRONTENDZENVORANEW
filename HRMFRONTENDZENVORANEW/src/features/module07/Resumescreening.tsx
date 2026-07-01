import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";

import { card, cardInner, input, inputMuted  } from "../HRdashboard/hrTheme";

type APIResponse = MatchResponse | { detail: string };

type Status = "Shortlisted" |  "Review" | "Rejected";

interface MatchResult {
  candidate_name: string;
  file_name: string;
  match_score: number;
  status: Status;
  matched_skills: string[];
  missing_skills: string[];
  experience_years: number | null;
  education: string | null;
  email: string | null;
  phone: string | null;
  summary: string;
}

interface MatchResponse {
  job_title: string;
  total_resumes: number;
  shortlisted: number;
  results: MatchResult[];
}

const API_BASE = import.meta.env.VITE_API_URL || "https://zenvorahrmbackend-lu14.onrender.com";

const statuses: Array<"All" | Status> = ["All", "Shortlisted", "Review", "Rejected"];
type FilterStatus = (typeof statuses)[number];

const fileTypeLabel = (name: string) =>
  name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOC";

// ─── Sub-components ────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <div style={{ position: "relative", width: 50, height: 50, flexShrink: 0 }}>
      <svg width="50" height="50" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="25" cy="25" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle cx="25" cy="25" r={r} fill="none" stroke="var(--accent)" strokeWidth="3"
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)" }}>{Math.round(score)}</span>
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>/ 100</span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {

 const bg =
  status === "Rejected"
    ? "rgba(239,68,68,0.12)"
    : status === "Review"
    ? "rgba(245,158,11,0.12)"
    : "rgba(16,185,129,0.12)";

const color =
  status === "Rejected"
    ? "#ef4444"
    : status === "Review"
    ? "#f59e0b"
    : "#10b981";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px",
      borderRadius: 999, border: "1px solid var(--border)", background: bg, color, fontSize: 12, fontWeight: 600 }}>
      <CheckCircle2 size={14} style={{ opacity: 0.85 }} />
      {status}
    </span>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
      color: "var(--text-secondary)", marginBottom: 10 }}>
      {title.toUpperCase()}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 700,
      color: "var(--text-secondary)", marginBottom: 6 }}>
      {children}
    </label>
  );
}



function FileChip({ name }: { name: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 12px",
      borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-hover)" }}>
      <FileText size={16} />
      <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 12 }}>{fileTypeLabel(name)}</span>
      <span style={{ color: "var(--text-secondary)", fontSize: 12, maxWidth: 220,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    </span>
  );
}

function MatchCard({ r, selected, onClick }: { r: MatchResult; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      style={{ ...card, padding: 14, borderRadius: 14,
        border: selected ? "1px solid var(--text-primary)" : "1px solid var(--border)",
        cursor: "pointer", transition: "transform 0.15s ease, border-color 0.15s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 14,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.candidate_name}
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center" }}>
            <FileText size={16} color="var(--text-secondary)" />
            <div style={{ color: "var(--text-secondary)", fontSize: 12, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
              {r.file_name}
            </div>
          </div>
        </div>
        <ScoreRing score={r.match_score} />
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {r.experience_years != null && (
          <span style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid var(--border)",
            background: "var(--bg-hover)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 700 }}>
            {r.experience_years}y exp
          </span>
        )}
        {r.matched_skills.slice(0, 3).map((s) => (
          <span key={s} style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid var(--border)",
            background: "var(--bg-hover)", color: "var(--text-primary)", fontSize: 12 }}>{s}</span>
        ))}
        {r.matched_skills.length > 3 && (
          <span style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid var(--border)",
            background: "var(--bg-hover)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 700 }}>
            +{r.matched_skills.length - 3}
          </span>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 10 }}>
        <StatusPill status={r.status} />
        <span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>
          {r.matched_skills.length} skills matched
        </span>
      </div>
    </div>
  );
}

function DetailDrawer({
  r,
  onClose,
  onShortlist,
  onReject,
}: {
  r: MatchResult;
  onClose: () => void;
  onShortlist: (fileName: string) => void;
  onReject: (fileName: string) => void;
}) {
  const isDecided = r.status === "Shortlisted" || r.status === "Rejected";

  return (
    <div style={{ padding: 16 }}>
      {/* …keep all your existing header / score / sections exactly as they are… */}

      {/* Replace ONLY the buttons block at the bottom with this: */}
      {isDecided ? (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg-hover)",
            color: r.status === "Shortlisted" ? "#10b981" : "#ef4444",
            fontWeight: 900,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {r.status === "Shortlisted" ? (
            <CheckCircle2 size={16} />
          ) : (
            <XCircle size={16} />
          )}
          {r.status === "Shortlisted"
            ? "Candidate is shortlisted"
            : "Candidate is rejected"}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button
            onClick={() => {
              onShortlist(r.file_name);
              onClose();
            }}
            style={{
              flex: 1,
              minWidth: 200,
              ...input,
              background: "var(--accent)",
              color: "var(--accent-text)",
              border: "none",
              borderRadius: 12,
              padding: "12px 14px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Move to Shortlist
          </button>
          <button
            onClick={() => {
              onReject(r.file_name);
              onClose();
            }}
            style={{
              flex: 1,
              minWidth: 160,
              ...inputMuted,
              background: "rgba(239,68,68,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              fontWeight: 900,
              cursor: "pointer",
              border: "1px solid var(--border)",
              color: "#ef4444",
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}


// ─── Empty / no-results states ─────────────────────────────────────────────

function EmptyResults({ filtered, total }: { filtered: number; total: number }) {
  if (total === 0) {
    return (
      <div style={{ ...card, padding: 32, borderRadius: 14, textAlign: "center" }}>
        <XCircle size={36} style={{ color: "var(--text-secondary)", opacity: 0.4, marginBottom: 12 }} />
        <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          No resumes could be processed
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
          The file may be image-based, scanned, or corrupt. Try a DOCX version, or ensure
          Tesseract OCR is installed on the server for scanned PDF support.
        </div>
      </div>
    );
  }
  if (filtered === 0) {
    return (
      <div style={{ ...card, padding: 24, borderRadius: 14, textAlign: "center",
        color: "var(--text-secondary)", fontSize: 13 }}>
        No candidates match this filter.
      </div>
    );
  }
  return null;
}

// ─── Main component ────────────────────────────────────────────────────────

export default function ResumeScreening() {
  const [files, setFiles] = useState<File[]>([]);
  const [jobTitle, setJobTitle] = useState("");
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<MatchResponse | null>(null);
  const [selected, setSelected] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("All");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── File management ──────────────────────────────────────────────────────

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter((f) =>
      [".pdf", ".docx", ".doc"].some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = useCallback((name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name)), []);

  // ── Status update handlers (wired to Shortlist / Reject buttons) ─────────

  const updateCandidateStatus = useCallback((fileName: string, newStatus: Status) => {
    setResponse((prev) => {
      if (!prev) return prev;
      const results = prev.results.map((r) =>
        r.file_name === fileName ? { ...r, status: newStatus } : r
      );
      return {
        ...prev,
        results,
        shortlisted: results.filter((r) => r.status === "Shortlisted").length,
      };
    });
  }, []);

  const handleShortlist = useCallback((fileName: string) =>
    updateCandidateStatus(fileName, "Shortlisted"), [updateCandidateStatus]);

  const handleReject = useCallback((fileName: string) =>
    updateCandidateStatus(fileName, "Rejected"), [updateCandidateStatus]);

  // ── Filtered results ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const results = response?.results ?? [];
    if (filterStatus === "All") return results;
    return results.filter((r) => r.status === filterStatus);
  }, [response, filterStatus]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (files.length === 0) { setError("Upload at least one resume."); return; }
    if (!jobTitle.trim()) { setError("Enter a job title."); return; }
    if (!jdText.trim()) { setError("Enter the job description."); return; }

    setError("");
    setLoading(true);
    setResponse(null);
    setSelected(null);

    try {
      const fd = new FormData();
      fd.append("job_title", jobTitle);
      fd.append("job_description", jdText);
      files.forEach((f) => fd.append("resumes", f));

      const res = await fetch(`${API_BASE}/api/resume/match`, { method: "POST", body: fd });
      const data: APIResponse = await res.json();

      if (!res.ok) {
        const err = data as { detail?: string };
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      setResponse(data as MatchResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect to API.");
    } finally {
      setLoading(false);
    }
  }, [files, jobTitle, jdText]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .resume-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="hr-page">
        <div style={{ padding: 18, maxWidth: 1360, margin: "0 auto" }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, maxWidth: 720 }}>
              Upload candidate resumes and paste a job description — the engine matches each resume against your requirements.
            </div>
          </div>

          <div className="resume-grid" style={{
            display: "grid",
            gridTemplateColumns: response ? "440px 1fr" : "1fr",
            gap: 16,
            alignItems: "start",
          }}>

            {/* ── Left: Input panel ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...card, padding: 14, borderRadius: 16 }}>
                <SectionTitle title="Job Details" />

                <div style={{ marginBottom: 12 }}>
                  <FieldLabel>Job Title *</FieldLabel>
                  <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer"
                    style={{ width: "100%", ...input, borderRadius: 12, padding: "10px 14px", fontSize: 13 }} />
                </div>

                <div>
                  <FieldLabel>Job Description *</FieldLabel>
                  <textarea value={jdText} onChange={(e) => setJdText(e.target.value)}
                    rows={8} placeholder="Paste the full job description here..."
                    style={{ width: "100%", ...input, borderRadius: 12, padding: "10px 14px",
                      fontSize: 13, resize: "vertical", lineHeight: 1.6 }} />
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)", textAlign: "right" }}>
                    {jdText.length} chars
                  </div>
                </div>
              </div>

              <div style={{ ...card, padding: 14, borderRadius: 16 }}>
                <SectionTitle title="Upload Resumes" />

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 14, padding: 16,
                    background: dragging ? "var(--bg-hover)" : "transparent", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                    <UploadCloud size={20} />
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontWeight: 900, color: "var(--text-primary)", marginBottom: 4 }}>
                        {dragging ? "Drop resumes here" : "Drag & drop resumes"}
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                        PDF, DOCX, DOC · Multiple files supported
                      </div>
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc"
                    style={{ display: "none" }}
                    onChange={(e) => e.target.files && addFiles(e.target.files)} />
                </div>

                {files.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    {files.map((f) => (
                      <div key={f.name} style={{ display: "flex", alignItems: "center",
                        justifyContent: "space-between", gap: 10, border: "1px solid var(--border)",
                        background: "var(--bg-hover)", borderRadius: 12, padding: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <FileChip name={f.name} />
                          <div style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 12 }}>
                            {Math.round(f.size / 1024)} KB
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                          style={{ border: "1px solid var(--border)", background: "transparent",
                            borderRadius: 12, width: 38, height: 38, cursor: "pointer",
                            color: "var(--text-primary)", display: "flex", alignItems: "center",
                            justifyContent: "center" }} aria-label={`Remove ${f.name}`}>
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div style={{ border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.12)",
                  color: "var(--text-primary)", borderRadius: 14, padding: 12,
                  display: "flex", gap: 10, alignItems: "center" }}>
                  <XCircle size={18} />
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{error}</div>
                </div>
              )}

              <button onClick={handleSubmit} disabled={loading}
                style={{ width: "100%", borderRadius: 14, padding: "12px 14px", fontWeight: 900,
                  cursor: loading ? "not-allowed" : "pointer",
                  background: loading ? "var(--bg-hover)" : "var(--accent)",
                  color: loading ? "var(--text-secondary)" : "var(--accent-text)", border: "none" }}>
                {loading ? "Analyzing resumes..." : `Screen ${files.length} resume${files.length === 1 ? "" : "s"}`}
              </button>
            </div>

            {/* ── Right: Results panel ── */}
            {response && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                  {[
                    { label: "Total Screened", val: response.total_resumes },
                    { label: "Shortlisted", val: response.shortlisted },
                    { label: "Needs Review", val: response.results.filter((r) => r.status === "Review").length },
                     { label: "Rejected", val: response.results.filter((r) => r.status === "Rejected").length },
                  ].map((s) => (
                    <div key={s.label} style={{ ...card, borderRadius: 14, padding: 12 }}>
                      <div style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 900,
                        letterSpacing: "0.06em", marginBottom: 6 }}>{s.label.toUpperCase()}</div>
                      <div style={{ color: "var(--text-primary)", fontSize: 22, fontWeight: 900 }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Filter bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 900 }}>Filter:</div>
                  {statuses.map((s) => {
                    const active = filterStatus === s;
                    return (
                      <button key={s} onClick={() => setFilterStatus(s)}
                        style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid var(--border)",
                          background: active ? "var(--bg-hover)" : "transparent", cursor: "pointer",
                          color: "var(--text-primary)", fontWeight: 900, fontSize: 12 }}>
                        {s}
                      </button>
                    );
                  })}
                  <div style={{ marginLeft: "auto", color: "var(--text-secondary)", fontSize: 12, fontWeight: 900 }}>
                    {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Cards grid or empty state */}
                {response.total_resumes === 0 || filtered.length === 0 ? (
                  <EmptyResults filtered={filtered.length} total={response.total_resumes} />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                      {filtered.map((r) => (
                        <MatchCard key={r.file_name} r={r}
                          selected={selected?.file_name === r.file_name}
                          onClick={() => setSelected((prev) => prev?.file_name === r.file_name ? null : r)} />
                      ))}
                    </div>

                    {selected && (
                      <div style={{ ...cardInner, borderRadius: 14 }}>
                        <DetailDrawer
                          r={selected}
                          onClose={() => setSelected(null)}
                          onShortlist={handleShortlist}
                          onReject={handleReject}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!response && <div style={{ height: 1 }} />}
          </div>
        </div>
      </div>
    </>
  );
}