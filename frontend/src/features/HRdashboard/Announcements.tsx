import { useMemo, useState } from "react";
import { Edit3, Plus, Save, Trash2, X } from "lucide-react";
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

type Priority = "High" | "Medium" | "Low";
type AnnouncementStatus = "Published" | "Draft";

type Announcement = {
  id: number;
  title: string;
  message: string;
  priority: Priority;
  status: AnnouncementStatus;
  target: string;
  expires: string;
  published: string;
};

const initialAnnouncements: Announcement[] = [
  {
    id: 1,
    title: "Mandatory Weekly Team meeting",
    message:
      "Everyone kindly join from your respective desk at 6:00 PM Meeting Link - https://meet.google.com/ozf-zwp-vcc",
    priority: "Medium",
    status: "Published",
    target: "all",
    expires: "06/02/2026",
    published: "06/02/2026",
  },
  {
    id: 2,
    title: "Sales Performance is Degrading",
    message: "Need immediate attention and productive work to avoid any escalations.",
    priority: "Medium",
    status: "Published",
    target: "department",
    expires: "04/12/2025",
    published: "03/12/2025",
  },
  {
    id: 3,
    title: "Welcome Onboard to Vected EMS - Beta Version",
    message:
      "Feel free to report any bugs identified while working with the platform",
    priority: "Medium",
    status: "Published",
    target: "all",
    expires: "12/12/2025",
    published: "29/11/2025",
  },
];

const emptyAnnouncement: Omit<Announcement, "id"> = {
  title: "",
  message: "",
  priority: "Medium",
  status: "Published",
  target: "All Employees",
  expires: "",
  published: "",
};

function Announcements() {
  const [search] = useTopHeaderSearch();
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState(emptyAnnouncement);

  const filteredAnnouncements = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return announcements;

    return announcements.filter((announcement) =>
      [
        announcement.title,
        announcement.message,
        announcement.priority,
        announcement.status,
        announcement.target,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [announcements, search]);

  const openCreateModal = () => {
    setDraft(emptyAnnouncement);
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (announcement: Announcement) => {
    setDraft({
      title: announcement.title,
      message: announcement.message,
      priority: announcement.priority,
      status: announcement.status,
      target: announcement.target,
      expires: announcement.expires,
      published: announcement.published,
    });
    setEditingId(announcement.id);
    setShowModal(true);
  };

  const saveAnnouncement = () => {
    if (!draft.title.trim() || !draft.message.trim()) return;

    if (editingId) {
      setAnnouncements((prev) =>
        prev.map((announcement) =>
          announcement.id === editingId
            ? { ...announcement, ...draft }
            : announcement,
        ),
      );
    } else {
      setAnnouncements((prev) => [{ id: Date.now(), ...draft }, ...prev]);
    }

    setShowModal(false);
    setEditingId(null);
    setDraft(emptyAnnouncement);
  };

  return (
    <div className={hrPageWrap}>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-end mb-4">
          <button
            onClick={openCreateModal}
            className="h-10 px-4 rounded-lg font-semibold inline-flex items-center gap-2 hover:opacity-90 transition"
            style={btnPrimary}
          >
            <Plus size={16} />
            Create Announcement
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filteredAnnouncements.map((announcement) => (
            <article
              key={announcement.id}
              className="rounded-lg p-5 min-h-47.5 shadow-sm"
              style={{
                ...card,
                borderColor: "rgba(16,185,129,0.45)",
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="text-lg font-bold leading-6" style={textPrimary}>
                  {announcement.title}
                </h2>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEditModal(announcement)}
                    className="w-8 h-8 rounded-lg inline-flex items-center justify-center"
                    style={getStatusStyle("In Progress")}
                    aria-label={`Edit ${announcement.title}`}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() =>
                      setAnnouncements((prev) =>
                        prev.filter((item) => item.id !== announcement.id),
                      )
                    }
                    className="w-8 h-8 rounded-lg inline-flex items-center justify-center"
                    style={getStatusStyle("Rejected")}
                    aria-label={`Delete ${announcement.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                  style={getPriorityStyle(announcement.priority)}
                >
                  {announcement.priority}
                </span>
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={getStatusStyle(announcement.status)}
                >
                  {announcement.status}
                </span>
              </div>

              <p className="text-sm leading-6 mb-5" style={textPrimary}>
                {announcement.message}
              </p>

              <div className="space-y-1 text-xs" style={textSecondary}>
                <p>
                  Target: <span style={textPrimary}>{announcement.target}</span>
                </p>
                <p>
                  Expires: <span style={textPrimary}>{announcement.expires || "-"}</span>
                </p>
                <p>
                  Published:{" "}
                  <span style={textPrimary}>{announcement.published || "-"}</span>
                </p>
              </div>
            </article>
          ))}

          {filteredAnnouncements.length === 0 && (
            <div className="xl:col-span-2 rounded-lg py-16 text-center" style={card}>
              <p className="text-sm" style={textSecondary}>
                No announcements found
              </p>
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-115 rounded-lg shadow-2xl max-h-[86vh] flex flex-col overflow-hidden"
              style={card}
            >
              <div
                className="flex items-center justify-between px-6 py-5 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <h2 className="text-lg font-bold" style={textPrimary}>
                  {editingId ? "Edit Announcement" : "Create Announcement"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg inline-flex items-center justify-center"
                  aria-label="Close modal"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <X size={18} style={textSecondary} />
                </button>
              </div>

              <div className="px-6 py-6 space-y-5 overflow-y-auto">
                <label className="block">
                  <span className="block text-sm font-semibold mb-2" style={textPrimary}>
                    Title *
                  </span>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                    placeholder="Mandatory Weekly Team meeting"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-semibold mb-2" style={textPrimary}>
                    Message *
                  </span>
                  <textarea
                    value={draft.message}
                    onChange={(event) =>
                      setDraft({ ...draft, message: event.target.value })
                    }
                    placeholder="Everyone kindly join from your respective desk at 6:00 PM"
                    className="w-full rounded-lg px-4 py-3 outline-none min-h-33 resize-y"
                    style={inputMuted}
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-semibold mb-2" style={textPrimary}>
                    Target Type *
                  </span>
                  <select
                    value={draft.target}
                    onChange={(event) =>
                      setDraft({ ...draft, target: event.target.value })
                    }
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  >
                    <option>All Employees</option>
                    <option>Department</option>
                    <option>Managers</option>
                    <option>HR Team</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-semibold mb-2" style={textPrimary}>
                    Priority *
                  </span>
                  <select
                    value={draft.priority}
                    onChange={(event) =>
                      setDraft({ ...draft, priority: event.target.value as Priority })
                    }
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-sm font-semibold mb-2" style={textPrimary}>
                      Status
                    </span>
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          status: event.target.value as AnnouncementStatus,
                        })
                      }
                      className="w-full rounded-lg px-4 py-3 outline-none"
                      style={inputMuted}
                    >
                      <option>Published</option>
                      <option>Draft</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="block text-sm font-semibold mb-2" style={textPrimary}>
                      Expires
                    </span>
                    <input
                      value={draft.expires}
                      onChange={(event) =>
                        setDraft({ ...draft, expires: event.target.value })
                      }
                      placeholder="06/02/2026"
                      className="w-full rounded-lg px-4 py-3 outline-none"
                      style={inputMuted}
                    />
                  </label>
                </div>

                <button
                  onClick={saveAnnouncement}
                  className="w-full rounded-lg py-2.5 font-semibold inline-flex justify-center items-center gap-2"
                  style={btnPrimary}
                >
                  <Save size={16} />
                  {editingId ? "Update Announcement" : "Save Announcement"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getPriorityStyle(priority: Priority) {
  if (priority === "High") {
    return { background: "rgba(239,68,68,0.12)", color: "#ef4444" };
  }
  if (priority === "Low") {
    return { background: "rgba(16,185,129,0.12)", color: "#10b981" };
  }
  return { background: "rgba(59,130,246,0.12)", color: "#3b82f6" };
}

export default Announcements;

