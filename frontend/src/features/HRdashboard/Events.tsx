import { useEffect, useMemo, useState } from "react";
import api from "../../utils/axiosInstance";
import { CalendarDays, Edit3, MapPin, Plus, Save, Trash2, X } from "lucide-react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import {
  btnPrimary,
  card,
  getStatusStyle,
  hrPageWrap,
  inputMuted,
  textPrimary,
  textSecondary,
} from "./hrTheme";

type EventStatus = "Planned" | "Completed" | "Cancelled";

type EventItem = {
  id: number;
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

const initialEvents: EventItem[] = [
  {
    id: 1,
    title: "Cake cuttin",
    category: "birthday",
    date: "20/01/2026",
    time: "04:00 PM",
    venue: "6th floor",
    organizer: "HR Team",
    audience: "All Employees",
    description: "Birthday celebration and team gathering on the office floor.",
    status: "Planned",
  },
  {
    id: 2,
    title: "Vected Offsite Gathering",
    category: "recognition",
    date: "20/12/2025",
    time: "10:00 AM",
    venue: "Dream World Resort",
    organizer: "People Operations",
    audience: "Leadership & Teams",
    description: "Offsite engagement program with recognition activities.",
    status: "Planned",
  },
  {
    id: 3,
    title: "bday celbrations",
    category: "birthday",
    date: "29/11/2025",
    time: "05:00 PM",
    venue: "6th floor",
    organizer: "Admin Team",
    audience: "All Employees",
    description: "Monthly birthday celebrations for team members.",
    status: "Planned",
  },
];

const emptyEvent: Omit<EventItem, "id"> = {
  title: "",
  category: "birthday",
  date: "",
  time: "",
  venue: "",
  organizer: "",
  audience: "All Employees",
  description: "",
  status: "Planned",
};

export default function Events() {
  const [search] = useTopHeaderSearch();
  const [events, setEvents] = useState(initialEvents);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState(emptyEvent);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await api.get("/api/events");
        setEvents(response.data.events || []);
      } catch {
        // Keep the page quiet if the events API is unavailable.
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
        .includes(query),
    );
  }, [events, search]);

  const openCreate = () => {
    setDraft(emptyEvent);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (event: EventItem) => {
    setDraft({
      title: event.title,
      category: event.category,
      date: event.date,
      time: event.time,
      venue: event.venue,
      organizer: event.organizer,
      audience: event.audience,
      description: event.description,
      status: event.status,
    });
    setEditingId(event.id);
    setShowModal(true);
  };

  const saveEvent = async () => {
    if (!draft.title.trim() || !draft.date.trim()) return;

    try {
      if (editingId) {
        const response = await api.put(`/api/events/${editingId}`, draft);
        setEvents((prev) =>
          prev.map((event) => (event.id === editingId ? response.data : event)),
        );
      } else {
        const response = await api.post("/api/events", draft);
        setEvents((prev) => [response.data, ...prev]);
      }

      setShowModal(false);
      setEditingId(null);
      setDraft(emptyEvent);
    } catch {
      // Keep the page quiet if create/update fails.
    }
  };

  return (
    <div className={hrPageWrap}>
      <div className="max-w-[1280px] mx-auto">
        <div className="flex justify-end mb-5">
          <button
            onClick={openCreate}
            className="h-10 px-4 rounded-lg font-semibold inline-flex items-center gap-2 hover:opacity-90 transition"
            style={btnPrimary}
          >
            <Plus size={16} />
            Create Event
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {filteredEvents.map((event) => (
            <article key={event.id} className="rounded-lg p-5 min-h-[170px]" style={card}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold truncate" style={textPrimary}>
                    {event.title}
                  </h2>
                  <p className="text-xs mt-1" style={textSecondary}>
                    {event.category}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(event)}
                    className="w-8 h-8 rounded-lg inline-flex items-center justify-center"
                    style={getStatusStyle("In Progress")}
                    aria-label={`Edit ${event.title}`}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await api.delete(`/api/events/${event.id}`);
                      } catch {
                        // Keep the page quiet if delete fails.
                      }

                      setEvents((prev) => prev.filter((item) => item.id !== event.id));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm" style={textSecondary}>
                <p className="flex items-center gap-2">
                  <CalendarDays size={14} />
                  <span>
                    {event.date} · {event.time}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <MapPin size={14} />
                  <span>{event.venue}</span>
                </p>
              </div>

              <p className="text-sm leading-6 mt-4 line-clamp-2" style={textSecondary}>
                {event.description || "Event details will be shared soon."}
              </p>

              <p className="text-xs mt-4" style={textSecondary}>
                Organizer: <span style={textPrimary}>{event.organizer || "-"}</span>
              </p>
              <p className="text-xs mt-1" style={textSecondary}>
                Status: <span style={textPrimary}>{event.status}</span>
              </p>
            </article>
          ))}

          {filteredEvents.length === 0 && (
            <div className="md:col-span-3 rounded-lg py-16 text-center" style={card}>
              <p className="text-sm" style={textSecondary}>
                No events found
              </p>
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-2xl rounded-lg shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
              style={card}
            >
              <div
                className="flex items-start justify-between gap-4 px-6 py-5 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <h2 className="text-lg font-bold" style={textPrimary}>
                    {editingId ? "Edit Event" : "Create Event"}
                  </h2>
                  <p className="text-sm mt-1" style={textSecondary}>
                    Plan engagement activities, birthdays, offsites, and team events.
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0"
                  aria-label="Close modal"
                >
                  <X size={18} style={textSecondary} />
                </button>
              </div>

              <div className="px-6 py-6 space-y-5 overflow-y-auto">
                <FormField label="Event Title" required>
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    placeholder="Vected Offsite Gathering"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Category">
                    <ConstrainedDropdown
                      value={draft.category}
                      onChange={(value) => setDraft({ ...draft, category: value })}
                      options={["birthday", "recognition", "team activity", "festival", "training"]}
                      buttonStyle={inputMuted}
                    />
                  </FormField>

                  <FormField label="Audience">
                    <ConstrainedDropdown
                      value={draft.audience}
                      onChange={(value) => setDraft({ ...draft, audience: value })}
                      options={["All Employees", "Leadership & Teams", "Department Only", "HR Team"]}
                      buttonStyle={inputMuted}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Date" required>
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                      className="w-full rounded-lg px-4 py-3 outline-none"
                      style={inputMuted}
                    />
                  </FormField>
                  <FormField label="Time">
                    <input
                      value={draft.time}
                      onChange={(event) => setDraft({ ...draft, time: event.target.value })}
                      placeholder="10:00 AM"
                      className="w-full rounded-lg px-4 py-3 outline-none"
                      style={inputMuted}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Venue">
                    <input
                      value={draft.venue}
                      onChange={(event) => setDraft({ ...draft, venue: event.target.value })}
                      placeholder="Dream World Resort"
                      className="w-full rounded-lg px-4 py-3 outline-none"
                      style={inputMuted}
                    />
                  </FormField>
                  <FormField label="Organizer">
                    <input
                      value={draft.organizer}
                      onChange={(event) => setDraft({ ...draft, organizer: event.target.value })}
                      placeholder="HR Team"
                      className="w-full rounded-lg px-4 py-3 outline-none"
                      style={inputMuted}
                    />
                  </FormField>
                </div>

                <FormField label="Description">
                  <textarea
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    placeholder="Add agenda, participation details, or notes for the event..."
                    className="w-full rounded-lg px-4 py-3 outline-none min-h-28 resize-y"
                    style={inputMuted}
                  />
                </FormField>

                <FormField label="Status">
                  <ConstrainedDropdown
                    value={draft.status}
                    onChange={(value) =>
                      setDraft({ ...draft, status: value as EventStatus })
                    }
                    options={["Planned", "Completed", "Cancelled"]}
                    buttonStyle={inputMuted}
                    menuPlacement="bottom"
                  />
                </FormField>

                <button
                  onClick={saveEvent}
                  className="w-full rounded-lg py-3 font-semibold inline-flex justify-center items-center gap-2"
                  style={btnPrimary}
                >
                  <Save size={16} />
                  {editingId ? "Update Event" : "Save Event"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-2" style={textPrimary}>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
