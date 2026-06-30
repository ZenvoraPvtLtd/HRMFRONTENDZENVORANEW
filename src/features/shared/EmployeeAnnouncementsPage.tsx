import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, MessageSquare, Tag, Users } from "lucide-react";
import api from "../../utils/axiosInstance";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";

type AnnouncementItem = {
  id: string;
  title: string;
  message: string;
  priority: string;
  status: string;
  targetType: string;
  expiresAt: string;
  createdAt: string;
};

// Handle DD/MM/YYYY, YYYY-MM-DD, and ISO timestamp strings
function parseAnnouncementDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) return new Date(dateStr);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(`${dateStr}T00:00:00`);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("/");
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }
  return new Date(dateStr);
}

// Visible on the expiry date and before; hidden from the next calendar day onward
// Announcements with no expiresAt are always visible
function isAnnouncementVisible(expiresAt: string): boolean {
  if (!expiresAt) return true;
  const expiry = parseAnnouncementDate(expiresAt);
  if (isNaN(expiry.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return expiry >= today;
}

function formatDate(dateStr: string): string {
  const d = parseAnnouncementDate(dateStr);
  if (isNaN(d.getTime())) return dateStr || "-";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  High:   { bg: "rgba(239,68,68,0.12)",  color: "#ef4444" },
  Medium: { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  Low:    { bg: "rgba(16,185,129,0.12)",  color: "#10b981" },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Published: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  Draft:     { bg: "rgba(156,163,175,0.12)", color: "#9ca3af" },
};

export default function EmployeeAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search] = useTopHeaderSearch();
  const [searchParams] = useSearchParams();
  const highlightTitle = searchParams.get("highlight") ?? "";
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get<AnnouncementItem[]>("/api/announcements");
        if (!active) return;
        const all = Array.isArray(res.data) ? res.data : [];
        // Audience rule: only "All Employees" announcements reach the employee page
        // Status rule: only Published announcements are visible
        // Expiry rule: hide the day after the expiry date
        const visible = all.filter(
          (a) =>
            a.targetType === "All Employees" &&
            a.status === "Published" &&
            isAnnouncementVisible(a.expiresAt)
        );
        setAnnouncements(visible);
      } catch {
        if (active) setError("Failed to load announcements. Please try again later.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  // After announcements load, scroll the highlighted card into view
  useEffect(() => {
    if (!highlightTitle || !highlightRef.current) return;
    const timer = setTimeout(
      () => highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      200
    );
    return () => clearTimeout(timer);
  }, [announcements, highlightTitle]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return announcements;
    return announcements.filter((a) =>
      [a.title, a.message, a.priority, a.status, a.targetType, a.expiresAt]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [announcements, search]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <div
            className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent"
            style={{ borderColor: "var(--accent)" }}
          />
          Loading announcements...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          {/* Company Announcements */}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Important announcements and updates for all employees
        </p>
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-16 text-center"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: "var(--icon-accent-bg)", color: "var(--accent)" }}
          >
            <MessageSquare size={22} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {search ? "No announcements match your search" : "No announcements"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {search
              ? "Try a different search term"
              : "Check back soon for company announcements"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((announcement) => {
            const isHighlighted =
              !!highlightTitle &&
              announcement.title.toLowerCase().includes(highlightTitle.toLowerCase());
            const prStyle =
              PRIORITY_STYLE[announcement.priority] ??
              { bg: "rgba(99,102,241,0.12)", color: "#6366f1" };
            const stStyle = STATUS_STYLE[announcement.status] ?? STATUS_STYLE.Published;

            return (
              <div
                key={announcement.id}
                ref={isHighlighted ? highlightRef : undefined}
                className="rounded-2xl p-4 flex flex-col gap-3 transition-shadow hover:shadow-md"
                style={{
                  background: "var(--bg-secondary)",
                  border: isHighlighted
                    ? "2px solid var(--accent)"
                    : "1px solid var(--border)",
                  boxShadow: isHighlighted
                    ? "0 0 0 4px var(--icon-accent-bg)"
                    : undefined,
                }}
              >
                {/* Title + status */}
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className="text-sm font-bold leading-snug"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {announcement.title}
                  </h3>
                  <span
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0"
                    style={{ background: stStyle.bg, color: stStyle.color }}
                  >
                    {announcement.status}
                  </span>
                </div>

                {/* Priority chip */}
                {announcement.priority && (
                  <div className="flex items-center gap-1.5">
                    <Tag size={12} style={{ color: prStyle.color }} />
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full uppercase"
                      style={{ background: prStyle.bg, color: prStyle.color }}
                    >
                      {announcement.priority}
                    </span>
                  </div>
                )}

                {/* Message */}
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {announcement.message}
                </p>

                {/* Meta rows */}
                <div
                  className="flex flex-col gap-1.5 text-xs border-t pt-3"
                  style={{ color: "var(--text-secondary)", borderColor: "var(--border)" }}
                >
                  {announcement.createdAt && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} style={{ color: "var(--accent)" }} />
                      Published: {formatDate(announcement.createdAt)}
                    </span>
                  )}
                  {announcement.expiresAt && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} style={{ color: "#f59e0b" }} />
                      Expires: {formatDate(announcement.expiresAt)}
                    </span>
                  )}
                  {announcement.targetType && (
                    <span className="flex items-center gap-1.5">
                      <Users size={12} style={{ color: "var(--accent)" }} />
                      {announcement.targetType}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
