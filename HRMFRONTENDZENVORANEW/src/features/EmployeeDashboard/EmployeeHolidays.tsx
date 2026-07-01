import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Flag,
  Gift,
  Sparkles,
} from "lucide-react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import {
  card,
  HR_YEAR_OPTIONS,
  hrPageWrap,
  inputMuted,
  tableHead,
  textPrimary,
  textSecondary,
} from "../HRdashboard/hrTheme";
import { fetchHolidays } from "../../services/holidayApi";

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

const initialHolidays: Holiday[] = [];

function formatHolidayDate(date: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(`${date}T00:00:00`));
  } catch {
    return date;
  }
}

function getHolidayDay(date: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
      new Date(`${date}T00:00:00`),
    );
  } catch {
    return "";
  }
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

export default function EmployeeHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedYear, setSelectedYear] = useState("2026");
  const [search] = useTopHeaderSearch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHolidays() {
    try {
      setIsLoading(true);
      setError("");
      const data = await fetchHolidays();
      const list = Array.isArray(data) ? data : data.holidays || data.data || [];
      setHolidays(list.length > 0 ? list : initialHolidays);
    } catch (err) {
      console.error("Failed to load holidays", err);
      setError("Failed to load holidays. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadHolidays();
  }, []);

  const yearHolidays = useMemo(
    () =>
      holidays
        .filter((holiday) => holiday.date.startsWith(selectedYear))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, selectedYear],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredHolidays = useMemo(() => {
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

  return (
    <div className={hrPageWrap} style={{ padding: "1.5rem" }}>
      <div className="max-w-[1280px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h1 className="text-xl font-bold" style={textPrimary}>
            Holiday Calendar
          </h1>
          <div className="w-full sm:w-auto">
            <ConstrainedDropdown
              value={selectedYear}
              onChange={setSelectedYear}
              options={HR_YEAR_OPTIONS}
              className="w-full sm:w-32"
              buttonStyle={inputMuted}
            />
          </div>
        </div>

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

        <div className="grid grid-cols-1 md:grid-cols-[repeat(3,minmax(0,1fr))_minmax(220px,0.75fr)] gap-4 mb-6">
          <MetricCard label="Total Holidays" value={String(yearHolidays.length)} />
          <MetricCard label="Upcoming" value={String(upcomingHolidays.length)} />
          <MetricCard label="Elapsed" value={String(elapsedHolidays)} />
          <div
            className="rounded-lg px-4 py-3 min-h-[76px] flex flex-col items-center justify-center text-center shadow-sm"
            style={{
              background: "var(--bg-secondary)",
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
                  {["Day", "Date", "Occasion", "Holiday Type"].map((column) => (
                    <th key={column} className="px-4 py-4 text-xs font-semibold text-left">
                      {column}
                    </th>
                  ))}
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
                  </tr>
                ))}

                {filteredHolidays.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm" style={textSecondary}>
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
            <div key={holiday.id} className="rounded-xl p-4 shadow-sm" style={card}>
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
                  <span
                    className="max-w-full px-3 py-1 rounded-full text-xs font-semibold break-words"
                    style={getTypeStyle(holiday.type)}
                  >
                    {holiday.type}
                  </span>
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
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-4 py-3 min-h-[76px] flex items-center justify-center text-center shadow-sm" style={card}>
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
