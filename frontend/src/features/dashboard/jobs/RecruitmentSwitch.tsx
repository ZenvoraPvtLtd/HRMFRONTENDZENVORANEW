import { BarChart3, Briefcase, ShieldAlert, Users, Video } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const recruitmentPages = [
  { label: "Create Jobs", path: "/createjobs", icon: <Briefcase size={15} /> },
  { label: "Candidates", path: "/candidates", icon: <Users size={15} /> },
  { label: "Interviews", path: "/interviews", icon: <Video size={15} /> },
  { label: "Results Review", path: "/results", icon: <BarChart3 size={15} /> },
  { label: "Risk Analysis", path: "/risk", icon: <ShieldAlert size={15} /> },
];

export default function RecruitmentSwitch() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="mb-5 flex flex-wrap justify-end gap-2">
      {recruitmentPages.map((page) => {
        const isActive =
          page.path === "/createjobs"
            ? location.pathname.startsWith("/createjobs") || location.pathname.startsWith("/jobs")
            : location.pathname.startsWith(page.path);

        return (
          <button
            key={page.path}
            type="button"
            onClick={() => navigate(page.path)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-90"
            style={{
              background: isActive ? "var(--accent)" : "transparent",
              color: isActive ? "var(--accent-text)" : "var(--text-primary)",
              border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {page.icon}
            {page.label}
          </button>
        );
      })}
    </div>
  );
}
