import { CalendarDays, ChevronDown, Loader2, Mail, RefreshCw, CheckCircle2 } from "lucide-react";

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
}

const tabs = [
  "Today",
  "This Week",
  "This Month",
  "Day",
  "Range",
];

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

  // Auto-report state
  const [reportConfig, setReportConfig] = useState<{
    admin_email: string;
    weekly: { enabled: boolean; schedule: string };
    monthly: { enabled: boolean; schedule: string };
    _open?: boolean;
  } | null>(null);
  const [reportSending, setReportSending] = useState<"today" | "weekly" | "monthly" | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  // Listen to navbar search
  useEffect(() => {
    const handleSearch = (event: Event) => {
      const customEvent = event as CustomEvent;
      setSearch(customEvent.detail || "");
    };
    window.addEventListener(SEARCH_EVENT, handleSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleSearch);
  }, []);

  // Fetch auto-report config once
  useEffect(() => {
    api.get("/api/attendance/reports/config")
      .then((res) => setReportConfig(res.data))
      .catch(() => { /* silently ignore if endpoint unavailable */ });
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
          type EmployeeAttendance = {
            clockIn: string;
            status: string;
          };
          const list: any[] = response.data.data || [];
          setEmployees(list);
          setMembers(response.data.members || []);
          if (response.data.summary) {
            setMetrics(response.data.summary);
          } else {
            setMetrics({
              total: list.length,
              checkedIn: list.filter((e: EmployeeAttendance) => e.clockIn !== "Absent").length,
              active: list.filter((e: EmployeeAttendance) => e.status === "On Time" || e.status === "Late" || e.status === "Present").length,
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

  const filteredEmployees = employees;

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

  // SEND REPORT NOW
  const handleSendReport = async (type: "today" | "weekly" | "monthly") => {
    setReportSending(type);
    setReportSuccess(null);
    try {
      await api.post(`/api/attendance/reports/send-now?report_type=${type}`);
      const label = type === "today" ? "Today's" : type === "weekly" ? "Weekly" : "Monthly";
      setReportSuccess(`${label} report sent to admin email!`);
      setTimeout(() => setReportSuccess(null), 5000);
    } catch {
      setReportSuccess("Failed to send report. Check server logs.");
    } finally {
      setReportSending(null);
    }
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
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
            style={
              active
                ? {
                    background: "var(--text-primary)",
                    color: "var(--bg-primary)",
                    border: "1px solid var(--text-primary)",
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
      />
    </div>

    {/* TEAM MEMBER */}
    <div className="relative" style={{ flexShrink: 0 }}>
      <select
        value={teamMember}
        onChange={(e) => setTeamMember(e.target.value)}
        className="rounded-xl px-3 py-2 text-sm cursor-pointer"
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
        <div className="rounded-3xl shadow-sm" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>

          {/* CARD TOP */}
          <div className="p-5 border-b flex flex-col lg:flex-row gap-5 lg:items-center lg:justify-between" style={{ borderBottom: "1px solid var(--border)" }}>

            <div>
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>

                <CalendarDays size={16} />

                <span>
                  Team attendance for{" "}

                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {(() => {
                      const dObj = new Date(date);
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

              {/* AUTO REPORT BUTTON */}
              <div className="relative">
                <button
                  onClick={() => setReportConfig(rc => rc ? { ...rc, _open: !rc._open } : rc)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition"
                  style={{
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Mail size={15} />
                  Auto Report
                  <ChevronDown size={13} />
                </button>

                {/* DROPDOWN PANEL */}
                {reportConfig && (reportConfig as any)._open && (
                  <div
                    className="absolute right-0 top-full mt-2 z-50 rounded-2xl shadow-2xl"
                    style={{
                      width: 320,
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      padding: "1.25rem",
                    }}
                  >
                    <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
                      AUTO-GENERATED REPORTS
                    </p>
                    <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
                      Reports are emailed automatically to:<br />
                      <strong style={{ color: "var(--text-primary)" }}>{reportConfig.admin_email}</strong>
                    </p>

                    {/* Today */}
                    <div
                      className="rounded-xl p-3 mb-3"
                      style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          📊 Today's Report
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}
                        >
                          On-demand
                        </span>
                      </div>
                      <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
                        Today — {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <button
                        onClick={() => handleSendReport("today")}
                        disabled={reportSending === "today"}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        style={{
                          background: "#6366f1",
                          color: "#fff",
                          border: "none",
                          cursor: reportSending === "today" ? "not-allowed" : "pointer",
                          opacity: reportSending === "today" ? 0.65 : 1,
                        }}
                      >
                        {reportSending === "today"
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Mail size={12} />
                        }
                        Send Now
                      </button>
                    </div>

                    {/* Weekly */}
                    <div
                      className="rounded-xl p-3 mb-3"
                      style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          📅 Weekly Report
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}
                        >
                          Active
                        </span>
                      </div>
                      <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
                        {reportConfig.weekly.schedule}
                      </p>
                      <button
                        onClick={() => handleSendReport("weekly")}
                        disabled={reportSending === "weekly"}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        style={{
                          background: "var(--text-primary)",
                          color: "var(--bg-primary)",
                          border: "none",
                          cursor: reportSending === "weekly" ? "not-allowed" : "pointer",
                          opacity: reportSending === "weekly" ? 0.65 : 1,
                        }}
                      >
                        {reportSending === "weekly"
                          ? <Loader2 size={12} className="animate-spin" />
                          : <RefreshCw size={12} />
                        }
                        Send Now
                      </button>
                    </div>

                    {/* Monthly */}
                    <div
                      className="rounded-xl p-3"
                      style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          🗓️ Monthly Report
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}
                        >
                          Active
                        </span>
                      </div>
                      <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
                        {reportConfig.monthly.schedule}
                      </p>
                      <button
                        onClick={() => handleSendReport("monthly")}
                        disabled={reportSending === "monthly"}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        style={{
                          background: "var(--text-primary)",
                          color: "var(--bg-primary)",
                          border: "none",
                          cursor: reportSending === "monthly" ? "not-allowed" : "pointer",
                          opacity: reportSending === "monthly" ? 0.65 : 1,
                        }}
                      >
                        {reportSending === "monthly"
                          ? <Loader2 size={12} className="animate-spin" />
                          : <RefreshCw size={12} />
                        }
                        Send Now
                      </button>
                    </div>

                    {/* Success message */}
                    {reportSuccess && (
                      <div
                        className="mt-3 flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl"
                        style={{
                          background: reportSuccess.startsWith("Failed")
                            ? "rgba(239,68,68,0.08)"
                            : "rgba(22,163,74,0.08)",
                          color: reportSuccess.startsWith("Failed") ? "#ef4444" : "#16a34a",
                          border: `1px solid ${reportSuccess.startsWith("Failed") ? "rgba(239,68,68,0.2)" : "rgba(22,163,74,0.2)"}`,
                        }}
                      >
                        <CheckCircle2 size={13} />
                        {reportSuccess}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TABLE OR CARDS BASED ON STATE */}
          {loading ? (
            <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-purple-600" size={32} />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading attendance records...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee, index) => (
                      <tr key={index} className="border-b transition" style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-6 py-5 font-semibold">{employee.name}</td>
                        <td className="px-6 py-5" style={{ color: "var(--text-secondary)" }}>{employee.role}</td>
                        <td className="px-6 py-5" style={{ color: "var(--text-secondary)" }}>{employee.shift}</td>
                        <td className="px-6 py-5">
                          <WorkModeBadge mode={employee.workMode} />
                        </td>
                        <td className="px-6 py-5">
                          <StatusBadge status={employee.status} />
                        </td>
                        <td className="px-6 py-5 font-medium">{employee.clockIn}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}
              <div className="lg:hidden p-4 space-y-4">
                {filteredEmployees.map((employee, index) => (
                  <div key={index} className="rounded-3xl p-5" style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
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
                      <MobileInfo label="Clock-In" value={employee.clockIn} />
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
  status: string;
}) {
  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-medium"
      style={
        status === "On Time"
          ? {
              background: "var(--accent)",
              color: "var(--accent-text)",
            }
          : status === "Late"
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
      {status}
    </span>
  );
}

/* WORK MODE BADGE */
function WorkModeBadge({
  mode,
}: {
  mode: string;
}) {
  return (
    <span className="rounded-full px-3 py-1 text-xs"
      style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
      {mode}
    </span>
  );
}

/* MOBILE INFO */
function MobileInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>

      <span className="font-medium">
        {value}
      </span>
    </div>
  );
}

