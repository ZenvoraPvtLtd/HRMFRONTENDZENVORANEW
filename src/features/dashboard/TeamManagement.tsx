import { ChevronDown, ChevronUp, ExternalLink, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import RefreshButton from "../../components/button/RefreshButton";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import api from "../../utils/axiosInstance";
import {
  btnSecondary,
  card,
  getStatusStyle,
  hrPageWrap,
  textPrimary,
  textSecondary,
} from "../HRdashboard/hrTheme";

type UserSummary = {
  _id: string;
  name: string;
  email: string;
  role: string;
  employeeId?: string;
  contact?: string;
  projects?: string[];
  skills?: string[];
  shift?: string;
};

type ProjectData = {
  id: string;
  name: string;
  type: string;
  status: string;
};

type TeamData = {
  _id: string;
  name: string;
  department: string;
  leader: UserSummary;
  members: UserSummary[];
  projects: ProjectData[];
};

const avatarColors = ["#2563eb", "#ef4444", "#f97316", "#16a34a", "#7c3aed", "#0891b2"];

const demoTeams: TeamData[] = [
  {
    _id: "demo-team-1",
    name: "ScaleCapacity",
    department: "Product Engineering",
    leader: {
      _id: "leader-1",
      name: "Ankit Singh",
      email: "ankit@zenvora.com",
      role: "Manager",
    },
    members: [
      {
        _id: "member-1",
        name: "Rishabh Pathak",
        email: "rishabh@zenvora.com",
        role: "Employee",
        employeeId: "1008",
        contact: "9876543210",
        projects: ["Zoft UX"],
        skills: ["React", "Node"],
        shift: "Morning",
      },
      {
        _id: "member-2",
        name: "Kshitij Ovhal",
        email: "kshitij@zenvora.com",
        role: "Employee",
        employeeId: "1016",
        contact: "9876543211",
        projects: ["Designo-AI"],
        skills: ["Python", "AI"],
        shift: "Evening",
      },
    ],
    projects: [
      { id: "EXT-001", name: "Zoft UX", type: "External", status: "Active" },
      { id: "EXT-002", name: "Designo-AI", type: "External", status: "Active" },
    ],
  },
];

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function normalizeEmployee(value: unknown, fallbackId: string): UserSummary {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const name =
    typeof row.name === "string"
      ? row.name
      : typeof row.fullName === "string"
        ? row.fullName
        : "Unknown";

  return {
    _id: typeof row._id === "string" ? row._id : fallbackId,
    name,
    email: typeof row.email === "string" ? row.email : "-",
    role: typeof row.role === "string" ? row.role : "Employee",
    employeeId:
      typeof row.employeeId === "string"
        ? row.employeeId
        : typeof row.empId === "string"
          ? row.empId
          : undefined,
    contact: typeof row.contact === "string" ? row.contact : undefined,
    projects: Array.isArray(row.projects) ? row.projects.filter((project): project is string => typeof project === "string") : undefined,
    skills: Array.isArray(row.skills) ? row.skills.filter((skill): skill is string => typeof skill === "string") : undefined,
    shift: typeof row.shift === "string" ? row.shift : undefined,
  };
}

function normalizeTeam(value: unknown, index: number, employees: UserSummary[]): TeamData {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const leaderId = typeof item.team_leader === "string" ? item.team_leader : "";
  const leader =
    employees.find((employee) => employee._id === leaderId) ||
    normalizeEmployee(item.leader, `leader-${index}`);

  const memberIds = Array.isArray(item.members) ? item.members.filter((id): id is string => typeof id === "string") : [];
  const members = memberIds.length
    ? memberIds.map((id) => employees.find((employee) => employee._id === id)).filter((member): member is UserSummary => Boolean(member))
    : Array.isArray(item.members)
      ? item.members.map((member, memberIndex) => normalizeEmployee(member, `member-${index}-${memberIndex}`))
      : [];

  return {
    _id: typeof item._id === "string" ? item._id : `team-${index}`,
    name:
      typeof item.team_name === "string"
        ? item.team_name
        : typeof item.name === "string"
          ? item.name
          : `Team ${index + 1}`,
    department: typeof item.department === "string" ? item.department : "General",
    leader,
    members,
    projects: Array.isArray(item.projects)
      ? item.projects.map((project, projectIndex) => {
          const row = project && typeof project === "object" ? (project as Record<string, unknown>) : {};
          return {
            id: typeof row.id === "string" ? row.id : `PRJ-${String(projectIndex + 1).padStart(3, "0")}`,
            name: typeof row.name === "string" ? row.name : "Assigned Project",
            type: typeof row.type === "string" ? row.type : "External",
            status: typeof row.status === "string" ? row.status : "Active",
          };
        })
      : [],
  };
}

export default function TeamManagement() {
  const [teams, setTeams] = useState<TeamData[]>(demoTeams);
  const [featuredExpanded, setFeaturedExpanded] = useState(true);
  const [expandedTeamIds, setExpandedTeamIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search] = useTopHeaderSearch();

  const fetchTeams = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [teamsRes, employeesRes] = await Promise.all([
        api.get("/api/teams"),
        api.get("/api/employees"),
      ]);

      const employeesRaw = Array.isArray(employeesRes.data)
        ? employeesRes.data
        : employeesRes.data?.employees || employeesRes.data?.data || [];
      const employees = Array.isArray(employeesRaw)
        ? employeesRaw.map((employee, index) => normalizeEmployee(employee, `employee-${index}`))
        : [];

      const teamsRaw = Array.isArray(teamsRes.data) ? teamsRes.data : teamsRes.data?.teams || teamsRes.data?.data || [];
      const mappedTeams = Array.isArray(teamsRaw)
        ? teamsRaw.map((team, index) => normalizeTeam(team, index, employees))
        : [];

      setTeams(mappedTeams.length ? mappedTeams : demoTeams);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Showing sample teams");
      setTeams(demoTeams);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(fetchTeams);
  }, [fetchTeams]);

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return teams;

    return teams.filter((team) =>
      [
        team.name,
        team.department,
        team.leader.name,
        team.leader.email,
        ...team.members.flatMap((member) => [member.name, member.email]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, teams]);

  const detailTeam = filteredTeams[0] ?? null;
  const allManagersExpanded = filteredTeams.length > 0 && filteredTeams.every((team) => expandedTeamIds.includes(team._id));
  const allSectionsExpanded = (!detailTeam || featuredExpanded) && allManagersExpanded;

  const toggleAll = () => {
    if (allSectionsExpanded) {
      setFeaturedExpanded(false);
      setExpandedTeamIds([]);
      return;
    }

    setFeaturedExpanded(true);
    setExpandedTeamIds(filteredTeams.map((team) => team._id));
  };

  const toggleTeam = (teamId: string) => {
    setExpandedTeamIds((current) =>
      current.includes(teamId) ? current.filter((id) => id !== teamId) : [...current, teamId],
    );
  };

  return (
    <div className={`${hrPageWrap} mx-auto max-w-[1280px]`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={textPrimary}>
            Team Management
          </h1>
          <p className="mt-1 text-sm" style={textSecondary}>
            View managers, members, and assigned project work.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
            style={btnSecondary}
          >
            {allSectionsExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {allSectionsExpanded ? "Collapse All" : "Expand All"}
          </button>
          <RefreshButton onClick={fetchTeams} compact style={btnSecondary} />
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ ...card, color: "var(--text-secondary)" }}>
          {loadError}
        </div>
      )}

      {detailTeam && (
        <section className="mb-6 rounded-lg p-5" style={card}>
          <TeamHeader team={detailTeam} expanded={featuredExpanded} onToggle={() => setFeaturedExpanded((current) => !current)} />
          {featuredExpanded && <TeamDropdownDetails team={detailTeam} />}
        </section>
      )}

      <div className="space-y-4">
        {filteredTeams.map((team) => {
          const isExpanded = expandedTeamIds.includes(team._id);

          return (
            <section key={team._id} className="rounded-lg p-4" style={card}>
              <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[minmax(260px,1fr)_120px_120px_minmax(180px,1fr)_44px]">
                <ManagerIdentity leader={team.leader} />
                <span className="justify-self-start rounded-full px-2.5 py-1 text-[10px] font-bold uppercase" style={getStatusStyle("In Progress")}>
                  {team.leader.role}
                </span>
                <p className="text-sm font-semibold" style={textSecondary}>
                  {team.members.length} members
                </p>
                <MemberAvatarStack members={team.members} />
                <button
                  type="button"
                  onClick={() => toggleTeam(team._id)}
                  className="justify-self-start rounded-full p-2 lg:justify-self-end"
                  style={btnSecondary}
                  aria-label={isExpanded ? `Collapse ${team.leader.name}` : `Expand ${team.leader.name}`}
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {isExpanded && (
                <div className="pt-4">
                  <TeamDropdownDetails team={team} />
                </div>
              )}
            </section>
          );
        })}

        {filteredTeams.length === 0 && (
          <section className="rounded-lg py-14 text-center" style={card}>
            <Users size={36} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-semibold" style={textPrimary}>
              No teams found
            </p>
          </section>
        )}
      </div>

      {isLoading && (
        <p className="mt-4 text-center text-sm" style={textSecondary}>
          Loading teams...
        </p>
      )}
    </div>
  );
}

function TeamHeader({ team, expanded, onToggle }: { team: TeamData; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <ManagerIdentity leader={team.leader} />
        <p className="mt-2 text-sm" style={textSecondary}>
          {team.name} • {team.department} • {team.members.length} members
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="rounded-full p-2"
        style={btnSecondary}
        aria-label={expanded ? "Collapse team details" : "Expand team details"}
      >
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    </div>
  );
}

function ManagerIdentity({ leader }: { leader: UserSummary }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ background: avatarColors[Math.abs(leader.name.length) % avatarColors.length] }}
      >
        {getInitials(leader.name)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold" style={textPrimary}>
          {leader.name}
        </p>
        <p className="mt-1 truncate text-xs" style={textSecondary}>
          {leader.email}
        </p>
      </div>
    </div>
  );
}

function TeamDropdownDetails({ team }: { team: TeamData }) {
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--chart-bg)", border: "1px solid var(--border)" }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Member", "Emp", "Email", "Contact", "Projects", "Skills", "Shift"].map((column) => (
                <th key={column} className="px-3 py-3 text-left text-xs font-semibold" style={textSecondary}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.members.map((member, index) => (
              <tr key={member._id || `${member.email}-${index}`} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: avatarColors[index % avatarColors.length] }}
                    >
                      {getInitials(member.name)}
                    </span>
                    <span className="text-sm font-semibold" style={textPrimary}>
                      {member.name}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-sm" style={textSecondary}>
                  {member.employeeId || "-"}
                </td>
                <td className="px-3 py-3 text-sm" style={textSecondary}>
                  {member.email}
                </td>
                <td className="px-3 py-3 text-sm" style={textSecondary}>
                  {member.contact || "-"}
                </td>
                <td className="px-3 py-3 text-sm" style={textSecondary}>
                  {member.projects?.join(", ") || team.projects[index % Math.max(team.projects.length, 1)]?.name || "-"}
                </td>
                <td className="px-3 py-3 text-sm" style={textSecondary}>
                  {member.skills?.join(", ") || "-"}
                </td>
                <td className="px-3 py-3 text-sm" style={textSecondary}>
                  {member.shift || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!team.members.length && (
        <p className="py-6 text-center text-sm" style={textSecondary}>
          No team members assigned
        </p>
      )}

      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold" style={textPrimary}>
          Assigned Projects ({team.projects.length})
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {team.projects.map((project) => (
            <div key={project.id} className="rounded-lg p-3" style={{ border: "1px solid var(--border)" }}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold" style={textPrimary}>
                  {project.id}
                </p>
                <ExternalLink size={13} style={textSecondary} />
              </div>
              <p className="mt-2 text-sm font-semibold" style={textPrimary}>
                {project.name}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={getStatusStyle("Pending")}>
                  {project.type}
                </span>
                <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={getStatusStyle("Approved")}>
                  {project.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberAvatarStack({ members }: { members: UserSummary[] }) {
  const visibleMembers = members.slice(0, 5);
  const extraCount = Math.max(members.length - visibleMembers.length, 0);

  if (!members.length) {
    return (
      <span className="text-sm" style={textSecondary}>
        No members
      </span>
    );
  }

  return (
    <div className="flex items-center">
      {visibleMembers.map((member, index) => (
        <span
          key={member._id}
          title={member.name}
          className="-ml-1 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white first:ml-0"
          style={{
            background: avatarColors[index % avatarColors.length],
            borderColor: "var(--bg-secondary)",
          }}
        >
          {getInitials(member.name)}
        </span>
      ))}
      {extraCount > 0 && (
        <span className="ml-2 text-xs font-semibold" style={textSecondary}>
          +{extraCount}
        </span>
      )}
    </div>
  );
}
