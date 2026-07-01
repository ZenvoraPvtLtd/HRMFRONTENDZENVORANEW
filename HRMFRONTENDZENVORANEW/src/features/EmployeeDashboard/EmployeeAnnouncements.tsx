import { useEffect, useMemo, useState } from "react";
import { Megaphone } from "lucide-react";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";
import { getApiBaseUrl } from "../../config/apiConfig";

type Priority = "High" | "Medium" | "Low";

type Announcement = {
  id: string;
  title: string;
  message: string;
  priority: Priority;
  target: string;
  expires: string;
  published: string;
};

function fromApi(doc: Record<string, string>): Announcement {
  const dateStr = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB");
  };
  return {
    id: doc.id ?? doc._id,
    title: doc.title,
    message: doc.message,
    priority: (doc.priority
      ? doc.priority.charAt(0).toUpperCase() + doc.priority.slice(1)
      : "Medium") as Priority,
    target: doc.targetType === "all" ? "All Employees" : doc.targetValue ?? doc.targetType,
    expires: dateStr(doc.expiresAt),
    published: dateStr(doc.createdAt),
  };
}

function getPriorityStyle(priority: Priority) {
  if (priority === "High") return { background: "rgba(239,68,68,0.12)", color: "#ef4444" };
  if (priority === "Low") return { background: "rgba(16,185,129,0.12)", color: "#10b981" };
  return { background: "rgba(59,130,246,0.12)", color: "#3b82f6" };
}

export default function EmployeeAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // ── Fetch only published ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${getApiBaseUrl()}/api/announcements/`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        // sirf published wali dikhao (case-insensitive)
        const published = data
          .filter((d: Record<string, string>) => (d.status || "").toLowerCase() === "published")
          .map(fromApi);
        setAnnouncements(published);
      } catch {
        setError("Could not load announcements. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  // ── Search ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleSearch = (event: Event) => {
      setQuery((event as CustomEvent<string>).detail || "");
    };
    window.addEventListener(SEARCH_EVENT, handleSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleSearch);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return announcements;
    return announcements.filter((a) =>
      [a.title, a.message, a.priority, a.target]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [announcements, query]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="max-w-[1280px] mx-auto">

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <p
              className="text-sm animate-pulse"
              style={{ color: "var(--text-secondary)" }}
            >
              Loading announcements...
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-16">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Cards */}
        {!loading && !error && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filtered.map((a) => (
              <article
                key={a.id}
                className="rounded-lg p-5 min-h-[190px] shadow-sm"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid rgba(16,185,129,0.45)",
                }}
              >
                {/* Title */}
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
                  >
                    <Megaphone size={15} />
                  </div>
                  <h2
                    className="text-base font-bold leading-6"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {a.title}
                  </h2>
                </div>

                {/* Priority badge */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                    style={getPriorityStyle(a.priority)}
                  >
                    {a.priority}
                  </span>
                </div>

                {/* Message */}
                <p
                  className="text-sm leading-6 mb-5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {a.message}
                </p>

                {/* Meta */}
                <div
                  className="space-y-1 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <p>
                    Target:{" "}
                    <span style={{ color: "var(--text-primary)" }}>{a.target}</span>
                  </p>
                  <p>
                    Expires:{" "}
                    <span style={{ color: "var(--text-primary)" }}>{a.expires || "-"}</span>
                  </p>
                  <p>
                    Published:{" "}
                    <span style={{ color: "var(--text-primary)" }}>{a.published || "-"}</span>
                  </p>
                </div>
              </article>
            ))}

            {filtered.length === 0 && (
              <div
                className="xl:col-span-2 rounded-lg py-16 text-center"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  No announcements at the moment
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}