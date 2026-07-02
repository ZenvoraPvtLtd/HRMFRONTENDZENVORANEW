import { CalendarDays, ChevronDown, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";

import { useState, useEffect } from "react";
import { SEARCH_EVENT } from "../../../components/layout/TopHeader";
import api from "../../../utils/axiosInstance";

interface Employee {
  id: string;
  name: string;
  role?: string;
  shift?: string;
  workMode?: string;
  status?: string;
  clockIn?: string;
  clockOut?: string;
}

function formatTimeDisplay(val?: string): string {
  if (!val || val === "Absent" || val === "--" || val === "None") return val || "--";
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }
  } catch {}
  return val;
}

function calculateTotalTime(clockIn?: string, clockOut?: string): string {
  if (!clockIn || clockIn === "Absent" || clockIn === "--") return "--";
  if (!clockOut || clockOut === "Absent" || clockOut === "--" || clockOut === "None") return "--";

  try {
    const inDate = new Date(clockIn);
    const outDate = new Date(clockOut);
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
      const parseTime = (str: string) => {
        const parts = str.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
        if (!parts) return null;
        let hrs = parseInt(parts[1], 10);
        const mins = parseInt(parts[2], 10);
        const ampm = parts[4];
        if (ampm) {
          if (ampm.toUpperCase() === "PM" && hrs < 12) hrs += 12;
          if (ampm.toUpperCase() === "AM" && hrs === 12) hrs = 0;
        }
        return hrs * 60 + mins;
      };
      const inMins = parseTime(clockIn);
      const outMins = parseTime(clockOut);
      if (inMins !== null && outMins !== null) {
        const diff = outMins - inMins;
        if (diff < 0) return "--";
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        return `${h}h ${m}m`;
      }
      return "--";
    }
    const diffMs = outDate.getTime() - inDate.getTime();
    if (diffMs < 0) return "--";
    const totalMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}h ${mins}m`;
  } catch {
    return "--";
  }
}

const tabs = [
  "Today",
  "This Week",
  "This Month",
  "Day",
  "Range",
];

// Pure utility — no component state dependency, so kept outside the component
// to avoid stale-closure issues in useEffect deps.
const getDateRange = (tab: string, selectedDate: string) => {
  const start = selectedDate;
  const end = selectedDate;

  if (tab === "Today") {
    const todayStr = new Date().toISOString().split('T')[0];
    return { start: todayStr, end: todayStr };
  } else if (tab === "This Week") {
    const curr = new Date();
    const first = curr.getDate() - curr.getDay() + 1; // Monday
    const last = first + 6; // Sunday
    // Use separate Date objects to avoid mutation causing wrong-month Sunday
    const mondayDate = new Date(curr);
    mondayDate.setDate(first);
    const sundayDate = new Date(curr);
    sundayDate.setDate(last);
    const monday = mondayDate.toISOString().split('T')[0];
    const sunday = sundayDate.toISOString().split('T')[0];
    return { start: monday, end: sunday };
  } else if (tab === "This Month") {
    const curr = new Date();
    const firstDay = new Date(curr.getFullYear(), curr.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(curr.getFullYear(), curr.getMonth() + 1, 0).toISOString().split('T')[0];
    return { start: firstDay, end: lastDay };
  } else if (tab === "Day") {
    return { start: selectedDate, end: selectedDate };
  } else if (tab === "Range") {
    const baseDate = new Date(selectedDate);
    if (!isNaN(baseDate.getTime())) {
      const startRange = new Date(baseDate);
      startRange.setDate(startRange.getDate() - 30);
      const startStr = startRange.toISOString().split('T')[0];
      return { start: startStr, end: selectedDate };
    }
  }
  return { start, end };
};

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState("Today");
  const [search, setSearch] = useState("");
  const [teamMember, setTeamMember] = useState("All Team Members");
  const [statusFilter, setStatusFilter] = useState("All");
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [members, setMembers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ total: 0, checkedIn: 0, active: 0 });

  // Listen to navbar search
  useEffect(() => {
    const handleSearch = (event: Event) => {
      const customEvent = event as CustomEvent;
      setSearch(customEvent.detail || "");
    };
    window.addEventListener(SEARCH_EVENT, handleSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleSearch);
  }, []);

  const getDateRange = (tab: string, selectedDate: string) => {
    const start = selectedDate;
    const end = selectedDate;

    if (tab === "Today") {
      const todayStr = new Date().toISOString().split('T')[0];
      return { start: todayStr, end: todayStr };
    } else if (tab === "This Week") {
      const curr = new Date();
      const first = curr.getDate() - curr.getDay() + 1; // Monday
      const last = first + 6; // Sunday
      const monday = new Date(curr.setDate(first)).toISOString().split('T')[0];
      const sunday = new Date(curr.setDate(last)).toISOString().split('T')[0];
      return { start: monday, end: sunday };
    } else if (tab === "This Month") {
      const curr = new Date();
      const firstDay = new Date(curr.getFullYear(), curr.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(curr.getFullYear(), curr.getMonth() + 1, 0).toISOString().split('T')[0];
      return { start: firstDay, end: lastDay };
    } else if (tab === "Day") {
      return { start: selectedDate, end: selectedDate };
    } else if (tab === "Range") {
      const baseDate = new Date(selectedDate);
      if (!isNaN(baseDate.getTime())) {
        const startRange = new Date(baseDate);
        startRange.setDate(startRange.getDate() - 30);
        const startStr = startRange.toISOString().split('T')[0];
        return { start: startStr, end: selectedDate };
      }
    }
    return { start, end };
  };

  useEffect(() => {
    let isMounted = true;
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const { start, end } = getDateRange(activeTab, date);
        const response = await api.get("/api/manager/attendance", {
          params: {
            start,
            end,
            status: statusFilter,
            member: teamMember,
            search: search,
          }
        });
        if (isMounted && response.data) {
          type EmployeeAttendance = Employee & {
            clockIn: string;
            status: string;
          };
          const list: EmployeeAttendance[] = response.data.data || [];
          setEmployees(list);
          setMembers(response.data.members || []);
          if (response.data.summary) {
            setMetrics(response.data.summary);
          } else {
            setMetrics({
              total: list.length,
              checkedIn: list.filter((e) => e.clockIn !== "Absent").length,
              active: list.filter((e) => e.status === "On Time" || e.status === "Late" || e.status === "Present").length,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching attendance logs:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAttendance();

    return () => {
      isMounted = false;
    };
  }, [activeTab, date, statusFilter, teamMember, search]);

  // RESET
  const handleReset = () => {
    setSearch("");
    setStatusFilter("All");
    setTeamMember("All Team Members");
    setActiveTab("Today");
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
  };



  return (
    <div className="min-h-screen font-[Inter]" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>



      <main className="px-4 sm:px-6 lg:px-10 py-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-8">

          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {/* Attendance */}
            </h1>
          </div>
        </div>

       {/* FILTER BAR */}
<div
  className="rounded-3xl p-4 sm:p-5 mb-8 shadow-sm"
  style={{
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
  }}
>
  <div className="flex flex-wrap items-center gap-3">

    {/* TABS */}
    <div className="flex flex-wrap gap-2 flex-1 min-w-0">
      {tabs.map((tab) => {
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
            style={
              active
                ? {
                    background: "var(--accent)",
                    color: "var(--accent-text)",
                    border: "1px solid var(--accent)",
                  }
                : {
                    background: "transparent",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }
            }
          >
            {tab}
          </button>
        );
      })}
    </div>

    {/* DIVIDER */}
    <div style={{ width: 1, height: 36, background: "var(--border)", flexShrink: 0 }} className="hidden sm:block" />

    {/* DATE */}
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2"
      style={{
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <CalendarDays size={15} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="outline-none text-sm font-medium bg-transparent"
        style={{ color: "var(--text-primary)", minWidth: 110 }}
        aria-label="Filter date"
      />
    </div>

    {/* TEAM MEMBER */}
    <div className="relative" style={{ flexShrink: 0 }}>
      <select
        value={teamMember}
        onChange={(e) => setTeamMember(e.target.value)}
        className="rounded-xl px-3 py-2 text-sm cursor-pointer"
        aria-label="Team member filter"
        style={{
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          paddingRight: "2rem",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          outline: "none",
          minWidth: 140,
        }}
      >
        <option style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>
          All Team Members
        </option>
        {members.map((m) => (
          <option
            key={m.id || m.name}
            value={m.name}
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}
          >
            {m.name}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-secondary)" }} />
    </div>

    {/* STATUS */}
    <div className="relative" style={{ flexShrink: 0 }}>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="rounded-xl px-3 py-2 text-sm cursor-pointer"
        aria-label="Status filter"
        style={{
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          paddingRight: "2rem",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          outline: "none",
          minWidth: 100,
        }}
      >
        {["All", "On Time", "Late", "Absent"].map((s) => (
          <option key={s} value={s} style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>
            {s}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-secondary)" }} />
    </div>

  </div>
</div>

        {/* ATTENDANCE CARD */}
        <div className="rounded-3xl overflow-hidden shadow-sm" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>

          {/* CARD TOP */}
          <div className="p-5 border-b flex flex-col lg:flex-row gap-5 lg:items-center lg:justify-between" style={{ borderBottom: "1px solid var(--border)" }}>

            <div>
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>

                <CalendarDays size={16} />

                <span>
                  Team attendance for{" "}

                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {(() => {
                      // Append T00:00:00 to parse as local time instead of UTC midnight,
                      // which would shift the displayed date in UTC- timezones.
                      const dObj = new Date(date + 'T00:00:00');
                      return isNaN(dObj.getTime())
                        ? date
                        : dObj.toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          });
                    })()}
                  </span>
                </span>
              </div>

              <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>
                {metrics.total} members &bull;{" "}
                {metrics.checkedIn} checked-in &bull;{" "}
                {metrics.active} active
              </p>
            </div>

            {/* ACTIONS */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{
                  background: "var(--bg-primary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* TABLE OR CARDS BASED ON STATE */}
          {loading ? (
            <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-purple-600" size={32} />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading attendance records...</span>
            </div>
          ) : employees.length === 0 ? (
            <div className="p-16 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
              No attendance records found for this selection.
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                    <tr className="text-left text-sm" style={{ color: "var(--text-secondary)" }}>
                      <th className="px-6 py-4 font-medium">Employee</th>
                      <th className="px-6 py-4 font-medium">Role</th>
                      <th className="px-6 py-4 font-medium">Shift</th>
                      <th className="px-6 py-4 font-medium">Work Mode</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Clock-In</th>
                      <th className="px-6 py-4 font-medium">Clock-Out</th>
                      <th className="px-6 py-4 font-medium">Total Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee, index) => (
                      <tr key={employee.id || String(index)} className="border-b transition" style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-6 py-5 font-semibold">{employee.name}</td>
                        <td className="px-6 py-5" style={{ color: "var(--text-secondary)" }}>{employee.role}</td>
                        <td className="px-6 py-5" style={{ color: "var(--text-secondary)" }}>{employee.shift}</td>
                        <td className="px-6 py-5">
                          <WorkModeBadge mode={employee.workMode} />
                        </td>
                        <td className="px-6 py-5">
                          <StatusBadge status={employee.status} />
                        </td>
                        <td className="px-6 py-5 font-medium">{formatTimeDisplay(employee.clockIn)}</td>
                        <td className="px-6 py-5 font-medium">{formatTimeDisplay(employee.clockOut)}</td>
                        <td className="px-6 py-5 font-medium">{calculateTotalTime(employee.clockIn, employee.clockOut)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}
              <div className="lg:hidden p-4 space-y-4">
                {employees.map((employee, index) => (
                  <div key={employee.id || String(index)} className="rounded-3xl p-5" style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>{employee.name}</h3>
                        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{employee.role}</p>
                      </div>
                      <StatusBadge status={employee.status} />
                    </div>
                    <div className="mt-5 space-y-3 text-sm">
                      <MobileInfo label="Shift" value={employee.shift} />
                      <MobileInfo label="Work Mode" value={employee.workMode} />
                      <MobileInfo label="Clock-In" value={formatTimeDisplay(employee.clockIn)} />
                      <MobileInfo label="Clock-Out" value={formatTimeDisplay(employee.clockOut)} />
                      <MobileInfo label="Total Time" value={calculateTotalTime(employee.clockIn, employee.clockOut)} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status?: string;
}) {
  const s = status ?? "";
  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-medium"
      style={
        s === "On Time"
          ? {
              background: "var(--accent)",
              color: "var(--accent-text)",
            }
          : s === "Late"
          ? {
              background: "rgba(245,158,11,0.12)",
              color: "#F59E0B",
            }
          : {
              background: "rgba(239,68,68,0.12)",
              color: "#EF4444",
            }
      }
    >
      {s || "—"}
    </span>
  );
}

/* WORK MODE BADGE */
function WorkModeBadge({
  mode,
}: {
  mode?: string;
}) {
  return (
    <span className="rounded-full px-3 py-1 text-xs"
      style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
      {mode ?? "—"}
    </span>
  );
}

/* MOBILE INFO */
function MobileInfo({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>

      <span className="font-medium">
        {value ?? "—"}
      </span>
    </div>
  );
}
