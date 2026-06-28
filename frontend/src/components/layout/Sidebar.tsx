/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock3,
  ClipboardList,
  FileSearch,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MessageSquare,
  MessageCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sun,
  TriangleAlert,
  UserCircle,
  UserCheck,
  UserX,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { clearAuthStorage } from "../../utils/auth";
import { useTheme } from "../../context/ThemeContext";

export type NavItem = {
  to: string;
  icon: ReactNode;
  label: string;
  exact?: boolean;
  children?: { to: string; icon: ReactNode; label: string }[];
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

// ---------------------------------------------------------------------------
// HR nav sections
// ---------------------------------------------------------------------------
export const hrNavSections: NavSection[] = [
  {
    label: "",
    items: [
      { to: "/", icon: <LayoutDashboard size={18} />, label: "Dashboard", exact: true },
      {
        to: "/sprint-board",
        icon: <BarChart3 size={18} />,
        label: "Sprint Board",
        children: [
          { to: "/sprint-board", icon: <LayoutGrid size={15} />, label: "Boards" },
          { to: "/my-tasks", icon: <CheckSquare size={15} />, label: "" },
        ],
      },
      { to: "/leave", icon: <Clock3 size={18} />, label: "Leave" },
      { to: "/timesheet", icon: <Activity size={18} />, label: "Timesheet" },
      { to: "/organization", icon: <Users size={18} />, label: "Organization" },
      {
        to: "/hr-management",
        icon: <ClipboardList size={18} />,
        label: "HR Management",
        children: [
          { to: "/hr-management/employees", icon: <Users size={15} />, label: "Employees" },
          { to: "/hr-management/employee-management", icon: <Users size={15} />, label: "Employee Management" },
          { to: "/hr-management/employee-onboarding", icon: <Users size={15} />, label: "Onboarding" },
          { to: "/hr-management/holiday-calendar", icon: <Calendar size={15} />, label: "Holiday Calendar" },
          { to: "/hr-management/leave-balance", icon: <Calendar size={15} />, label: "Leave Balances" },
          { to: "/hr-management/leave-management", icon: <Calendar size={15} />, label: "Leave Management" },
          { to: "/hr-management/my-assign-task", icon: <ClipboardList size={15} />, label: "HR Actions" },
          { to: "/hr-management/timesheet-approvals", icon: <Clock3 size={15} />, label: "Timesheet Approvals" },
          { to: "/hr-management/timesheet-tracker", icon: <Clock3 size={15} />, label: "Timesheet Tracker" },
          { to: "/attendance-management", icon: <Calendar size={15} />, label: "Attendance Management" },
          { to: "/hr-management/performance-improvement-plan", icon: <TriangleAlert size={15} />, label: "PIP" },
          { to: "/performance", icon: <BarChart3 size={15} />, label: "Performance" },
          { to: "/grievances", icon: <Activity size={15} />, label: "Grievances" },
          { to: "/hr-management/recruitment-talent-acquisition", icon: <Briefcase size={15} />, label: "Recruitment" },
          { to: "/hr-management/candidates", icon: <Users size={15} />, label: "Candidates" },
          { to: "/hr-management/candidate-screening", icon: <UserCheck size={15} />, label: "Candidate Screening" },
          { to: "/interview-modules", icon: <Video size={15} />, label: "Interview Modules" },
          { to: "/ai-video-interview", icon: <Video size={15} />, label: "AI Video Interview" },
          { to: "/whatsapp", icon: <MessageSquare size={15} />, label: "WhatsApp" },
          { to: "/ai-predictivity", icon: <BarChart3 size={15} />, label: "AI Predictivity" },
          { to: "/ai-analytics", icon: <BarChart3 size={15} />, label: "AI Analytics" },
          { to: "/hr-management/announcements", icon: <MessageSquare size={15} />, label: "Announcements" },
          { to: "/hr-management/events", icon: <Calendar size={15} />, label: "Events" },
          { to: "/hr-management/documents", icon: <FileText size={15} />, label: "Documents" },
          { to: "/hr-management/compliance", icon: <ShieldCheck size={15} />, label: "Compliance" },
          { to: "/hr-management/exit-management", icon: <UserX size={15} />, label: "Exit Management" },
          // Module 07 — Resume Screening
          { to: "/resume-screening", icon: <FileSearch size={15} />, label: "Resume Screening" },
          { to: "/interview-dashboard", icon: <Video size={15} />, label: "Interview Dashboard" },
          { to: "/resume-result", icon: <FileSearch size={15} />, label: "Resume Result" },
          // Salary, Offers & Reports
          { to: "/salary-slips", icon: <Briefcase size={15} />, label: "Salary Slips" },
          { to: "/offer-letters", icon: <FileText size={15} />, label: "Offer Letters" },
          { to: "/shortlist-report", icon: <ClipboardList size={15} />, label: "Shortlist Report" },
          ],
      },
      {
        to: "/manager-tools",
        icon: <Users size={18} />,
        label: "Manager Tools",
        children: [
          { to: "/manager-tools/attendance", icon: <Calendar size={15} />, label: "Attendance" },
          { to: "/manager-tools/approvals", icon: <CheckCircle2 size={15} />, label: "Approvals" },
          { to: "/manager-tools/productivity", icon: <BarChart3 size={15} />, label: "Productivity" },
          { to: "/manager-tools/projects", icon: <FolderKanban size={15} />, label: "Projects" },
          { to: "/manager-tools/team-management", icon: <Users size={15} />, label: "Team Management" },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Candidate nav sections
// ---------------------------------------------------------------------------
export const candidateNavSections: NavSection[] = [
  {
    label: "",
    items: [
      { to: "/candidatedashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard", exact: true },
      { to: "/candidatedashboard/jobs", icon: <Briefcase size={18} />, label: "Jobs" },
      { to: "/candidatedashboard/interview/live", icon: <Video size={15} />, label: "Interviews" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Employee nav sections
// ---------------------------------------------------------------------------
export const employeeNavSections: NavSection[] = [
  {
    label: "",
    items: [
      { to: "/dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard", exact: true },
      {
        to: "/dashboard/sprint-board",
        icon: <BarChart3 size={18} />,
        label: "Sprint Board",
        children: [
          { to: "/dashboard/sprint-board", icon: <LayoutGrid size={15} />, label: "Boards" },
          { to: "/dashboard/my-tasks", icon: <CheckSquare size={15} />, label: "Tasks" },
        ],
      },
    ],
  },
  {
    label: "WORK",
    items: [
      { to: "/dashboard/leave", icon: <Clock3 size={18} />, label: "Leave" },
      { to: "/dashboard/performance", icon: <BarChart3 size={18} />, label: "My Performance" },
      { to: "/dashboard/my-pip", icon: <TriangleAlert size={18} />, label: "My PIP" },
      { to: "/dashboard/grievances", icon: <MessageSquare size={18} />, label: "My Grievances" },
      { to: "/dashboard/timesheet", icon: <Activity size={18} />, label: "Timesheet" },
      { to: "/dashboard/organization", icon: <Users size={18} />, label: "Organization" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Manager nav sections
// ---------------------------------------------------------------------------
export const managerNavSections: NavSection[] = [
  {
    label: "",
    items: [
      { to: "/manager/dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard", exact: true },
      {
        to: "/manager/sprint-board",
        icon: <Zap size={18} />,
        label: "Sprint Board",
        children: [
          { to: "/manager/sprint-board", icon: <LayoutGrid size={15} />, label: "Boards" },
          { to: "/manager/my-tasks", icon: <CheckSquare size={15} />, label: "Tasks" },
        ],
      },
      { to: "/manager/leave", icon: <Clock3 size={18} />, label: "Leave" },
      { to: "/manager/timesheet", icon: <Activity size={18} />, label: "Timesheet" },
      { to: "/manager/organization", icon: <Users size={18} />, label: "Organization" },
      {
        to: "/manager/tools",
        icon: <Users size={18} />,
        label: "Manager Tools",
        children: [
          { to: "/manager/attendance", icon: <Calendar size={15} />, label: "Attendance" },
          { to: "/manager/approvals", icon: <CheckCircle2 size={15} />, label: "Approvals" },
          { to: "/manager/productivity", icon: <BarChart3 size={15} />, label: "Productivity" },
          { to: "/manager/projects", icon: <FolderKanban size={15} />, label: "Projects" },
          { to: "/manager/team-management", icon: <Users size={15} />, label: "Team Management" },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Admin nav sections
// ---------------------------------------------------------------------------
export const adminNavSections: NavSection[] = [
  {
    label: "",
    items: [
      { to: "/admin", icon: <LayoutDashboard size={18} />, label: "Dashboard", exact: true },
      {
        to: "/admin/sprint-board",
        icon: <BarChart3 size={18} />,
        label: "Sprint Board",
        children: [
          { to: "/admin/sprint-board", icon: <LayoutGrid size={15} />, label: "Sprint Boards" },
          { to: "/admin/my-tasks", icon: <CheckSquare size={15} />, label: "My Tasks" },
        ],
      },
     // { to: "/admin/leave", icon: <Clock3 size={18} />, label: "Leave" },
      {
        to: "/admin/users",
        icon: <ShieldCheck size={18} />,
        label: "Admin",
        children: [
          { to: "/admin/users", icon: <Users size={15} />, label: "Users & Roles" },
        ],
      },
      {
        to: "/admin/employees",
        icon: <ClipboardList size={18} />,
        label: "HR Management",
        children: [
          { to: "/admin/employees", icon: <Users size={15} />, label: "Employees" },
          { to: "/admin/employee-management", icon: <Users size={15} />, label: "HR Employees" },
          { to: "/admin/leave-balance", icon: <Calendar size={15} />, label: "Leave Balances" },
          { to: "/admin/leave-management", icon: <Calendar size={15} />, label: "Leave Management" },
          { to: "/admin/holiday-calendar", icon: <Calendar size={15} />, label: "Holiday Calendar" },
          { to: "/admin/attendance-management", icon: <Calendar size={15} />, label: "Attendance" },
          { to: "/admin/timesheet-approvals", icon: <Clock3 size={15} />, label: "Timesheet Approvals" },
          { to: "/admin/announcements", icon: <MessageSquare size={15} />, label: "Announcements" },
          { to: "/admin/recruitment-talent-acquisition", icon: <Briefcase size={15} />, label: "Recruitment" },
          { to: "/admin/employee-onboarding", icon: <Users size={15} />, label: "Onboarding" },
          { to: "/admin/performance", icon: <BarChart3 size={15} />, label: "Performance" },
          { to: "/admin/grievances", icon: <Activity size={15} />, label: "Grievances" },
          { to: "/admin/documents", icon: <FileText size={15} />, label: "Documents" },
          { to: "/admin/performance-improvement-plan", icon: <TriangleAlert size={15} />, label: "PIP" },
          { to: "/admin/exit-management", icon: <UserX size={15} />, label: "Exit Management" },
          { to: "/admin/interview-modules", icon: <Video size={15} />, label: "Interview Modules" },
          { to: "/admin/ai-video-interview", icon: <Video size={15} />, label: "AI Video Interview" },
          { to: "/admin/whatsapp", icon: <MessageSquare size={15} />, label: "WhatsApp" },
          { to: "/admin/ai-predictivity", icon: <BarChart3 size={15} />, label: "AI Predictivity" },
          { to: "/admin/ai-analytics", icon: <BarChart3 size={15} />, label: "AI Analytics" },
          { to: "/admin/candidates", icon: <Users size={15} />, label: "Candidates" },
          { to: "/admin/candidate-screening", icon: <UserCheck size={15} />, label: "Candidate Screening" },
          // Module 07 — Resume Screening
          { to: "/admin/resume-screening", icon: <FileSearch size={15} />, label: "Resume Screening" },
          { to: "/admin/interview-dashboard", icon: <Video size={15} />, label: "Interview Dashboard" },
          { to: "/admin/resume-result", icon: <FileSearch size={15} />, label: "Resume Result" },
          // Salary, Offers & Reports
          { to: "/admin/salary-slips", icon: <Briefcase size={15} />, label: "Salary Slips" },
          { to: "/admin/offer-letters", icon: <FileText size={15} />, label: "Offer Letters" },
          { to: "/admin/shortlist-report", icon: <ClipboardList size={15} />, label: "Shortlist Report" },
        ],
      },
      {
        to: "/admin/attendance",
        icon: <Briefcase size={18} />,
        label: "Manager Tools",
        children: [
          { to: "/admin/attendance", icon: <Calendar size={15} />, label: "Attendance" },
          { to: "/admin/approvals", icon: <CheckCircle2 size={15} />, label: "Approvals" },
          { to: "/admin/productivity", icon: <BarChart3 size={15} />, label: "Productivity" },
          { to: "/admin/team-management", icon: <Users size={15} />, label: "Team Management" },
          { to: "/admin/projects", icon: <FolderKanban size={15} />, label: "Projects" },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------
interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  userName?: string;
  userEmail?: string;
  managerName?: string;
  isLoggedIn?: boolean;
  onNavClick?: () => void;
  navSections: NavSection[];
  profilePath: string;
}

const Sidebar = ({
  isCollapsed,
  setIsCollapsed,
  managerName,
  onNavClick,
  navSections,
  profilePath,
}: SidebarProps) => {
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    "/sprint-board": true,
    "/dashboard/sprint-board": true,
    "/hr-management": true,
    "/manager-tools": true,
    "/manager/sprint-board": true,
    "/manager/tools": true,
    "/admin/sprint-board": false,
    "/admin/employees": false,
    "/admin/attendance": true,
    "/admin/users": false,
  });

  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearAuthStorage();
    navigate("/login");
  };

  const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: isCollapsed ? "center" : "flex-start",
    gap: isCollapsed ? "0" : "0.625rem",
    padding: isCollapsed ? "0.75rem 0.5rem" : "0.65rem 0.75rem",
    borderRadius: "0.5rem",
    marginBottom: "0.25rem",
    textDecoration: "none",
    fontSize: "0.9375rem",
    fontWeight: isActive ? 700 : 600,
    color: "var(--text-primary)" as string,
    background: isActive ? "var(--bg-hover)" : "transparent",
    transition: "all 0.15s ease",
  });

  return (
    <aside
      style={{
        width: "100%",
        height: "100%",
        background: "var(--bg-secondary)",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        onMouseEnter={() => setIsLogoHovered(true)}
        onMouseLeave={() => setIsLogoHovered(false)}
        style={{
          height: "72px",
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          padding: isCollapsed ? "0" : "0 1.25rem",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {!isCollapsed ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <img
              src="/zenvora-logo.jpeg"
              alt="Zenvora Logo"
              style={{ width: "2rem", height: "2rem", borderRadius: "0.5rem", objectFit: "cover" }}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                letterSpacing: "0.08em",
                color: "var(--text-primary)",
              }}
            >
              ZENVORA
            </span>
          </div>
        ) : isLogoHovered ? (
          <button
            onClick={() => setIsCollapsed(false)}
            style={{
              background: "var(--text-primary)",
              border: "none",
              color: "var(--bg-secondary)",
              cursor: "pointer",
              display: "flex",
              padding: "0.5rem",
              borderRadius: "0.5rem",
            }}
          >
            <PanelLeftOpen size={20} />
          </button>
        ) : (
          <img
            src="/zenvora-logo.jpeg"
            alt="Zenvora"
            style={{ width: "2rem", height: "2rem", borderRadius: "0.5rem", objectFit: "cover" }}
          />
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "1rem 0.75rem" }}>
        {navSections.map((section, idx) => (
          <div key={section.label || idx} style={{ marginBottom: "1rem" }}>
            {!isCollapsed && section.label ? (
              <p
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "var(--text-secondary)",
                  padding: "0 0.5rem",
                  marginBottom: "0.5rem",
                  opacity: 0.7,
                }}
              >
                {section.label}
              </p>
            ) : section.label && isCollapsed ? (
              <div
                style={{
                  height: "1px",
                  background: "var(--border)",
                  margin: "0.75rem 0.25rem",
                  opacity: 0.5,
                }}
              />
            ) : null}

            {section.items.map((item) => {
              const hasChildren = Boolean(item.children?.length);
              const isExpanded = expandedItems[item.to];
              const isParentActive = item.exact
                ? location.pathname === item.to
                : location.pathname === item.to ||
                  location.pathname.startsWith(`${item.to}/`);

              return (
                <div key={item.to}>
                  {hasChildren ? (
                    <button
                      onClick={() => {
                        setExpandedItems((prev) => ({
                          ...prev,
                          [item.to]: !prev[item.to],
                        }));
                        if (
                          !isExpanded &&
                          item.to !== "/employees" &&
                          item.to !== "/hr-management" &&
                          item.to !== "/admin/attendance" &&
                          item.to !== "/admin/employees"
                        ) {
                          navigate(item.to);
                        }
                      }}
                      title={isCollapsed ? item.label : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: isCollapsed ? "center" : "flex-start",
                        gap: isCollapsed ? "0" : "0.625rem",
                        padding: isCollapsed ? "0.75rem 0.5rem" : "0.65rem 0.75rem",
                        borderRadius: "0.5rem",
                        marginBottom: "0.25rem",
                        fontSize: "0.9375rem",
                        fontWeight: isParentActive ? 700 : 600,
                        color: "var(--text-primary)",
                        background: isParentActive ? "var(--bg-hover)" : "transparent",
                        width: "100%",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>
                      {!isCollapsed && (
                        <>
                          <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </>
                      )}
                    </button>
                  ) : (
                    <NavLink
                      to={item.to}
                      end={item.exact}
                      onClick={onNavClick}
                      style={navLinkStyle}
                      title={isCollapsed ? item.label : undefined}
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            style={{
                              color: isActive ? "var(--accent)" : "var(--text-primary)",
                              flexShrink: 0,
                              display: "flex",
                            }}
                          >
                            {item.icon}
                          </span>
                          {!isCollapsed && <span>{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  )}

                  {/* Sub-items */}
                  {hasChildren && isExpanded && !isCollapsed && (
                    <div style={{ paddingLeft: "1.75rem", marginBottom: "0.25rem" }}>
                      {item.children!.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end
                          onClick={onNavClick}
                          style={({ isActive }) => ({
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.45rem 0.75rem",
                            borderRadius: "0.5rem",
                            marginBottom: "0.2rem",
                            textDecoration: "none",
                            fontSize: "0.875rem",
                            fontWeight: isActive ? 700 : 500,
                            color: "var(--text-primary)",
                            background: isActive ? "var(--bg-hover)" : "transparent",
                            transition: "all 0.15s ease",
                          })}
                        >
                          {({ isActive }) => (
                            <>
                              <span
                                style={{
                                  color: isActive ? "var(--accent)" : "var(--text-primary)",
                                  display: "flex",
                                }}
                              >
                                {child.icon}
                              </span>
                              <span>{child.label}</span>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: Dark mode + Profile + Collapse + Logout */}
      <div
        style={{
          padding: isCollapsed ? "1rem 0.75rem" : "1rem 0.75rem 2rem 0.75rem",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {!isCollapsed && managerName && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              marginBottom: "0.5rem",
              borderRadius: "0.5rem",
              background: "var(--bg-hover)",
            }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "var(--text-secondary)",
                marginBottom: "0.2rem",
              }}
            >
              MANAGER
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {managerName}
            </div>
          </div>
        )}

        {/* Dark / Light toggle */}
        <button
          onClick={toggle}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: isCollapsed ? "0" : "0.625rem",
            padding: isCollapsed ? "0.75rem 0.5rem" : "0.625rem 0.75rem",
            borderRadius: "0.5rem",
            width: "100%",
            background: "transparent",
            border: "none",
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            cursor: "pointer",
            marginBottom: "0.25rem",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <span style={{ display: "flex" }}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </span>
          {!isCollapsed && <span>{isDark ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        {/* Profile */}
        <NavLink to={profilePath} onClick={onNavClick} style={navLinkStyle}>
          {() => (
            <>
              <span style={{ color: "var(--text-primary)", display: "flex" }}>
                <UserCircle size={18} />
              </span>
              {!isCollapsed && <span>Profile</span>}
            </>
          )}
        </NavLink>

        {/* Collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand menu" : "Collapse menu"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: "0.625rem",
            padding: "0.625rem 0.75rem",
            borderRadius: "0.5rem",
            width: "100%",
            background: "transparent",
            border: "none",
            fontSize: "0.9375rem",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!isCollapsed && <span>Collapse menu</span>}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={isCollapsed ? "Logout" : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: isCollapsed ? "0" : "0.625rem",
            padding: isCollapsed ? "0.75rem 0.5rem" : "0.625rem 0.75rem",
            borderRadius: "0.5rem",
            width: "100%",
            background: "transparent",
            border: "none",
            fontSize: "0.9375rem",
            color: "#ef4444",
            cursor: "pointer",
            marginTop: "0.25rem",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <LogOut size={18} />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
