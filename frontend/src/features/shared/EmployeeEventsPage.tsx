import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, CalendarDays, Clock, MapPin, Tag, User, Users } from "lucide-react";
import api from "../../utils/axiosInstance";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";

type EventItem = {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  venue: string;
  organizer: string;
  audience: string;
  description: string;
  status: string;
};

// Handle both YYYY-MM-DD and DD/MM/YYYY date strings from the backend
function parseEventDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(`${dateStr}T00:00:00`);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("/");
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }
  return new Date(dateStr);
}

// Visible on the event date and before; hidden from the next calendar day onward
function isEventVisible(dateStr: string): boolean {
  const eventDate = parseEventDate(dateStr);
  if (isNaN(eventDate.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);
  return eventDate >= today;
}

function formatDate(dateStr: string): string {
  const d = parseEventDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  birthday:       { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  recognition:    { bg: "rgba(139,92,246,0.12)",  color: "#8b5cf6" },
  "team activity":{ bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  festival:       { bg: "rgba(236,72,153,0.12)",  color: "#ec4899" },
  training:       { bg: "rgba(16,185,129,0.12)",  color: "#10b981" },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Planned:   { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  Completed: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  Cancelled: { bg: "rgba(239,68,68,0.12)",  color: "#ef4444" },
};

export default function EmployeeEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
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
        const res = await api.get<{ events: EventItem[] }>("/api/events");
        if (!active) return;
        const all = res.data.events ?? [];
        // Audience rule: only "All Employees" events reach the employee page
        // Expiry rule: hide the day after the event date
        const visible = all.filter(
          (e) => e.audience === "All Employees" && isEventVisible(e.date)
        );
        setEvents(visible);
      } catch {
        if (active) setError("Failed to load events. Please try again later.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  // After events load, scroll the highlighted card into view
  useEffect(() => {
    if (!highlightTitle || !highlightRef.current) return;
    const timer = setTimeout(
      () => highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      200
    );
    return () => clearTimeout(timer);
  }, [events, highlightTitle]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) =>
      [e.title, e.category, e.date, e.venue, e.organizer, e.description, e.status]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [events, search]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <div
            className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent"
            style={{ borderColor: "var(--accent)" }}
          />
          Loading events...
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
          {/* Company Events */}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Upcoming events and activities planned for all employees
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
            <CalendarDays size={22} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {search ? "No events match your search" : "No upcoming events"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {search
              ? "Try a different search term"
              : "Check back soon for upcoming company events"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((event) => {
            const isHighlighted =
              !!highlightTitle &&
              event.title.toLowerCase().includes(highlightTitle.toLowerCase());
            const catStyle =
              CATEGORY_STYLE[event.category?.toLowerCase()] ??
              { bg: "rgba(99,102,241,0.12)", color: "#6366f1" };
            const stStyle = STATUS_STYLE[event.status] ?? STATUS_STYLE.Planned;

            return (
              <div
                key={event.id}
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
                    {event.title}
                  </h3>
                  <span
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0"
                    style={{ background: stStyle.bg, color: stStyle.color }}
                  >
                    {event.status}
                  </span>
                </div>

                {/* Category chip */}
                {event.category && (
                  <div className="flex items-center gap-1.5">
                    <Tag size={12} style={{ color: catStyle.color }} />
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={{ background: catStyle.bg, color: catStyle.color }}
                    >
                      {event.category}
                    </span>
                  </div>
                )}

                {/* Meta rows */}
                <div
                  className="flex flex-col gap-1.5 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} style={{ color: "var(--accent)" }} />
                    {formatDate(event.date)}
                  </span>
                  {event.time && (
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} style={{ color: "var(--accent)" }} />
                      {event.time}
                    </span>
                  )}
                  {event.venue && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={12} style={{ color: "var(--accent)" }} />
                      {event.venue}
                    </span>
                  )}
                  {event.organizer && (
                    <span className="flex items-center gap-1.5">
                      <User size={12} style={{ color: "var(--accent)" }} />
                      {event.organizer}
                    </span>
                  )}
                  {event.audience && (
                    <span className="flex items-center gap-1.5">
                      <Users size={12} style={{ color: "var(--accent)" }} />
                      {event.audience}
                    </span>
                  )}
                </div>

                {/* Description */}
                {event.description && (
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {event.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
