import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";
import { useTheme } from "../../context/ThemeContext";
import AttendancePage from "../shared/AttendancePage";

interface TimesheetEntry {
  date: string;
  day: string;
  clockIn: string;
  clockOut: string;
  breakTime: string;
  totalHours: string;
  status: "On Time" | "Late" | "Absent" | "Weekend";
}

const entryTemplates: Omit<TimesheetEntry, "date" | "day">[] = [
  { clockIn: "09:02 AM", clockOut: "06:15 PM", breakTime: "45m", totalHours: "8h 28m", status: "On Time" },
  { clockIn: "09:45 AM", clockOut: "06:30 PM", breakTime: "30m", totalHours: "8h 15m", status: "Late" },
  { clockIn: "08:55 AM", clockOut: "05:58 PM", breakTime: "60m", totalHours: "8h 03m", status: "On Time" },
  { clockIn: "09:01 AM", clockOut: "06:00 PM", breakTime: "45m", totalHours: "8h 14m", status: "On Time" },
  { clockIn: "-", clockOut: "-", breakTime: "-", totalHours: "-", status: "Absent" },
  { clockIn: "-", clockOut: "-", breakTime: "-", totalHours: "-", status: "Weekend" },
  { clockIn: "-", clockOut: "-", breakTime: "-", totalHours: "-", status: "Weekend" },
];

const statusStyle: Record<string, { color: string; bg: string }> = {
  "On Time": { color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  Late: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  Absent: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  Weekend: { color: "var(--text-secondary)", bg: "var(--bg-hover)" },
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDayMonth(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getUserId() {
  return (
    localStorage.getItem("userId") ||
    localStorage.getItem("userEmail") ||
    "employee"
  );
}

export default function TimesheetPage() {

  const userId = getUserId();

const clockKey = `clockInTime_${userId}`;
const clockedInKey = `clockedIn_${userId}`;

const liveClockIn = localStorage.getItem(clockKey);
const isClockedIn = localStorage.getItem(clockedInKey) === "true";

  const { isDark } = useTheme();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [weekStart, setWeekStart] = useState(() => new Date(2026, 4, 19));
  const [query, setQuery] = useState("");

  // const entries = useMemo<TimesheetEntry[]>(
  //   () =>
  //     entryTemplates.map((entry, index) => {
  //       const date = addDays(weekStart, index);
  //       return {
  //         ...entry,
  //         date: formatDayMonth(date),
  //         day: date.toLocaleDateString("en-GB", { weekday: "short" }),
  //       };
  //     }),
  //   [weekStart]
  // );


  const entries = useMemo<TimesheetEntry[]>(() => {
  const generated = entryTemplates.map((entry, index) => {
    const date = addDays(weekStart, index);

    return {
      ...entry,
      date: formatDayMonth(date),
      day: date.toLocaleDateString("en-GB", { weekday: "short" }),
    };
  });

  if (isClockedIn && liveClockIn) {
    const now = new Date();

    generated[0] = {
      ...generated[0],
      clockIn: now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      clockOut: "-",
      breakTime: "-",
      totalHours: "-",
      status: "On Time",
    };
  }

  return generated;
}, [weekStart, isClockedIn, liveClockIn]);



  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${formatDayMonth(weekStart)} - ${formatDayMonth(weekEnd)} ${weekEnd.getFullYear()}`;
  const totalHoursWorked = "32h 60m";
  const daysPresent = entries.filter((entry) => entry.clockIn !== "-").length;
  const lateCount = entries.filter((entry) => entry.status === "Late").length;
  const tableHeaderBgColor = isDark ? "#ffffff" : "#000000";
  const tableHeaderTextColor = isDark ? "#000000" : "#ffffff";
  const filteredEntries = entries.filter((entry) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    return [
      entry.date,
      entry.day,
      entry.clockIn,
      entry.clockOut,
      entry.breakTime,
      entry.totalHours,
      entry.status,
    ].some((value) => value.toLowerCase().includes(q));
  });

  useEffect(() => {
    const handleHeaderSearch = (event: Event) => {
      setQuery((event as CustomEvent<string>).detail || "");
    };

    window.addEventListener(SEARCH_EVENT, handleHeaderSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleHeaderSearch);
  }, []);

  const openDatePicker = () => {
    const input = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    input?.focus();
    input?.showPicker?.();
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Hours This Week", value: totalHoursWorked, color: "var(--accent)" },
          { label: "Days Present", value: `${daysPresent}d`, color: "var(--text-primary)" },
          { label: "Late Arrivals", value: `${lateCount}x`, color: "var(--text-primary)" },
          { label: "Avg Hours/Day", value: "8h 15m", color: "var(--text-primary)" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl p-4"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <div className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{label}</div>
            <div className="text-2xl font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex items-center justify-start gap-2">
          <button
            onClick={() => setWeekStart((current) => addDays(current, -7))}
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.4rem", cursor: "pointer", color: "var(--text-secondary)", display: "flex" }}
            title="Previous week"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={openDatePicker}
            className="relative text-sm font-semibold"
            style={{ color: "var(--text-primary)", background: "transparent", border: "none", cursor: "pointer", padding: "0.25rem 0.5rem" }}
            title="Select week start date"
          >
            {weekLabel}
            <input
              ref={dateInputRef}
              type="date"
              value={formatInputDate(weekStart)}
              min={formatInputDate(new Date())}
              onChange={(event) => {
                if (event.target.value) {
                  setWeekStart(new Date(`${event.target.value}T00:00:00`));
                }
              }}
              style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }}
              tabIndex={-1}
            />
          </button>

          <button
            onClick={() => setWeekStart((current) => addDays(current, 7))}
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.4rem", cursor: "pointer", color: "var(--text-secondary)", display: "flex" }}
            title="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          className="ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: tableHeaderBgColor, borderBottom: "1px solid var(--border)" }}>
                {["Date", "Day", "Clock In", "Clock Out", "Break", "Total Hours", "Status"].map((heading) => (
                  <th
                    key={heading}
                    style={{ padding: "1rem 1.25rem", fontSize: "0.75rem", fontWeight: 600, color: tableHeaderTextColor, whiteSpace: "nowrap" }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: "2rem 1.25rem", textAlign: "center", color: "var(--text-secondary)" }}
                  >
                    No timesheet records found
                  </td>
                </tr>
              ) : filteredEntries.map((entry, index) => {
                const ss = statusStyle[entry.status];
                const isWeekend = entry.status === "Weekend";
                return (
                  <tr
                    key={`${entry.date}-${entry.day}`}
                    style={{
                      borderBottom: index !== filteredEntries.length - 1 ? "1px solid var(--border)" : "none",
                      background: isWeekend ? "var(--bg-hover)" : "var(--bg-primary)",
                      opacity: isWeekend ? 0.6 : 1,
                    }}
                  >
                    <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{entry.date}</td>
                    <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>{entry.day}</td>
                    <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.875rem", color: "var(--text-primary)" }}>{entry.clockIn}</td>
                    <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.875rem", color: "var(--text-primary)" }}>{entry.clockOut}</td>
                    <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>{entry.breakTime}</td>
                    <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{entry.totalHours}</td>
                    <td style={{ padding: "0.875rem 1.25rem" }}>
                      <span
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: ss.bg, color: ss.color }}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        <AttendancePage />
    </>
  );
}
