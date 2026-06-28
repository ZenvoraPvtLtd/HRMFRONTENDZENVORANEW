import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Zap,
  CalendarX,
  Clock,
  ArrowRight,
  FileText,
  CheckCircle2,
  X,
  Megaphone,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import EmployeeChatbot from "../chatbot/EmployeeChatbot";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";
import { fetchMyLeaves } from "../../services/leaveApi";
import {
  getSprintBoardBasePath,
} from "../../utils/sprintBoardPath";
import { getApiBaseUrl } from "../../config/apiConfig";
import {
  getElapsedBreakSeconds,
  getElapsedWorkSeconds,
  getLastWorkSession,
  readWorkClock,
  WORK_CLOCK_EVENT,
} from "../../utils/workClock";

// ─── Sprints data ────────────────────────────────────────────────────────────
type DashboardSprint = {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
};

type RawSprint = {
  id?: string | number;
  _id?: string;
  name?: string;
  title?: string;
  description?: string;
  start_date?: string | null;
  created_at?: string | null;
  end_date?: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function formatShortTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSprintDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeSprint(sprint: RawSprint): DashboardSprint {
  return {
    id: String(sprint.id || sprint._id || ""),
    title: sprint.name || sprint.title || "Untitled Sprint",
    description: sprint.description || "No description added.",
    start: formatSprintDate(sprint.start_date || sprint.created_at),
    end: formatSprintDate(sprint.end_date),
  };
}

// ─── Mock Payslip data ───────────────────────────────────────────────────────
export type MockPayslip = {
  id: string;
  month: string;
  year: string;
  amount: number;
  date: string;
  status: string;
  basic: number;
  hra: number;
  allowance: number;
  deductions: number;
  net: number;
};

export const mockPayslips: MockPayslip[] = [
  {
    id: "PS-2026-05",
    month: "May",
    year: "2026",
    amount: 4500,
    date: "31 May 2026",
    status: "Paid",
    basic: 3000,
    hra: 900,
    allowance: 800,
    deductions: 200,
    net: 4500,
  },
  {
    id: "PS-2026-04",
    month: "April",
    year: "2026",
    amount: 4500,
    date: "30 Apr 2026",
    status: "Paid",
    basic: 3000,
    hra: 900,
    allowance: 800,
    deductions: 200,
    net: 4500,
  },
  {
    id: "PS-2026-03",
    month: "March",
    year: "2026",
    amount: 4500,
    date: "31 Mar 2026",
    status: "Paid",
    basic: 3000,
    hra: 900,
    allowance: 800,
    deductions: 200,
    net: 4500,
  },
];

// ─── Main component ───────────────────────────────────────────────────────────
export function DashboardOverview() {
  const navigate = useNavigate();
  const location = useLocation();
  const sprintBoardBasePath = getSprintBoardBasePath(location.pathname);

  // Per-user localStorage keys — computed once using ref so they never change
  const initialClock = readWorkClock("On-site");
  const [clockedIn, setClockedIn] = useState<boolean>(initialClock.clockedIn);
  const [onBreak, setOnBreak] = useState<boolean>(initialClock.onBreak);
  const [clockInTime, setClockInTime] = useState<Date | null>(initialClock.clockInTime);
  const [elapsedMs, setElapsedMs] = useState<number>(
    () => getElapsedWorkSeconds(initialClock.clockInTime) * 1000
  );

  const [search, setSearch] = useState("");
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [recentSprints, setRecentSprints] = useState<DashboardSprint[]>([]);
  const [lastSession, setLastSession] = useState(() => getLastWorkSession());
  const [selectedPayslip, setSelectedPayslip] = useState<MockPayslip | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  const [leavesLoading, setLeavesLoading] = useState(true);
  const [leavesError, setLeavesError] = useState(false);
  const [sprintsLoading, setSprintsLoading] = useState(true);
  const [sprintsError, setSprintsError] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  // ── Timer ──
  useEffect(() => {
    if (!clockedIn || !clockInTime) {
      return;
    }
    const id = setInterval(() => {
      setElapsedMs(getElapsedWorkSeconds(clockInTime) * 1000);
    }, 1000);
    return () => clearInterval(id);
  }, [clockedIn, clockInTime]);

  useEffect(() => {
    const syncClock = () => {
      const clock = readWorkClock("On-site");
      setClockedIn(clock.clockedIn);
      setOnBreak(clock.onBreak);
      setClockInTime(clock.clockInTime);
      setElapsedMs(getElapsedWorkSeconds(clock.clockInTime) * 1000);
      setLastSession(getLastWorkSession());
    };

    window.addEventListener(WORK_CLOCK_EVENT, syncClock);
    window.addEventListener("storage", syncClock);
    return () => {
      window.removeEventListener(WORK_CLOCK_EVENT, syncClock);
      window.removeEventListener("storage", syncClock);
    };
  }, []);

  // ── Search ──
  useEffect(() => {
    const handleSearch = (event: Event) => {
      setSearch((event as CustomEvent<string>).detail || "");
    };
    window.addEventListener(SEARCH_EVENT, handleSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleSearch);
  }, []);

  // ── Leave stats ──
  useEffect(() => {
    let isMounted = true;
    async function loadLeaveStats() {
      setLeavesLoading(true);
      setLeavesError(false);
      try {
        const leaves = await fetchMyLeaves();
        if (isMounted) {
          setPendingLeaves(leaves.filter((leave) => leave.status === "Pending").length);
          setLeavesLoading(false);
        }
      } catch {
        if (isMounted) { setPendingLeaves(0); setLeavesLoading(false); setLeavesError(true); }
      }
    }
    void loadLeaveStats();
    window.addEventListener("focus", loadLeaveStats);
    window.addEventListener("storage", loadLeaveStats);
    window.addEventListener("zenvora-leave-updated", loadLeaveStats);
    return () => {
      isMounted = false;
      window.removeEventListener("focus", loadLeaveStats);
      window.removeEventListener("storage", loadLeaveStats);
      window.removeEventListener("zenvora-leave-updated", loadLeaveStats);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadSprints() {
      setSprintsLoading(true);
      setSprintsError(false);
      try {
        const token = localStorage.getItem("accessToken") || "";
        const res = await fetch(`${getApiBaseUrl()}/api/sprints`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (isMounted) {
          if (data.success && Array.isArray(data.sprints)) {
            setRecentSprints(data.sprints.map(normalizeSprint).filter((sprint: DashboardSprint) => sprint.id));
          }
          setSprintsLoading(false);
        }
      } catch {
        if (isMounted) { setRecentSprints([]); setSprintsLoading(false); setSprintsError(true); }
      }
    }
    void loadSprints();
    window.addEventListener("focus", loadSprints);
    return () => {
      isMounted = false;
      window.removeEventListener("focus", loadSprints);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadEmployeeStats() {
      setStatsLoading(true);
      setStatsError(false);
      try {
        const token = localStorage.getItem("accessToken") || "";
        const res = await fetch(`${getApiBaseUrl()}/api/employees/stats/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (isMounted) {
          setEmployeeCount(Number(data.totalEmployees || 0));
          setStatsLoading(false);
        }
      } catch {
        if (isMounted) { setEmployeeCount(0); setStatsLoading(false); setStatsError(true); }
      }
    }
    void loadEmployeeStats();
    window.addEventListener("focus", loadEmployeeStats);
    return () => {
      isMounted = false;
      window.removeEventListener("focus", loadEmployeeStats);
    };
  }, []);
  useEffect(() => {
    let isMounted = true;
    async function loadAnnouncements() {
      setAnnouncementsLoading(true);
      try {
        const token = localStorage.getItem("accessToken") || "";
        const res = await fetch(`${getApiBaseUrl()}/api/announcements`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setAnnouncements(Array.isArray(data) ? data : []);
          }
        }
      } catch (err) {
        console.error("Failed to load announcements:", err);
      } finally {
        if (isMounted) {
          setAnnouncementsLoading(false);
        }
      }
    }
    void loadAnnouncements();
  }, []);
  // ── Derived values ──
  const breakBudgetMin = 60;
  const breakUsedMin = Math.floor(getElapsedBreakSeconds("On-site") / 60);
  const breakLeftMin = Math.max(0, breakBudgetMin - breakUsedMin);
  const clockInDisplay = clockInTime
    ? clockInTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--";
  const activeSprintCount = recentSprints.slice(0, 4).length;
  const thisWeekHours = `${Math.floor(elapsedMs / 3600000)}.${pad(Math.floor((elapsedMs % 3600000) / 60000))}h`;
  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const query = search.trim().toLowerCase();

  const stats = [
    { icon: <Users size={18} />, value: String(employeeCount), label: "Employees", color: "var(--accent)" },
    { icon: <Zap size={18} />, value: String(activeSprintCount), label: "Active Sprints", color: "#0ea5e9" },
    { icon: <CalendarX size={18} />, value: String(pendingLeaves), label: "Pending Leaves", color: "#f59e0b" },
    { icon: <Clock size={18} />, value: thisWeekHours, label: "This Week", color: "#10b981" },
  ];

  const filteredStats = useMemo(() => {
    if (!query) return stats;
    return stats.filter((stat) =>
      [stat.label, stat.value].some((v) => String(v).toLowerCase().includes(query))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, clockedIn, elapsedMs, pendingLeaves, employeeCount, activeSprintCount]);

  const filteredSprints = useMemo(() => {
    if (!query) return recentSprints.slice(0, 4);
    return recentSprints
      .filter((sprint) =>
        [sprint.title, sprint.description, sprint.start, sprint.end].some((v) =>
          v.toLowerCase().includes(query)
        )
      )
      .slice(0, 4);
  }, [query, recentSprints]);

  const filteredAnnouncements = useMemo(() => {
    const list = announcements.length > 0 ? announcements : [
      {
        id: "dummy-1",
        title: "Mandatory Weekly Team Meeting",
        message: "Everyone kindly join from your respective desk at 6:00 PM. Meeting Link - https://meet.google.com/ozf-zwp-vcc",
        priority: "Medium",
        published: "28 Jun 2026",
      },
      {
        id: "dummy-2",
        title: "Sales Performance Notice",
        message: "Need immediate attention and productive work to avoid any escalations.",
        priority: "High",
        published: "27 Jun 2026",
      },
      {
        id: "dummy-3",
        title: "Welcome Onboard to Vected EMS - Beta Version",
        message: "Feel free to report any bugs identified while working with the platform.",
        priority: "Low",
        published: "26 Jun 2026",
      }
    ];

    if (!query) return list;
    return list.filter((ann) =>
      [ann.title, ann.message || ann.content || "", ann.priority].some((v) =>
        String(v).toLowerCase().includes(query)
      )
    );
  }, [query, announcements]);

  const showPayslips =
    !query || "recent payslips no payslips available payslip salary".includes(query);
  const hasResults =
    filteredStats.length > 0 ||
    filteredSprints.length > 0 ||
    showPayslips ||
    filteredAnnouncements.length > 0;

  return (
    <div className="flex flex-col md:flex-row gap-5 h-full" style={{ minHeight: 0 }}>
      {/* ── Left Sidebar ── */}
      <div className="dashboard-sidebar flex flex-col gap-4 shrink-0">
        {/* Status card */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              Today's Status
            </span>
            {clockedIn && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  padding: "0.25rem 0.6rem",
                  borderRadius: "9999px",
                  background: "#dcfce7",
                  color: "#16a34a",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#16a34a",
                    display: "inline-block",
                  }}
                />
                Live
              </span>
            )}
          </div>

          {/* Date */}
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            {today}
          </p>

          {/* Timer */}
          <div
            className="text-3xl font-bold tabular-nums mb-1"
            style={{ color: "var(--accent)", letterSpacing: "0.04em" }}
          >
            {clockedIn ? formatElapsed(elapsedMs) : "00:00:00"}
          </div>

          <div className="flex items-center gap-1.5 mb-4">
            <CheckCircle2
              size={13}
              style={{ color: clockedIn ? "#16a34a" : "var(--text-secondary)" }}
            />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {clockedIn
                ? `Clocked in at ${clockInDisplay} · ${onBreak ? "On break" : "On-site"}`
                : "Not clocked in"}
            </span>
          </div>

          {/* Break budget — only when clocked in */}
          {!clockedIn && lastSession && (
            <div
              className="rounded-xl px-3 py-3 mb-4"
              style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                Last Clock Out
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>Clock In</span>
                <strong style={{ color: "var(--text-primary)", textAlign: "right" }}>{formatShortTime(lastSession.clockInTime)}</strong>
                <span>Clock Out</span>
                <strong style={{ color: "var(--text-primary)", textAlign: "right" }}>{formatShortTime(lastSession.clockOutTime)}</strong>
                <span>Work Time</span>
                <strong style={{ color: "#10b981", textAlign: "right" }}>{formatElapsed(lastSession.workSeconds * 1000)}</strong>
                <span>Break Time</span>
                <strong style={{ color: "#f59e0b", textAlign: "right" }}>{formatElapsed(lastSession.breakSeconds * 1000)}</strong>
              </div>
            </div>
          )}

          {clockedIn && (
            <div
              className="rounded-xl px-3 py-2.5 mb-4 flex items-center justify-between"
              style={{ background: "#10b98112", border: "1px solid #10b98120" }}
            >
              <span className="text-xs" style={{ color: "#10b981" }}>
                Break remaining
              </span>
              <span className="text-xs font-bold" style={{ color: "#10b981" }}>
                {breakLeftMin} min
              </span>
            </div>
          )}

          {/* Actions
          <div className="flex flex-col gap-2">
            {!clockedIn ? (
              <button
                onClick={() => { handleClockIn(); navigate(`${portalBasePath}/timesheet`); }}
                className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition-opacity hover:opacity-80 w-full"
                style={{
                  background: "#000000",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <CheckCircle2 size={14} />
                Clock In
              </button>
            ) : (
              <>
                <button
                  onClick={handleBreakToggle}
                  className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition-opacity hover:opacity-80 w-full"
                  style={{
                    background: onBreak ? "#ffffff" : "var(--bg-hover)",
                    color: onBreak ? "#000000" : "var(--text-primary)",
                    border: onBreak ? "1px solid #ffffff" : "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <Pause size={14} />
                  {onBreak ? "Resume Work" : "Take Break"}
                </button>
                <button
                  onClick={handleClockOut}
                  className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition-opacity hover:opacity-80 w-full"
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    color: "#ef4444",
                    border: "1px solid rgba(239,68,68,0.2)",
                    cursor: "pointer",
                  }}
                >
                  <LogOut size={14} />
                  Clock Out
                </button>
              </>
            )}
          </div> */}
        </div>

        {/* Stat cards */}
        <div className="flex flex-col gap-3">
          {(leavesLoading || statsLoading) ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl px-4 py-3 flex items-center gap-3 animate-pulse"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div className="w-8 h-8 rounded-lg shrink-0" style={{ background: "var(--bg-hover)" }} />
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="h-4 rounded w-10" style={{ background: "var(--bg-hover)" }} />
                  <div className="h-3 rounded w-20" style={{ background: "var(--bg-hover)" }} />
                </div>
              </div>
            ))
          ) : (leavesError || statsError) ? (
            <div className="rounded-xl px-4 py-3 text-xs text-center"
              style={{ background: "var(--bg-secondary)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
              Failed to load stats. Please refresh.
            </div>
          ) : (
            filteredStats.map(({ icon, value, label, color }) => (
              <div
                key={label}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: color + "18", color }}
                >
                  {icon}
                </div>
                <div>
                  <div className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    {value}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {label}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {query && filteredStats.length === 0 && (
          <div
            className="rounded-xl px-4 py-3 text-xs"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            No stats found for "{search}".
          </div>
        )}
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {/* Recent Sprints */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Recent Sprints
            </h2>
            <button
              onClick={() => navigate(`${sprintBoardBasePath}`)}
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
            >
              View All <ArrowRight size={13} />
            </button>
          </div>

          {sprintsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl p-5 animate-pulse"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <div className="h-4 rounded w-3/4 mb-3" style={{ background: "var(--bg-hover)" }} />
                  <div className="h-3 rounded w-full mb-2" style={{ background: "var(--bg-hover)" }} />
                  <div className="h-3 rounded w-2/3 mb-4" style={{ background: "var(--bg-hover)" }} />
                  <div className="h-3 rounded w-1/2 mt-3 pt-3" style={{ background: "var(--bg-hover)", borderTop: "1px solid var(--border)" }} />
                </div>
              ))}
            </div>
          ) : sprintsError ? (
            <div className="rounded-2xl p-6 text-sm text-center"
              style={{ background: "var(--bg-secondary)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
              Failed to load sprints. Please refresh.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSprints.map((sprint) => (
                  <div
                    key={sprint.id}
                    onClick={() => navigate(`${sprintBoardBasePath}/${sprint.id}`)}
                    className="rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <h3 className="text-sm font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
                        {sprint.title}
                      </h3>
                    </div>
                    <p className="text-xs leading-relaxed mb-4 pl-5.5" style={{ color: "var(--text-secondary)" }}>
                      {sprint.description}
                    </p>
                    <div className="text-[11px] pt-3 pl-5.5"
                      style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}>
                      {sprint.start} – {sprint.end}
                    </div>
                  </div>
                ))}
              </div>
              {query && filteredSprints.length === 0 && (
                <div className="rounded-2xl p-6 text-sm"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  No sprints found for "{search}".
                </div>
              )}
              {!query && filteredSprints.length === 0 && (
                <div className="rounded-2xl p-6 text-sm"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  No sprints yet. Create a sprint from Sprint Board to see it here.
                </div>
              )}
            </>
          )}
        </div>

        {/* Announcements */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Megaphone size={18} style={{ color: "var(--accent)" }} /> Announcements
            </h2>
          </div>

          {announcementsLoading && announcements.length === 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl p-5 animate-pulse"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <div className="h-4 rounded w-1/4 mb-3" style={{ background: "var(--bg-hover)" }} />
                  <div className="h-3 rounded w-full mb-2" style={{ background: "var(--bg-hover)" }} />
                  <div className="h-3 rounded w-2/3" style={{ background: "var(--bg-hover)" }} />
                </div>
              ))}
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center text-sm"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              No announcements found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredAnnouncements.map((ann) => {
                const priorityColor =
                  ann.priority?.toLowerCase() === "high"
                    ? "#ef4444"
                    : ann.priority?.toLowerCase() === "medium"
                    ? "#f59e0b"
                    : "#10b981";
                return (
                  <div
                    key={ann.id || ann._id}
                    className="rounded-2xl p-5 flex flex-col gap-2"
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        {ann.title}
                      </h3>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                        style={{
                          background: `${priorityColor}15`,
                          color: priorityColor,
                        }}
                      >
                        {ann.priority || "Medium"}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {ann.message || ann.content}
                    </p>
                    <div
                      className="text-[10px] mt-2 pt-2 border-t flex justify-between"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      <span>Target: {ann.targetType || "All Employees"}</span>
                      <span>Published: {ann.published || ann.createdAt?.slice(0, 10) || "Recent"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Payslips */}
        {showPayslips && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Recent Payslips
              </h2>
              <button
                onClick={() => setSelectedPayslip(mockPayslips[0])}
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
              >
                View All <ArrowRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {mockPayslips.map((payslip) => (
                <div
                  key={payslip.id}
                  onClick={() => setSelectedPayslip(payslip)}
                  className="flex items-center justify-between p-4 rounded-2xl cursor-pointer hover:bg-hover transition-colors"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
                    >
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        Payslip - {payslip.month} {payslip.year}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {payslip.date} • {payslip.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      ${payslip.amount.toLocaleString()}
                    </span>
                    <span 
                      className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
                    >
                      {payslip.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasResults && (
          <div
            className="rounded-2xl p-8 text-center text-sm"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            No employee dashboard results found for "{search}".
          </div>
        )}
      </div>

      {selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg rounded-3xl p-6 relative"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedPayslip(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-hover transition-colors"
              style={{ color: "var(--text-secondary)", border: "none", background: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
              >
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base">Salary Slip</h3>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {selectedPayslip.month} {selectedPayslip.year} • {selectedPayslip.id}
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="space-y-4 text-sm mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Employee Name</span>
                  <span className="font-semibold">{localStorage.getItem("userName") || "Zenvora Member"}</span>
                </div>
                <div>
                  <span className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Status</span>
                  <span className="inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                    {selectedPayslip.status}
                  </span>
                </div>
                <div>
                  <span className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Payment Date</span>
                  <span>{selectedPayslip.date}</span>
                </div>
                <div>
                  <span className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Payment Method</span>
                  <span>Direct Deposit</span>
                </div>
              </div>

              {/* Financial Breakdowns */}
              <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <h4 className="font-bold text-xs uppercase mb-3" style={{ color: "var(--text-secondary)" }}>Earnings</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Basic Salary</span>
                    <span className="font-medium">${selectedPayslip.basic.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HRA</span>
                    <span className="font-medium">${selectedPayslip.hra.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Allowances</span>
                    <span className="font-medium">${selectedPayslip.allowance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="font-bold text-xs uppercase mb-3" style={{ color: "var(--text-secondary)" }}>Deductions</h4>
                <div className="flex justify-between">
                  <span>Taxes & Pf</span>
                  <span className="font-medium text-red-500">-${selectedPayslip.deductions.toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex justify-between items-center font-bold text-base" style={{ borderColor: "var(--border)" }}>
                <span>Net Salary</span>
                <span style={{ color: "var(--accent)" }}>${selectedPayslip.net.toLocaleString()}</span>
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={() => {
                alert("Downloading Payslip PDF...");
                setSelectedPayslip(null);
              }}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 cursor-pointer"
              style={{ background: "var(--accent)", color: "#fff", border: "none" }}
            >
              Download PDF
            </button>
          </div>
        </div>
      )}

      {/* Floating Chatbot */}
      <EmployeeChatbot />
    </div>
  );
}
