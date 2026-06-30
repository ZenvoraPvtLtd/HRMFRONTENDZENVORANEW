import { useEffect, useMemo, useState } from "react";
import api from "../../utils/axiosInstance";
import { CalendarDays, MapPin } from "lucide-react";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";

type EventStatus = "Planned" | "Completed" | "Cancelled";

type EventItem = {
  id: string | number;
  title: string;
  category: string;
  date: string;
  time: string;
  venue: string;
  organizer: string;
  audience: string;
  description: string;
  status: EventStatus;
};

export default function EmployeeEvents() {
  const [search] = useTopHeaderSearch();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get("/api/events");
        setEvents(response.data.events || []);
      } catch (err) {
        console.error("Failed to load events:", err);
        setError("Could not load events. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return events;

    return events.filter((event) =>
      [event.title, event.category, event.date, event.venue, event.status]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [events, search]);

  const getStatusStyle = (status: EventStatus) => {
    if (status === "Completed") {
      return { background: "rgba(16,185,129,0.12)", color: "#10b981" };
    }
    if (status === "Cancelled") {
      return { background: "rgba(239,68,68,0.12)", color: "#ef4444" };
    }
    return { background: "rgba(59,130,246,0.12)", color: "#3b82f6" };
  };

  return (
    <div className="p-6">
      <div className="max-w-[1280px] mx-auto">
        <h1 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
          Events Calendar
        </h1>

        {loading && (
          <div className="text-center py-16">
            <p className="text-sm animate-pulse" style={{ color: "var(--text-secondary)" }}>
              Loading events...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-16">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEvents.map((event) => (
              <article
                key={event.id}
                className="rounded-xl p-5 min-h-[170px] shadow-sm flex flex-col justify-between"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h2
                        className="text-base font-bold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {event.title}
                      </h2>
                      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                        {event.category}
                      </p>
                    </div>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0"
                      style={getStatusStyle(event.status)}
                    >
                      {event.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm mt-3" style={{ color: "var(--text-secondary)" }}>
                    <p className="flex items-center gap-2">
                      <CalendarDays size={14} />
                      <span>
                        {event.date} · {event.time || "TBA"}
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin size={14} />
                      <span>{event.venue || "TBA"}</span>
                    </p>
                  </div>

                  <p
                    className="text-sm leading-6 mt-4 line-clamp-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {event.description || "No additional event details provided."}
                  </p>
                </div>

                <div
                  className="text-xs mt-4 pt-3 border-t flex justify-between"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  <span>Organizer: {event.organizer || "HR Operations"}</span>
                  <span>Target: {event.audience}</span>
                </div>
              </article>
            ))}

            {filteredEvents.length === 0 && (
              <div
                className="md:col-span-3 rounded-lg py-16 text-center"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  No events found
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
