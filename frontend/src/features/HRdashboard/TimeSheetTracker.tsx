import { useState, useEffect } from "react";

import {
  Clock3,
  Play,
  Pause,
  RefreshCcw,
  CalendarDays,
  TrendingUp,
  Coffee,
  CheckCircle2,
  Download,
  Sparkles,
} from "lucide-react";
import ResetButton from "../../components/button/ResetButton";
import {
  getElapsedWorkSeconds,
  readWorkClock,
  saveWorkBreakState,
  saveWorkClockIn,
  saveWorkClockOut,
  WORK_CLOCK_EVENT,
} from "../../utils/workClock";

import {
  hrPageWrap,
  card,
  cardInner,
  textPrimary,
  textSecondary,
  btnSecondary,
} from "./hrTheme";

type TimelineItem = {
  title: string;
  time: string;
  icon: React.ReactNode;
  color: string;
};

type WeeklyStat = {
  day: string;
  hours: number;
};

export default function TimeSheetTracker() {
  const initialClock = readWorkClock("On-site");
  const [seconds, setSeconds] = useState(() =>
    getElapsedWorkSeconds(initialClock.clockInTime)
  );

  const [isRunning, setIsRunning] =
    useState(initialClock.clockedIn && !initialClock.onBreak);

  const [timeline, setTimeline] =
    useState<TimelineItem[]>([
      {
        title: "Clocked In",
        time: "09:00 AM",
        icon: <Play size={14} />,
        color: "#64748b",
      },
    ]);

  const [weeklyStats, setWeeklyStats] =
    useState<WeeklyStat[]>([
      { day: "Mon", hours: 8 },
      { day: "Tue", hours: 7 },
      { day: "Wed", hours: 9 },
      { day: "Thu", hours: 6 },
      { day: "Fri", hours: 8 },
      { day: "Sat", hours: 4 },
      { day: "Sun", hours: 0 },
    ]);

  const [tasksCompleted, setTasksCompleted] =
    useState(12);

  const [productivity, setProductivity] =
    useState(91);

  const [sessionStatus, setSessionStatus] =
    useState(
      initialClock.clockedIn
        ? initialClock.onBreak
          ? "Paused Session"
          : "Active Working Session"
        : "Idle"
    );

  useEffect(() => {
    let interval:
      | ReturnType<typeof setInterval>
      | null = null;

    if (isRunning) {
      const updateSeconds = () => {
        const clock = readWorkClock("On-site");
        setSeconds(getElapsedWorkSeconds(clock.clockInTime));
      };
      updateSeconds();
      interval = setInterval(() => {
        updateSeconds();
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  useEffect(() => {
    const syncClock = () => {
      const clock = readWorkClock("On-site");
      setSeconds(getElapsedWorkSeconds(clock.clockInTime));
      setIsRunning(clock.clockedIn && !clock.onBreak);
      setSessionStatus(
        clock.clockedIn
          ? clock.onBreak
            ? "Paused Session"
            : "Active Working Session"
          : "Idle"
      );
    };

    window.addEventListener(WORK_CLOCK_EVENT, syncClock);
    window.addEventListener("storage", syncClock);
    return () => {
      window.removeEventListener(WORK_CLOCK_EVENT, syncClock);
      window.removeEventListener("storage", syncClock);
    };
  }, []);

  const formatTime = (total: number) => {
    const hrs = String(
      Math.floor(total / 3600)
    ).padStart(2, "0");

    const mins = String(
      Math.floor((total % 3600) / 60)
    ).padStart(2, "0");

    const secs = String(
      total % 60
    ).padStart(2, "0");

    return `${hrs}:${mins}:${secs}`;
  };

  const addTimelineItem = (
    title: string,
    icon: React.ReactNode
  ) => {
    const currentTime =
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

    setTimeline((prev) => [
      {
        title,
        time: currentTime,
        icon,
        color: "#64748b",
      },
      ...prev,
    ]);
  };

  const handleStart = () => {
    const clock = readWorkClock("On-site");
    if (clock.clockedIn) {
      saveWorkBreakState(false);
      setSeconds(getElapsedWorkSeconds(clock.clockInTime));
    } else {
      saveWorkClockIn("On-site");
      setSeconds(0);
    }
    setIsRunning(true);

    setSessionStatus(
      "Active Working Session"
    );

    addTimelineItem(
      "Clocked In",
      <Play size={14} />
    );
  };

  const handlePause = () => {
    saveWorkBreakState(true);
    setIsRunning(false);

    setSessionStatus("Paused Session");

    addTimelineItem(
      "Session Paused",
      <Pause size={14} />
    );
  };

  const handleReset = () => {
    saveWorkClockOut();
    setSeconds(0);

    setIsRunning(false);

    setSessionStatus("Session Reset");

    addTimelineItem(
      "Session Reset",
      <RefreshCcw size={14} />
    );
  };

  const generateAnalytics = () => {
    const randomTasks =
      Math.floor(Math.random() * 20) + 5;

    const randomProductivity =
      Math.floor(Math.random() * 15) + 80;

    setTasksCompleted(randomTasks);

    setProductivity(
      randomProductivity
    );

    setWeeklyStats((prev) =>
      prev.map((day) => ({
        ...day,
        hours:
          Math.floor(Math.random() * 9) +
          1,
      }))
    );

    addTimelineItem(
      "Analytics Generated",
      <Sparkles size={14} />
    );
  };

  const exportReport = () => {
    const report = `
TIMESHEET REPORT

Hours Worked:
${formatTime(seconds)}

Tasks Completed:
${tasksCompleted}

Productivity:
${productivity}%

Session Status:
${sessionStatus}
`;

    const blob = new Blob([report], {
      type: "text/plain",
    });

    const url =
      window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = "timesheet-report.txt";

    a.click();

    addTimelineItem(
      "Report Exported",
      <Download size={14} />
    );
  };

  const overviewStats = [
    {
      title: "Hours Worked",
      value: formatTime(seconds),
      icon: <Clock3 size={16} />,
      bg: "rgba(148,163,184,0.10)",
      color: "#64748b",
    },

    {
      title: "Tasks Completed",
      value: String(tasksCompleted),
      icon: (
        <CheckCircle2 size={16} />
      ),
      bg: "rgba(148,163,184,0.10)",
      color: "#64748b",
    },

    {
      title: "Productivity",
      value: `${productivity}%`,
      icon: <TrendingUp size={16} />,
      bg: "rgba(148,163,184,0.10)",
      color: "#64748b",
    },
  ];

  return (
    <div className={hrPageWrap}>

      {/* ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mb-5">
        <button
          onClick={exportReport}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition"
          style={btnSecondary}
        >
          <Download size={15} />
          Export Report
        </button>

        <button
          onClick={generateAnalytics}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition"
          style={{
            background:
              "rgba(148,163,184,0.14)",
            color:
              "var(--text-primary)",
            border:
              "1px solid rgba(148,163,184,0.18)",
          }}
        >
          <Sparkles size={15} />
          Generate Analytics
        </button>
      </div>

      {/* BREAK ALERT */}
      <div
        className="mb-5 rounded-3xl p-4 flex items-center gap-4"
        style={{
          background:
            "rgba(148,163,184,0.08)",
          border:
            "1px solid rgba(148,163,184,0.12)",
        }}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background:
              "rgba(148,163,184,0.15)",
            color: "#64748b",
          }}
        >
          <Coffee size={20} />
        </div>

        <div>
          <h3
            className="font-semibold text-sm"
            style={textPrimary}
          >
            Break Reminder
          </h3>

          <p
            className="text-xs mt-1 leading-relaxed"
            style={textSecondary}
          >
            You have been working for
            several hours. Consider
            taking a short break.
          </p>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        {/* TIMER */}
        <div
          className="rounded-3xl p-5"
          style={card}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p
                className="text-sm font-medium"
                style={textSecondary}
              >
                Live Work Timer
              </p>

              <h2
                className="text-3xl sm:text-4xl font-bold mt-3 tracking-wide break-all"
                style={textPrimary}
              >
                {formatTime(seconds)}
              </h2>
            </div>

            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center shrink-0"
              style={{
                background:
                  "rgba(148,163,184,0.12)",
                color: "#64748b",
              }}
            >
              <Clock3 size={28} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            {isRunning ? (
              <button
                onClick={handlePause}
                className="flex items-center justify-center gap-1 py-2.5 rounded-2xl font-semibold text-sm transition"
                style={{
                  background:
                    "rgba(148,163,184,0.15)",
                  color:
                    "var(--text-primary)",
                }}
              >
                <Pause size={14} />
                Pause
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="flex items-center justify-center gap-1 py-2.5 rounded-2xl font-semibold text-sm transition"
                style={{
                  background:
                    "rgba(148,163,184,0.15)",
                  color:
                    "var(--text-primary)",
                }}
              >
                <Play size={14} />
                Start
              </button>
            )}

            <ResetButton
              onClick={handleReset}
              className="w-full py-2.5 rounded-2xl"
              style={{
                background: "rgba(148,163,184,0.15)",
                color: "var(--text-primary)",
                border: "none",
              }}
            />
          </div>

          {/* CURRENT SESSION */}
          <div
            className="rounded-2xl p-4"
            style={cardInner}
          >
            <p
              className="text-xs mb-2"
              style={textSecondary}
            >
              Current Session
            </p>

            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isRunning
                    ? "bg-green-500"
                    : "bg-gray-400"
                }`}
              />

              <span
                className="font-semibold text-sm"
                style={textPrimary}
              >
                {sessionStatus}
              </span>
            </div>
          </div>
        </div>

        {/* OVERVIEW */}
        <div
          className="xl:col-span-2 rounded-3xl p-5"
          style={card}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                className="text-xl font-bold"
                style={textPrimary}
              >
                Daily Overview
              </h2>

              <p
                className="mt-1 text-sm"
                style={textSecondary}
              >
                Employee work and
                productivity insights
              </p>
            </div>

            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background:
                  "rgba(148,163,184,0.12)",
                color: "#64748b",
              }}
            >
              <CalendarDays size={20} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {overviewStats.map((stat) => (
              <StatCard
                key={stat.title}
                {...stat}
              />
            ))}
          </div>

          {/* TIMELINE */}
          <div>
            <h3
              className="text-lg font-bold mb-4"
              style={textPrimary}
            >
              Activity Timeline
            </h3>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {timeline.map(
                (item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-2xl p-3 transition"
                    style={cardInner}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shrink-0"
                        style={{
                          background:
                            item.color,
                        }}
                      >
                        {item.icon}
                      </div>

                      <div className="min-w-0">
                        <h4
                          className="font-semibold text-sm truncate"
                          style={
                            textPrimary
                          }
                        >
                          {item.title}
                        </h4>

                        <p
                          className="text-xs truncate"
                          style={
                            textSecondary
                          }
                        >
                          Activity
                          recorded
                          successfully
                        </p>
                      </div>
                    </div>

                    <span
                      className="text-xs font-semibold shrink-0"
                      style={
                        textSecondary
                      }
                    >
                      {item.time}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* WEEKLY PRODUCTIVITY */}
      <div
        className="rounded-3xl p-5"
        style={card}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2
              className="text-xl font-bold"
              style={textPrimary}
            >
              Weekly Productivity
            </h2>

            <p
              className="mt-1 text-sm"
              style={textSecondary}
            >
              Work efficiency across
              the week
            </p>
          </div>

          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background:
                "rgba(148,163,184,0.12)",
              color: "#64748b",
            }}
          >
            <TrendingUp size={22} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {weeklyStats.map(
            (item, index) => (
              <div
                key={index}
                className="rounded-3xl p-4 text-center"
                style={cardInner}
              >
                <p
                  className="text-sm font-medium mb-3"
                  style={
                    textSecondary
                  }
                >
                  {item.day}
                </p>

                <div
                  className="w-14 h-14 mx-auto rounded-2xl flex flex-col items-center justify-center font-bold"
                  style={{
                    background:
                      "rgba(148,163,184,0.12)",
                    color:
                      "var(--text-primary)",
                  }}
                >
                  <span className="text-base">
                    {item.hours}
                  </span>

                  <span className="text-[10px]">
                    hrs
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  bg,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
  color: string;
}) {
  return (
    <div
      className="rounded-3xl p-4"
      style={{ background: bg }}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-sm"
          style={textSecondary}
        >
          {title}
        </p>

        <div style={{ color }}>
          {icon}
        </div>
      </div>

      <h2
        className="text-2xl font-bold break-all"
        style={textPrimary}
      >
        {value}
      </h2>
    </div>
  );
}
