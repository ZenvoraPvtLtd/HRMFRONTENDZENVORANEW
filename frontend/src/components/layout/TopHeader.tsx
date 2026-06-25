import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle2,
  UserCircle,
  CheckSquare,
  FileText,
  FolderKanban,
  MessageCircle,
  Search,
  X,
  Users,
  Calendar,
  CalendarCheck,
  Clock3,
  BarChart3,
  Briefcase,
  Activity,
  BrainCircuit,
  Bot,
  Video,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  Settings,
  TriangleAlert,
  UserX,
} from "lucide-react";
import { type ReactNode, useState, useEffect, useRef } from "react";
import NotificationBell from "./NotificationBell";
import type { NavSection } from "./Sidebar";

interface TopHeaderProps {
  userName: string;
  profilePath: string;
  onSearch?: (query: string) => void;
  navSections?: NavSection[];
}

const routeMeta: { pattern: RegExp; icon: ReactNode; label: string; placeholder: string }[] = [
  // Admin portal
  { pattern: /^\/admindashboard\/users/, icon: <Users size={18} />, label: "Users & Roles", placeholder: "Search users..." },
  { pattern: /^\/admindashboard\/settings/, icon: <Settings size={18} />, label: "System Settings", placeholder: "Search settings..." },
  { pattern: /^\/admindashboard\/logs/, icon: <Activity size={18} />, label: "Audit Logs", placeholder: "Search audit logs..." },
  { pattern: /^\/admindashboard/, icon: <LayoutDashboard size={18} />, label: "Admin Overview", placeholder: "Search overview..." },

  // Employee portal
  { pattern: /^\/dashboard\/sprint-board\/\d+/, icon: <BarChart3 size={18} />, label: "Sprint Board", placeholder: "Search tasks..." },
  { pattern: /^\/dashboard\/sprint-board/, icon: <BarChart3 size={18} />, label: "Sprint Board", placeholder: "Search sprints..." },
  { pattern: /^\/dashboard\/attendance/, icon: <CalendarCheck size={18} />, label: "Attendance", placeholder: "Search attendance..." },
  { pattern: /^\/dashboard\/follow-up/, icon: <ClipboardList size={18} />, label: "Follow Up", placeholder: "Search follow-ups..." },
  { pattern: /^\/dashboard\/leave/, icon: <Clock3 size={18} />, label: "Leave", placeholder: "Search leaves..." },
  { pattern: /^\/dashboard\/performance/, icon: <BarChart3 size={18} />, label: "My Performance", placeholder: "Search reviews..." },
  { pattern: /^\/dashboard\/my-pip/, icon: <TriangleAlert size={18} />, label: "My PIP", placeholder: "Search PIP records..." },
  { pattern: /^\/dashboard\/grievances/, icon: <MessageSquare size={18} />, label: "My Grievances", placeholder: "Search grievances..." },
  { pattern: /^\/dashboard\/timesheet/, icon: <Activity size={18} />, label: "Timesheet", placeholder: "Search timesheet..." },
  { pattern: /^\/dashboard\/my-tasks/, icon: <CheckSquare size={18} />, label: "My Tasks", placeholder: "Search tasks..." },
  { pattern: /^\/dashboard\/organization/, icon: <Users size={18} />, label: "Organization", placeholder: "Search members..." },
  { pattern: /^\/dashboard\/chatbot/, icon: <Bot size={18} />, label: "Employee Chatbot", placeholder: "Search..." },
  { pattern: /^\/dashboard\/chat/, icon: <MessageCircle size={18} />, label: "Chat", placeholder: "Search conversations..." },
  { pattern: /^\/dashboard\/profile/, icon: <UserCircle size={18} />, label: "Profile", placeholder: "Search..." },
  { pattern: /^\/manager\/profile/, icon: <UserCircle size={18} />, label: "Profile", placeholder: "Search..." },
  { pattern: /^\/hr\/profile/, icon: <UserCircle size={18} />, label: "Profile", placeholder: "Search..." },
  { pattern: /^\/dashboard/, icon: <LayoutDashboard size={18} />, label: "Dashboard", placeholder: "Search..." },

  // Candidate portal
  { pattern: /^\/candidatedashboard\/jobs/, icon: <Briefcase size={18} />, label: "Jobs", placeholder: "Search jobs..." },
  { pattern: /^\/candidatedashboard\/interview/, icon: <Video size={18} />, label: "Interviews", placeholder: "Search interviews..." },
  { pattern: /^\/candidatedashboard\/profile/, icon: <UserCircle size={18} />, label: "Profile", placeholder: "Search..." },
  { pattern: /^\/candidatedashboard/, icon: <LayoutDashboard size={18} />, label: "Dashboard", placeholder: "Search..." },

  // HR Management (more specific paths first)
  { pattern: /^\/hr-management\/employees/, icon: <Users size={18} />, label: "Employees", placeholder: "Search employees..." },
  { pattern: /^\/employee-management/, icon: <Users size={18} />, label: "Employee Management", placeholder: "Search employees..." },
  { pattern: /^\/hr-management\/employee-management/, icon: <Users size={18} />, label: "Employee Management", placeholder: "Search employees..." },
  { pattern: /^\/attendance-management/, icon: <CalendarCheck size={18} />, label: "Attendance Management", placeholder: "Search attendance..." },
  { pattern: /^\/hr-management\/attendance-management/, icon: <CalendarCheck size={18} />, label: "Attendance Management", placeholder: "Search attendance..." },
  { pattern: /^\/hr-management\/attendance-management/, icon: <CalendarCheck size={18} />, label: "Attendance Management", placeholder: "Search attendance..." },
  { pattern: /^\/hr-management\/employee-management/, icon: <Users size={18} />, label: "Employee Management", placeholder: "Search employees..." },
  { pattern: /^\/hr-management\/employee-onboarding/, icon: <Users size={18} />, label: "Employee Onboarding", placeholder: "Search onboarding..." },
  { pattern: /^\/hr-management\/holiday-calendar/, icon: <Calendar size={18} />, label: "Holiday Calendar", placeholder: "Search holidays..." },
  { pattern: /^\/hr-management\/leave-balance/, icon: <ClipboardList size={18} />, label: "Leave Balance", placeholder: "Search leave balance..." },
  { pattern: /^\/hr-management\/leave-management/, icon: <Clock3 size={18} />, label: "Leave Management", placeholder: "Search leave requests..." },
  { pattern: /^\/hr-management\/my-assign-task/, icon: <CheckSquare size={18} />, label: "My Assign Task", placeholder: "Search tasks..." },
  { pattern: /^\/hr-management\/performance-improvement-plan/, icon: <BarChart3 size={18} />, label: "Performance Plan", placeholder: "Search PIP records..." },
  { pattern: /^\/hr-management\/recruitment-talent-acquisition/, icon: <Briefcase size={18} />, label: "Recruitment", placeholder: "Search jobs & candidates..." },
  { pattern: /^\/hr-management\/timesheet-approvals/, icon: <ClipboardList size={18} />, label: "Timesheet Approvals", placeholder: "Search timesheets..." },
  { pattern: /^\/hr-management\/timesheet-tracker/, icon: <Clock3 size={18} />, label: "Timesheet Tracker", placeholder: "Search timesheets..." },
  { pattern: /^\/hr-management\/training-development/, icon: <BrainCircuit size={18} />, label: "Training & Development", placeholder: "Search programs..." },
  { pattern: /^\/hr-management\/chat/, icon: <MessageCircle size={18} />, label: "Chat", placeholder: "Search conversations..." },

  { pattern: /^\/hr-management\/attendance-correction/, icon: <CalendarCheck size={18} />, label: "Attendance Correction", placeholder: "Search attendance..." },
  { pattern: /^\/hr-management\/announcements/, icon: <MessageSquare size={18} />, label: "Announcements", placeholder: "Search announcements..." },
  { pattern: /^\/hr-management\/exit-management/, icon: <UserX size={18} />, label: "Exit Management", placeholder: "Search..." },
  { pattern: /^\/hr-management\/performance-improvement-plan/, icon: <TriangleAlert size={18} />, label: "Performance Improvement Plan", placeholder: "Search PIP..." },

  { pattern: /^\/manager\/dashboard/,      icon: <LayoutDashboard size={18} />, label: "Dashboard",       placeholder: "Search..." },

  { pattern: /^\/manager\/sprint-board\//, icon: <BarChart3 size={18} />,       label: "Sprint Board",    placeholder: "Search tasks..." },
  { pattern: /^\/manager\/sprint-board/,   icon: <BarChart3 size={18} />,       label: "Sprint Board",    placeholder: "Search sprints..." },
  { pattern: /^\/manager\/my-tasks/,       icon: <CheckSquare size={18} />,     label: "My Tasks",        placeholder: "Search tasks..." },
  { pattern: /^\/manager\/leave/,          icon: <Clock3 size={18} />,          label: "Leave",           placeholder: "Search leaves..." },
  { pattern: /^\/manager\/timesheet/,      icon: <Activity size={18} />,        label: "Timesheet",       placeholder: "Search timesheet..." },
  { pattern: /^\/manager\/organization/,   icon: <Users size={18} />,           label: "Organization",    placeholder: "Search members..." },
  { pattern: /^\/manager\/chat/,           icon: <MessageCircle size={18} />,   label: "Chat",            placeholder: "Search conversations..." },
  { pattern: /^\/manager\/profile/,        icon: <UserCircle size={18} />,      label: "Profile",         placeholder: "Search..." },
  { pattern: /^\/manager\/attendance/,     icon: <CalendarCheck size={18} />,   label: "Attendance",      placeholder: "Search attendance..." },
  { pattern: /^\/manager\/approvals/,      icon: <ClipboardList size={18} />,   label: "Approvals",       placeholder: "Search approvals..." },
  { pattern: /^\/manager\/productivity/,   icon: <BarChart3 size={18} />,       label: "Productivity",    placeholder: "Search..." },
  { pattern: /^\/manager\/projects\/create/, icon: <Briefcase size={18} />,     label: "Create Project",  placeholder: "Search..." },
  { pattern: /^\/manager\/projects/,       icon: <Briefcase size={18} />,       label: "Projects",        placeholder: "Search projects..." },
  { pattern: /^\/manager\/team-management/, icon: <Users size={18} />,          label: "Team Management", placeholder: "Search teams..." },
  { pattern: /^\/manager\/my-tasks$/,       icon: <CheckSquare size={18} />,     label: "My Tasks",        placeholder: "Search tasks..." },
  { pattern: /^\/manager\b/,              icon: <LayoutDashboard size={18} />,  label: "Dashboard",       placeholder: "Search..." },
  // HR employee-style portal
  { pattern: /^\/sprint-board\/\d+/, icon: <BarChart3 size={18} />, label: "Sprint Board", placeholder: "Search tasks..." },
  { pattern: /^\/sprint-board/, icon: <BarChart3 size={18} />, label: "Sprint Board", placeholder: "Search sprints..." },
  { pattern: /^\/my-tasks/, icon: <CheckSquare size={18} />, label: "My Tasks", placeholder: "Search tasks..." },
  { pattern: /^\/leave(?:$|\/)/, icon: <Clock3 size={18} />, label: "Leave", placeholder: "Search leaves..." },
  { pattern: /^\/my-pip(?:$|\/)/, icon: <TriangleAlert size={18} />, label: "My PIP", placeholder: "Search PIP records..." },
  { pattern: /^\/timesheet(?:$|\/)/, icon: <Activity size={18} />, label: "Timesheet", placeholder: "Search timesheet..." },
  { pattern: /^\/organization(?:$|\/)/, icon: <Users size={18} />, label: "Organization", placeholder: "Search members..." },
  { pattern: /^\/chat$/, icon: <MessageCircle size={18} />, label: "Chat", placeholder: "Search conversations..." },

  // HR Management (more specific paths first)
  { pattern: /^\/vected-ems-dashboard/, icon: <LayoutDashboard size={18} />, label: "EMS Dashboard", placeholder: "Search workforce..." },
  { pattern: /^\/employee-management/, icon: <Users size={18} />, label: "Employee Management", placeholder: "Search employees..." },
  { pattern: /^\/employee-onboarding/, icon: <Users size={18} />, label: "Employee Onboarding", placeholder: "Search onboarding..." },
  { pattern: /^\/holiday-calendar/, icon: <Calendar size={18} />, label: "Holiday Calendar", placeholder: "Search holidays..." },
  { pattern: /^\/announcements/, icon: <MessageSquare size={18} />, label: "Announcements", placeholder: "Search announcements..." },
  { pattern: /^\/leave-balance/, icon: <ClipboardList size={18} />, label: "Leave Balance", placeholder: "Search leave balance..." },
  { pattern: /^\/leave-management/, icon: <Clock3 size={18} />, label: "Leave Management", placeholder: "Search leave requests..." },
  { pattern: /^\/my-assign-task/, icon: <CheckSquare size={18} />, label: "HR Actions", placeholder: "Search actions..." },
  { pattern: /^\/performance$/, icon: <BarChart3 size={18} />, label: "Performance", placeholder: "Search performance..." },
  { pattern: /^\/grievances/, icon: <Activity size={18} />, label: "Grievances", placeholder: "Search grievances..." },
  { pattern: /^\/events/, icon: <Calendar size={18} />, label: "Events", placeholder: "Search events..." },
  { pattern: /^\/documents/, icon: <FileText size={18} />, label: "Documents", placeholder: "Search documents..." },
  { pattern: /^\/compliance/, icon: <ShieldCheck size={18} />, label: "Compliance", placeholder: "Search compliance..." },
  { pattern: /^\/performance-improvement-plan/, icon: <TriangleAlert size={18} />, label: "PIP", placeholder: "Search PIP records..." },
  { pattern: /^\/exit-management/, icon: <UserX size={18} />, label: "Exit Management", placeholder: "Search exit records..." },
  { pattern: /^\/recruitment-talent-acquisition/, icon: <Briefcase size={18} />, label: "Recruitment", placeholder: "Search jobs & candidates..." },
  { pattern: /^\/timesheet-approvals/, icon: <ClipboardList size={18} />, label: "Timesheet Approvals", placeholder: "Search timesheets..." },
  { pattern: /^\/timesheet-tracker/, icon: <Clock3 size={18} />, label: "Timesheet Tracker", placeholder: "Search timesheets..." },
  { pattern: /^\/training-development/, icon: <BrainCircuit size={18} />, label: "Training & Development", placeholder: "Search programs..." },
  { pattern: /^\/manager-tools\/attendance/, icon: <Calendar size={18} />, label: "Manager Attendance", placeholder: "Search attendance..." },
  { pattern: /^\/manager-tools\/approvals/, icon: <CheckCircle2 size={18} />, label: "Manager Approvals", placeholder: "Search approvals..." },
  { pattern: /^\/manager-tools\/productivity/, icon: <BarChart3 size={18} />, label: "Manager Productivity", placeholder: "Search productivity..." },
  { pattern: /^\/manager-tools\/projects(\/|$)/, icon: <FolderKanban size={18} />, label: "Projects", placeholder: "Search projects..." },

  { pattern: /^\/manager-tools\/team-management/, icon: <Users size={18} />, label: "Manager Team Management", placeholder: "Search team..." },
  { pattern: /^\/employees/, icon: <Users size={18} />, label: "Employees", placeholder: "Search employees..." },

  // HR portal — other sections
  { pattern: /^\/analytics/, icon: <Activity size={18} />, label: "Predictive Analytics", placeholder: "Search analytics..." },
  { pattern: /^\/productivity/, icon: <BarChart3 size={18} />, label: "Productivity", placeholder: "Search productivity..." },
  { pattern: /^\/automation/, icon: <Bot size={18} />, label: "Workflow Automation", placeholder: "Search workflows..." },
  { pattern: /^\/whatsapp/, icon: <MessageCircle size={18} />, label: "WhatsApp API", placeholder: "Search..." },
  { pattern: /^\/follow-up/, icon: <MessageSquare size={18} />, label: "Follow Up", placeholder: "Search follow-ups..." },
  { pattern: /^\/createjobs\/create/, icon: <Briefcase size={18} />, label: "Create Job", placeholder: "Search jobs..." },
  { pattern: /^\/createjobs\/active/, icon: <Briefcase size={18} />, label: "Active Jobs", placeholder: "Search active jobs..." },
  { pattern: /^\/createjobs\/closed/, icon: <Briefcase size={18} />, label: "Closed Jobs", placeholder: "Search closed jobs..." },
  { pattern: /^\/createjobs/, icon: <Briefcase size={18} />, label: "Create Jobs", placeholder: "Search jobs..." },
  { pattern: /^\/jobs\/create/, icon: <Briefcase size={18} />, label: "Create Job", placeholder: "Search jobs..." },
  { pattern: /^\/jobs\/active/, icon: <Briefcase size={18} />, label: "Active Jobs", placeholder: "Search active jobs..." },
  { pattern: /^\/jobs\/closed/, icon: <Briefcase size={18} />, label: "Closed Jobs", placeholder: "Search closed jobs..." },
  { pattern: /^\/jobs/, icon: <Briefcase size={18} />, label: "Jobs", placeholder: "Search jobs..." },
  { pattern: /^\/interview\/live/, icon: <Video size={18} />, label: "AI Video Interview", placeholder: "Search interviews..." },
  // Manager portal
  { pattern: /^\/manager\/sprint-board\/\d+/, icon: <BarChart3 size={18} />, label: "Sprint Board", placeholder: "Search tasks..." },
  { pattern: /^\/manager\/sprint-board/, icon: <BarChart3 size={18} />, label: "Sprint Board", placeholder: "Search sprints..." },
  { pattern: /^\/manager\/my-tasks/, icon: <CheckSquare size={18} />, label: "My Tasks", placeholder: "Search tasks..." },
  { pattern: /^\/manager\/leave/, icon: <Clock3 size={18} />, label: "Leave", placeholder: "Search leaves..." },
  { pattern: /^\/manager\/my-pip/, icon: <TriangleAlert size={18} />, label: "My PIP", placeholder: "Search PIP records..." },
  { pattern: /^\/manager\/timesheet/, icon: <Activity size={18} />, label: "Timesheet", placeholder: "Search timesheet..." },
  { pattern: /^\/manager\/organization/, icon: <Users size={18} />, label: "Organization", placeholder: "Search members..." },
  { pattern: /^\/manager\/chat/, icon: <MessageCircle size={18} />, label: "Chat", placeholder: "Search conversations..." },
  { pattern: /^\/manager\/profile/, icon: <UserCircle size={18} />, label: "Profile", placeholder: "Search..." },
  { pattern: /^\/manager\/dashboard/, icon: <LayoutDashboard size={18} />, label: "Manager Dashboard", placeholder: "Search..." },
  { pattern: /^\/manager\/approvals/, icon: <CheckSquare size={18} />, label: "Team Approvals", placeholder: "Search approvals..." },
  { pattern: /^\/manager\/team-management/, icon: <Users size={18} />, label: "Team Management", placeholder: "Search team..." },
  { pattern: /^\/manager\/projects/, icon: <Briefcase size={18} />, label: "Projects", placeholder: "Search projects..." },
  { pattern: /^\/manager\/productivity/, icon: <Activity size={18} />, label: "Productivity", placeholder: "Search..." },
  { pattern: /^\/manager\/attendance/, icon: <CalendarCheck size={18} />, label: "Attendance", placeholder: "Search attendance..." },
  { pattern: /^\/manager/, icon: <LayoutDashboard size={18} />, label: "Manager Dashboard", placeholder: "Search..." },

  { pattern: /^\/team-management\/productivity/, icon: <BarChart3 size={18} />, label: "Team Productivity", placeholder: "Search productivity..." },
  { pattern: /^\/team-management\/announcements/, icon: <MessageSquare size={18} />, label: "Team Announcements", placeholder: "Search announcements..." },
  { pattern: /^\/team-management\/reports/, icon: <FileText size={18} />, label: "Team Reports", placeholder: "Search reports..." },
  { pattern: /\/team-management$/, icon: <Users size={18} />, label: "Team Management", placeholder: "Search teams..." },
  { pattern: /^\/candidates/, icon: <Users size={18} />, label: "Candidates", placeholder: "Search candidates..." },
  { pattern: /^\/interviews/, icon: <Video size={18} />, label: "Interviews", placeholder: "Search interviews..." },
  { pattern: /^\/results/, icon: <BarChart3 size={18} />, label: "Results Review", placeholder: "Search results..." },
  { pattern: /^\/risk/, icon: <ShieldAlert size={18} />, label: "Risk Analysis", placeholder: "Search risk..." },
  { pattern: /^\/chatbot/, icon: <Bot size={18} />, label: "HR Chatbot", placeholder: "Search..." },
  { pattern: /^\/profile/, icon: <UserCircle size={18} />, label: "Profile", placeholder: "Search..." },
];

// Global search event — pages listen to this
export const SEARCH_EVENT = "topheader-search";

export default function TopHeader({ userName, profilePath, onSearch, navSections }: TopHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const avatarLetter = userName.charAt(0).toUpperCase();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Match from sidebar navSections — children first (more specific), then parents
  let activeNavMeta: { icon: ReactNode; label: string } | null = null;
  if (navSections) {
    // Pass 1: look for exact child match across all sections
    outer:
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.children) {
          for (const child of item.children) {
            if (
              location.pathname === child.to ||
              location.pathname.startsWith(`${child.to}/`)
            ) {
              activeNavMeta = { icon: child.icon, label: child.label };
              break outer;
            }
          }
        }
        // Also check if location matches any children directly (for cases like /dashboard/my-tasks under /dashboard/sprint-board)
        if (item.children && !activeNavMeta) {
          const activeChild = item.children.find(
            (c) => location.pathname === c.to || location.pathname.startsWith(`${c.to}/`)
          );
          if (activeChild) {
            activeNavMeta = { icon: activeChild.icon, label: activeChild.label };
            break;
          }
        }
      }
    }

    // Pass 2: if no child matched, look for parent match
    if (!activeNavMeta) {
      outer2:
      for (const section of navSections) {
        for (const item of section.items) {
          const match = item.exact
            ? location.pathname === item.to
            : location.pathname === item.to ||
              location.pathname.startsWith(`${item.to}/`);
          if (match) {
            activeNavMeta = { icon: item.icon, label: item.label };
            break outer2;
          }
        }
      }
    }
  }

  // Fall back to hardcoded routeMeta
  const meta = activeNavMeta ?? (routeMeta.find((r) => r.pattern.test(location.pathname)) ?? {
    icon: <LayoutDashboard size={18} />,
    label: "Dashboard",
    placeholder: "Search...",
  });
  const placeholder = activeNavMeta
    ? `Search ${activeNavMeta.label.toLowerCase()}...`
    : (routeMeta.find((r) => r.pattern.test(location.pathname))?.placeholder ?? "Search...");

  // Reset query on route change only
  useEffect(() => {
    setQuery("");
    window.dispatchEvent(new CustomEvent(SEARCH_EVENT, { detail: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (query !== "") {
      const id = window.setTimeout(() => setQuery(""), 0);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);


  function handleChange(val: string) {
    setQuery(val);
    onSearch?.(val);
    window.dispatchEvent(new CustomEvent(SEARCH_EVENT, { detail: val }));
  }

  function handleClear() {
    setQuery("");
    onSearch?.("");
    window.dispatchEvent(new CustomEvent(SEARCH_EVENT, { detail: "" }));
    inputRef.current?.focus();
  }

  return (
    <div
      className="top-header"
    >
      <div className="top-header-left">
        <div
          className="top-header-icon"
          style={{
            background: "var(--icon-accent-bg)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        >
          {meta.icon}
        </div>
        <span className="top-header-title" style={{ color: "var(--text-primary)" }}>
          {meta.label}
        </span>
      </div>

      {/* Center: search bar */}
      <div
        className="top-header-search"
        style={{
          position: "relative",
        }}
      >
        <Search
          size={15}
          style={{
            position: "absolute",
            left: "0.75rem",
            color: "var(--text-secondary)",
            pointerEvents: "none",
            flexShrink: 0,
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            height: 38,
            paddingLeft: "2.25rem",
            paddingRight: query ? "2.25rem" : "0.875rem",
            borderRadius: "0.625rem",
            border: "1px solid var(--border)",
            background: "var(--icon-accent-bg)",
            color: "var(--text-primary)",
            fontSize: "0.85rem",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
        {query && (
          <button
            onClick={handleClear}
            style={{
              position: "absolute",
              right: "0.625rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              color: "var(--text-secondary)",
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Right: clocked in + bell + avatar */}
      <div className="top-header-actions">
        {/* Notification Bell */}
        <NotificationBell />

        {/* Welcome + Profile avatar */}
        <button
          onClick={() => navigate(profilePath)}
          title={`${userName} — View profile`}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <div className="top-header-profile-text" style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", lineHeight: 1.2 }}>Welcome back</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>{userName}</div>
          </div>
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: "0.9rem",
              background: "var(--icon-accent-bg)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              flexShrink: 0,
            }}
          >
            {avatarLetter}
          </div>
        </button>
      </div>
    </div>
  );
}
