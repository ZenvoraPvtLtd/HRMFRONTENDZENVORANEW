import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Flag,
  Gift,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import {
  btnPrimary,
  card,
  getStatusStyle,
  HR_YEAR_OPTIONS,
  hrPageWrap,
  inputMuted,
  tableHead,
  textPrimary,
  textSecondary,
} from "./hrTheme";
import { fetchHolidays, createHoliday, updateHoliday, deleteHoliday } from "../../services/holidayApi";

type HolidayType =
  | "Public Holiday"
  | "National Holiday"
  | "Government / Festival"
  | "Government Holiday";

type Holiday = {
  id: number | string;
  title: string;
  date: string;
  type: HolidayType;
};

const initialHolidays: Holiday[] = [
];

const getTodayDate = () => {
  return new Date().toISOString().split("T")[0];
};


const holidayTypes: HolidayType[] = [
  "Public Holiday",
  "National Holiday",
  "Government / Festival",
  "Government Holiday",
];

const today = new Date();

function formatHolidayDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function getHolidayDay(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function getHolidayIcon(type: HolidayType) {
  if (type === "National Holiday") return <Flag size={15} />;
  if (type === "Public Holiday") return <Sparkles size={15} />;
  if (type === "Government Holiday") return <BriefcaseBusiness size={15} />;
  return <Gift size={15} />;
}

function getTypeStyle(type: HolidayType) {
  if (type === "National Holiday") {
    return { background: "rgba(59,130,246,0.12)", color: "#3b82f6" };
  }
  if (type === "Public Holiday") {
    return { background: "rgba(245,158,11,0.12)", color: "#f59e0b" };
  }
  if (type === "Government Holiday") {
    return { background: "rgba(239,68,68,0.12)", color: "#ef4444" };
  }
  return { background: "rgba(16,185,129,0.12)", color: "#10b981" };
}

export default function HolidayCalendar() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedYear, setSelectedYear] = useState("2026");
  const [search] = useTopHeaderSearch();
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [newHoliday, setNewHoliday] = useState<{
    title: string;
    date: string;
    type: HolidayType;
  }>({
    title: "",
    date: getTodayDate(),
    type: "Government / Festival",
  });

  async function loadHolidays() {
    await Promise.resolve();

    try {
      setIsLoading(true);
      setError("");
      const data = await fetchHolidays();
      const list = Array.isArray(data) ? data : data.holidays || data.data || [];
      setHolidays(list.length > 0 ? list : initialHolidays);
    } catch (err) {
      console.error("Failed to load holidays", err);
      setError("Failed to load holidays. Using default data.");
      setHolidays(initialHolidays);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await loadHolidays();
    })();
  }, []);

  const yearHolidays = useMemo(
    () =>
      holidays
        .filter((holiday) => holiday.date.startsWith(selectedYear))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, selectedYear],
  );



  const filteredHolidays = useMemo(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const query = search.trim().toLowerCase();

  return yearHolidays
    .filter((holiday) => {
      const holidayDate = new Date(`${holiday.date}T00:00:00`);
      holidayDate.setHours(0, 0, 0, 0);

      // Only today and future holidays
      return holidayDate >= today;
    })
    .filter((holiday) => {
      if (!query) return true;

      return [
        holiday.title,
        holiday.type,
        getHolidayDay(holiday.date),
        formatHolidayDate(holiday.date),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
}, [yearHolidays, search]);


  const upcomingHolidays = yearHolidays.filter(
    (holiday) => new Date(`${holiday.date}T00:00:00`) >= today,
  );
  const elapsedHolidays = yearHolidays.length - upcomingHolidays.length;
  const nextHoliday = upcomingHolidays[0];

 const resetForm = () => {
  setNewHoliday({
    title: "",
    date: getTodayDate(),
    type: "Government / Festival",
  });

    setIsEditMode(false);
    setEditingId(null);
  };

  const handleSaveHoliday = async () => {
    if (!newHoliday.title || !newHoliday.date) return;

    try {
      if (isEditMode && editingId) {
        await updateHoliday(editingId, newHoliday);
        setHolidays((prev) =>
          prev.map((holiday) =>
            holiday.id === editingId ? { ...holiday, ...newHoliday } : holiday,
          ),
        );
      } else {
        const created = await createHoliday(newHoliday);
        setHolidays((prev) => [
          ...prev,
          {
            id: created.id || Date.now(),
            title: newHoliday.title,
            date: newHoliday.date,
            type: newHoliday.type,
          },
        ]);
      }

      resetForm();
      setShowModal(false);
      setError("");
    } catch (err) {
      console.error("Failed to save holiday", err);
      setError("Failed to save holiday. Please try again.");
    }
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setIsEditMode(true);
    setEditingId(holiday.id);
    setNewHoliday({
      title: holiday.title,
      date: holiday.date,
      type: holiday.type,
    });
    setShowModal(true);
  };

  return (
    <div className={hrPageWrap}>
      <div className="max-w-[1280px] mx-auto">
        {error && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm font-medium" style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
            {error}
          </div>
        )}

        {isLoading && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm font-medium" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.25)" }}>
            Loading holidays...
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 mb-5">
          <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
            <ConstrainedDropdown
              value={selectedYear}
              onChange={setSelectedYear}
              options={HR_YEAR_OPTIONS}
              className="w-full sm:w-32"
              buttonStyle={inputMuted}
            />
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="h-10 w-full px-4 rounded-lg font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 transition sm:w-auto"
              style={btnPrimary}
            >
              <Plus size={16} />
              Add Holiday
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[repeat(3,minmax(0,1fr))_minmax(220px,0.75fr)] gap-3 mb-5">
          <MetricCard label="Total Holidays" value={String(yearHolidays.length)} />
          <MetricCard label="Upcoming" value={String(upcomingHolidays.length)} />
          <MetricCard label="Elapsed" value={String(elapsedHolidays)} />
          <div
            className="rounded-lg px-4 py-3 min-h-[76px] flex flex-col items-center justify-center text-center"
            style={{
              background: "var(--chart-bg)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="text-[10px] uppercase font-bold" style={textSecondary}>
              Next Holiday
            </p>
            <p className="text-sm font-bold mt-1" style={textPrimary}>
              {nextHoliday?.title || "-"}
            </p>
            <p className="text-xs mt-1" style={textSecondary}>
              {nextHoliday ? formatHolidayDate(nextHoliday.date).toUpperCase() : "-"}
            </p>
          </div>
        </div>

        <div className="hidden rounded-xl p-4 shadow-sm lg:block" style={card}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px]">
              <thead style={tableHead}>
                <tr>
                  {["Day", "Date", "Occasion", "Holiday Type", "Actions"].map(
                    (column, index, columns) => (
                      <th
                        key={column}
                        className={`px-4 py-4 text-xs font-semibold ${
                          index === columns.length - 1 ? "text-right" : "text-left"
                        }`}
                      >
                        {column}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredHolidays.map((holiday) => (
                  <tr key={holiday.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-4 py-4 text-sm font-semibold" style={textPrimary}>
                      {getHolidayDay(holiday.date)}
                    </td>
                    <td className="px-4 py-4 text-sm" style={textSecondary}>
                      {formatHolidayDate(holiday.date)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span style={getTypeStyle(holiday.type)}>
                          {getHolidayIcon(holiday.type)}
                        </span>
                        <span className="text-sm font-semibold" style={textPrimary}>
                          {holiday.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="inline-flex px-3 py-1 rounded-full text-xs font-semibold"
                        style={getTypeStyle(holiday.type)}
                      >
                        {holiday.type}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditHoliday(holiday)}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center"
                          style={getStatusStyle("In Progress")}
                          aria-label={`Edit ${holiday.title}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await deleteHoliday(holiday.id);
                              setHolidays((prev) =>
                                prev.filter((item) => item.id !== holiday.id),
                              );
                              setError("");
                            } catch (err) {
                              console.error("Failed to delete holiday", err);
                              setError("Failed to delete holiday. Please try again.");
                            }
                          }}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center"
                          style={getStatusStyle("Rejected")}
                          aria-label={`Delete ${holiday.title}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredHolidays.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm" style={textSecondary}>
                      No holidays found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 mt-4 lg:hidden">
          {filteredHolidays.map((holiday) => (
            <div key={holiday.id} className="rounded-xl p-4" style={card}>
              <div className="flex flex-col gap-3">
                <div className="min-w-0">
                  <p className="font-bold break-words" style={textPrimary}>
                    {holiday.title}
                  </p>
                  <p className="text-sm mt-1" style={textSecondary}>
                    {getHolidayDay(holiday.date)} · {formatHolidayDate(holiday.date)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="max-w-full px-3 py-1 rounded-full text-xs font-semibold break-words" style={getTypeStyle(holiday.type)}>
                  {holiday.type}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditHoliday(holiday)}
                    className="w-9 h-9 rounded-lg inline-flex items-center justify-center"
                    style={getStatusStyle("In Progress")}
                    aria-label={`Edit ${holiday.title}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await deleteHoliday(holiday.id);
                        setHolidays((prev) =>
                          prev.filter((item) => item.id !== holiday.id),
                        );
                        setError("");
                      } catch (err) {
                        console.error("Failed to delete holiday", err);
                        setError("Failed to delete holiday. Please try again.");
                      }
                    }}
                    className="w-9 h-9 rounded-lg inline-flex items-center justify-center"
                    style={getStatusStyle("Rejected")}
                    aria-label={`Delete ${holiday.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                </div>
              </div>
            </div>
          ))}

          {filteredHolidays.length === 0 && (
            <div className="rounded-xl p-8 text-center text-sm" style={{ ...card, ...textSecondary }}>
              No holidays found
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl p-5" style={card}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold" style={textPrimary}>
                  {isEditMode ? "Edit Holiday" : "Add Holiday"}
                </h2>
                <button onClick={() => setShowModal(false)} aria-label="Close modal">
                  <X size={18} style={textSecondary} />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Occasion"
                  value={newHoliday.title}
                  onChange={(event) =>
                    setNewHoliday({ ...newHoliday, title: event.target.value })
                  }
                  className="w-full rounded-lg px-4 py-2.5 outline-none"
                  style={inputMuted}
                />

                <input
                  type="date"
                  value={newHoliday.date}
                  min={getTodayDate()}
                  onChange={(event) =>
                    setNewHoliday({ ...newHoliday, date: event.target.value })
                  }
                  className="w-full rounded-lg px-4 py-2.5 outline-none"
                  style={inputMuted}
                />

                <ConstrainedDropdown
                  value={newHoliday.type}
                  onChange={(type) =>
                    setNewHoliday({
                      ...newHoliday,
                      type: type as HolidayType,
                    })
                  }
                  options={holidayTypes}
                  buttonStyle={inputMuted}
                />

                <button
                  onClick={handleSaveHoliday}
                  className="w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2"
                  style={btnPrimary}
                >
                  <Save size={16} />
                  {isEditMode ? "Update Holiday" : "Save Holiday"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-4 py-3 min-h-[76px] flex items-center justify-center text-center" style={card}>
      <div>
        <p className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
          {value}
        </p>
        <p className="text-[10px] uppercase font-bold mt-1" style={textSecondary}>
          {label}
        </p>
      </div>
    </div>
  );
}
