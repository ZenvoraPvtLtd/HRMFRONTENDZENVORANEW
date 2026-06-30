import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Zap,
  CalendarX,
  Clock,
  Pause,
  LogOut,
  ArrowRight,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import EmployeeChatbot from "../chatbot/EmployeeChatbot";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";
import { fetchMyLeaves } from "../../services/leaveApi";

// --- Sprints data ------------------------------------------------------------
const recentSprints = [
  {
    id: "1",
    title: "Zenvora HRM Sprint",
    description: "Sprint plan for current development cycle",
    start: "01/01/2026",
    end: "31/12/2026",
    color: "#f59e0b",
  },
  {
    id: "2",
    title: "Feature Backlog",
    description: "List of bugs, defects and feature enhancements",
    start: "01/12/2025",
    end: "30/06/2026",
    color: "#3b82f6",
  },
  {
    id: "3",
    title: "Product Release",
    description: "Product Release Bugs and Features",
    start: "29/12/2025",
    end: "10/12/2026",
    color: "var(--text-primary)",
  },
  {
    id: "4",
    title: "Q2 Goals",
    description: "Product Launch: Adding Features And Testing",
    start: "03/02/2026",
    end: "20/02/2027",
    color: "var(--text-primary)",
  },
  {
    id: "5",
    title: "Team Progress",
    description: "Team progress & tasks",
    start: "06/02/2026",
    end: "06/12/2026",
    color: "#ec4899",
  },
];

// --- Helpers -----------------------------------------------------------------
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

function getUserId() {
  return (
    localStorage.getItem("userId") ||
    localStorage.getItem("userEmail") ||
    "employee"
  );
}

// --- Main component -----------------------------------------------------------
export function  ManagerDashboard() {
  const navigate = useNavigate();

  const userId = getUserId();
  const clockKey = `clockInTime_${userId}`;
  const clockedInKey = `clockedIn_${userId}`;
  const onBreakKey = `onBreak_${userId}`;

  const [clockedIn, setClockedIn] = useState<boolean>(
    () => localStorage.getItem(clockedInKey) === "true"
  );
  const [onBreak, setOnBreak] = useState<boolean>(
    () => localStorage.getItem(onBreakKey) === "true"
  );
  const [clockInTime, setClockInTime] = useState<Date | null>(() => {
    const stored = localStorage.getItem(clockKey);
    return stored ? new Date(stored) : null;
  });
  const [elapsedMs, setElapsedMs] = useState<number>(() => {
    const stored = localStorage.getItem(clockKey);
    return stored ? Date.now() - new Date(stored).getTime() : 0;
  });

  const [search, setSearch] = useState("");
  const [pendingLeaves, setPendingLeaves] = useState(0);

  // -- Timer --
  useEffect(() => {
    if (!clockedIn || !clockInTime) return;
    const id = setInterval(() => {
      setElapsedMs(Date.now() - clockInTime.getTime());
    }, 1000);
    return () => clearInterval(id);
  }, [clockedIn, clockInTime]);

  // -- Clock actions --
  function handleClockIn() {
    const now = new Date();
    localStorage.setItem(clockKey, now.toISOString());
    localStorage.setItem(clockedInKey, "true");
    localStorage.setItem(onBreakKey, "false");
    setClockInTime(now);
    setElapsedMs(0);
    setOnBreak(false);
    setClockedIn(true);
  }

  function handleClockOut() {
    localStorage.removeItem(clockKey);
    localStorage.setItem(clockedInKey, "false");
    localStorage.setItem(onBreakKey, "false");
    setClockInTime(null);
    setElapsedMs(0);
    setOnBreak(false);
    setClockedIn(false);
  }

  function handleBreakToggle() {
    const next = !onBreak;
    localStorage.setItem(onBreakKey, String(next));
    setOnBreak(next);
  }

  // -- Search --
  useEffect(() => {
    const handleSearch = (event: Event) => {
      setSearch((event as CustomEvent<string>).detail || "");
    };
    window.addEventListener(SEARCH_EVENT, handleSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleSearch);
  }, []);

  // -- Leave stats --
  useEffect(() => {
    let isMounted = true;
    async function loadLeaveStats() {
      try {
        const leaves = await fetchMyLeaves();
        if (isMounted) {
          setPendingLeaves(
            leaves.filter((leave) => leave.status === "Pending").length
          );
        }
      } catch {
        if (isMounted) setPendingLeaves(0);
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

  // -- Derived values --
  const breakBudgetMin = 60;
  const breakUsedMin = Math.floor((elapsedMs / 1000 / 60) * 0.1);
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
    { icon: <Users size={18} />, value: "1", label: "Employees", color: "var(--accent)", path: undefined },
    { icon: <Zap size={18} />, value: String(activeSprintCount), label: "Active Sprints", color: "#0ea5e9", path: undefined },
    { icon: <CalendarX size={18} />, value: String(pendingLeaves), label: "Pending Leaves", color: "#f59e0b", path: undefined },
    { icon: <Clock size={18} />, value: thisWeekHours, label: "This Week", color: "#10b981", path: undefined },
    { icon: <CheckCircle2 size={18} />, value: String(pendingLeaves), label: "Approvals", color: "#8b5cf6", path: "/manager/approvals" },
  ];

  const filteredStats = useMemo(() => {
    if (!query) return stats;
    return stats.filter((stat) =>
      [stat.label, stat.value].some((v) => String(v).toLowerCase().includes(query))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, clockedIn, elapsedMs, pendingLeaves]);

  const filteredSprints = useMemo(() => {
    if (!query) return recentSprints.slice(0, 4);
    return recentSprints
      .filter((sprint) =>
        [sprint.title, sprint.description, sprint.start, sprint.end].some((v) =>
          v.toLowerCase().includes(query)
        )
      )
      .slice(0, 4);
  }, [query]);

  const showPayslips =
    !query || "recent payslips no payslips available payslip salary".includes(query);
  const hasResults = filteredStats.length > 0 || filteredSprints.length > 0 || showPayslips;

  return (
    <div className="flex flex-col md:flex-row gap-5 h-full" style={{ minHeight: 0 }}>
      {/* -- Left Sidebar -- */}
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
                ? `Clocked in at ${clockInDisplay} · On-site`
                : "Not clocked in"}
            </span>
          </div>

          {/* Break budget — only when clocked in */}
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

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {!clockedIn ? (
              <button
                onClick={() => { handleClockIn(); navigate("/manager/timesheet"); }}
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
          </div>
        </div>

        {/* Stat cards */}
        <div className="flex flex-col gap-3">
          {filteredStats.map(({ icon, value, label, color, path }) => (
            <div
              key={label}
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", cursor: path ? "pointer" : "default" }}
              onClick={() => path && navigate(path)}
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
          ))}
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

      {/* -- Main content area -- */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {/* Recent Sprints */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Recent Sprints
            </h2>
            <button
              onClick={() => navigate("/manager/sprint-board")}
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
            >
              View All <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSprints.map((sprint) => (
              <div
                key={sprint.id}
                onClick={() => navigate(`/manager/sprint-board/${sprint.id}`)}
                className="rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <h3
                    className="text-sm font-bold leading-snug"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {sprint.title}
                  </h3>
                </div>
                <p
                  className="text-xs leading-relaxed mb-4 pl-5.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {sprint.description}
                </p>
                <div
                  className="text-[11px] pt-3 pl-5.5"
                  style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}
                >
                  {sprint.start} – {sprint.end}
                </div>
              </div>
            ))}
          </div>

          {query && filteredSprints.length === 0 && (
            <div
              className="rounded-2xl p-6 text-sm"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              No sprints found for "{search}".
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
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
              >
                View All <ArrowRight size={13} />
              </button>
            </div>

            <div
              className="rounded-2xl p-12 flex flex-col items-center justify-center"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            >
              <FileText
                size={36}
                style={{ color: "var(--text-secondary)", opacity: 0.4, marginBottom: "0.75rem" }}
              />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                No payslips available
              </p>
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

      {/* Floating Chatbot */}
      <EmployeeChatbot />
    </div>
  );
}

