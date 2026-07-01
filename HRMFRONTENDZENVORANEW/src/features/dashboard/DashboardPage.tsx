import {
  FileX,
  Calendar,
  UserPlus,
  BarChart3,
  Bot,
} from "lucide-react";

import { useTheme } from "../../context/ThemeContext";
import { useEffect, useMemo, useState } from "react";
import {
  MetricCard,
  ApplicationsDonut,
  UpcomingInterviews,
  RecentActivity,
  RecruitmentProgressTable,
} from "../../components/hrDashboard";

import type {
  MetricCardProps,
  DonutSegment,
  InterviewItem,
  ActivityItem,
  RecruitmentRow,
} from "../../components/hrDashboard";

import { useNavigate } from "react-router-dom";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";

/* ─── Static Data ─────────────────────────────────────────── */

const metrics: MetricCardProps[] = [
  { label: "Total Candidates", value: "352", change: "+15%", positive: true },
  {
    label: "Interviews Scheduled",
    value: "22",
    change: "-10%",
    positive: false,
  },
  { label: "New Hires", value: "32", change: "+12%", positive: true },
  { label: "Acceptance Rate", value: "82%", change: "-11%", positive: false },
];

const donutData: DonutSegment[] = [
  { label: "Applications", value: 258, percent: "50.9%", color: "#a855f7" },
  { label: "Shortlisted", value: 124, percent: "24.5%", color: "#10b981" },
  { label: "On-hold", value: 45, percent: "8.9%", color: "#f59e0b" },
  { label: "Rejected", value: 80, percent: "15.7%", color: "#3b82f6" },
];

const interviews: InterviewItem[] = [
  {
    name: "Arjun Mehta",
    role: "Frontend Developer",
    date: "15 May, 2026",
    time: "10:00 AM",
  },
  {
    name: "Priya Singh",
    role: "HR Executive",
    date: "15 May, 2026",
    time: "02:00 PM",
  },
  {
    name: "Rahul Verma",
    role: "Backend Developer",
    date: "17 May, 2026",
    time: "11:00 AM",
  },
  {
    name: "Sneha Kapoor",
    role: "UI/UX Designer",
    date: "17 May, 2026",
    time: "03:30 PM",
  },
];

const activities: ActivityItem[] = [
  {
    icon: <UserPlus size={16} />,
    text: "Aman Sharma was hired",
    time: "2m",
    color: "#10b981",
  },
  {
    icon: <Calendar size={16} />,
    text: "Interview with Priya Singh",
    time: "10m",
    color: "#a855f7",
  },
  {
    icon: <BarChart3 size={16} />,
    text: "Rahul moved to Technical",
    time: "20m",
    color: "#f59e0b",
  },
  {
    icon: <FileX size={16} />,
    text: "Mohit Patel was rejected",
    time: "30m",
    color: "#ef4444",
  },
];

const recruitmentRows = (isDark: boolean): RecruitmentRow[] => [
  {
    name: "Dan Sibley",
    dept: "DevOps",
    type: "Tech interview",
    status: "Pending",
    color: "#f59e0b",
  },
  {
    name: "Joe Root",
    dept: "UX/UI Designer",
    type: "Resume review",
    status: "In Progress",
    color: isDark ? "#7c3aed" : "#4f46e5",
  },
  {
    name: "Zak Crawley",
    dept: ".Net developer",
    type: "Final interview",
    status: "Completed",
    color: "#10b981",
  },
];

/* Dashboard Page */

export default function Dashboard() {
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();
  const normalizedQuery = searchQuery.trim().toLowerCase();

  useEffect(() => {
    const handleSearch = (event: Event) => {
      setSearchQuery((event as CustomEvent<string>).detail || "");
    };

    window.addEventListener(SEARCH_EVENT, handleSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleSearch);
  }, []);

  const filteredMetrics = useMemo(() => {
    if (!normalizedQuery) return metrics;
    return metrics.filter((item) =>
      [item.label, item.value, item.change].some((value) =>
        String(value).toLowerCase().includes(normalizedQuery)
      )
    );
  }, [normalizedQuery]);

  const filteredInterviews = useMemo(() => {
    if (!normalizedQuery) return interviews;
    return interviews.filter((item) =>
      [item.name, item.role, item.date, item.time].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [normalizedQuery]);

  const filteredActivities = useMemo(() => {
    if (!normalizedQuery) return activities;
    return activities.filter((item) =>
      [item.text, item.time].some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [normalizedQuery]);

  const filteredRecruitmentRows = useMemo(() => {
    const rows = recruitmentRows(isDark);
    if (!normalizedQuery) return rows;
    return rows.filter((item) =>
      [item.name, item.dept, item.type, item.status].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [isDark, normalizedQuery]);

  const hasSearchResults =
    !normalizedQuery ||
    filteredMetrics.length > 0 ||
    filteredInterviews.length > 0 ||
    filteredActivities.length > 0 ||
    filteredRecruitmentRows.length > 0;

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto pt-3 sm:pt-4 pb-4 sm:pb-6">
      {/* Hero Banner */}
      <div
        className="relative overflow-hidden rounded-2xl border mb-4 sm:mb-8 p-4 sm:p-6"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div
          className="absolute top-0 left-0 w-56 h-56 pointer-events-none"
          style={{ background: "var(--icon-accent-bg)", filter: "blur(100px)" }}
          title="Dashboard"
        />

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-8">
          {filteredMetrics.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </div>
        {normalizedQuery && filteredMetrics.length === 0 && (
          <div className="mb-4 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            No metric cards found for "{searchQuery}".
          </div>
        )}

        {/* Middle Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 mb-3 sm:mb-6">
          <ApplicationsDonut total={507} data={donutData} />
          <UpcomingInterviews interviews={filteredInterviews} />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
          <RecentActivity activities={filteredActivities} />
          <RecruitmentProgressTable rows={filteredRecruitmentRows} />
        </div>

        {!hasSearchResults && (
          <div className="mt-4 rounded-xl border p-5 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            No dashboard results found for "{searchQuery}".
          </div>
        )}
      </div>
      <button
        onClick={() => navigate("/chatbot")}
        title="Open AI Chatbot"
        className="fixed bottom-6 right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 z-50 cursor-pointer"
        style={{
          background: "var(--accent)",
          color: "var(--accent-text)",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
          border: "none",
        }}
      >
        <Bot
          className="w-5 h-5 sm:w-6 sm:h-6"
          style={{ color: "var(--accent-text)" }}
        />
      </button>
    </div>
  );
}
