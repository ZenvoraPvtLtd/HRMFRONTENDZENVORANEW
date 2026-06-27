import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { BoardTask } from "./sprintData";
import { getApiBaseUrl } from "../../../config/apiConfig";

interface Props {
  onClose: () => void;
  tasks?: BoardTask[];
}

interface Member {
  name: string;
  email: string;
  role: string;
}

interface ActivityEntry {
  id: string;
  user: string;
  action: string;
  time: string;
  taskTitle: string;
  taskId: string;
  sortKey: number;
}

type DrawerTab = "members" | "activity";

const initialsFor = (name: string) =>
  name.replace(/[()]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");

const formatRole = (role: string) => {
  const cleaned = role.trim().toLowerCase();
  if (cleaned === "manager") return "Manager";
  if (cleaned === "hr") return "HR";
  if (cleaned === "admin") return "Admin";
  if (cleaned === "employee") return "Employee";
  return role || "Employee";
};

const parseActivityTime = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

function buildActivityLog(tasks: BoardTask[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const task of tasks) {
    for (const item of task.history || []) {
      entries.push({
        id: `${task.id}-history-${item.id}`,
        user: item.user,
        action: item.action,
        time: item.time,
        taskTitle: task.title,
        taskId: task.taskId,
        sortKey: parseActivityTime(item.time) || Number(item.id) || 0,
      });
    }

    for (const item of task.comments || []) {
      const preview = item.text.length > 60 ? `${item.text.slice(0, 60)}...` : item.text;
      entries.push({
        id: `${task.id}-comment-${item.id}`,
        user: item.user,
        action: `commented: "${preview}"`,
        time: item.time,
        taskTitle: task.title,
        taskId: task.taskId,
        sortKey: parseActivityTime(item.time) || Number(item.id) || 0,
      });
    }

    for (const item of task.worklogs || []) {
      entries.push({
        id: `${task.id}-worklog-${item.id}`,
        user: item.user,
        action: `logged ${item.hours}h ${item.minutes}m work`,
        time: item.date,
        taskTitle: task.title,
        taskId: task.taskId,
        sortKey: parseActivityTime(item.date) || Number(item.id) || 0,
      });
    }
  }

  return entries.sort((a, b) => b.sortKey - a.sortKey);
}

export default function MembersDrawer({ onClose, tasks = [] }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DrawerTab>("members");

  const activityLog = useMemo(() => buildActivityLog(tasks), [tasks]);

  useEffect(() => {
    const load = async () => {
      try {
        const collected = new Map<string, Member>();

        const addMember = (member: Member) => {
          const key = (member.email || member.name).toLowerCase();
          if (!key) return;
          collected.set(key, member);
        };

        const employeesRes = await fetch(`${getApiBaseUrl()}/api/employees`);
        if (employeesRes.ok) {
          const employees = await employeesRes.json();
          if (Array.isArray(employees)) {
            employees.forEach((entry: any) => {
              addMember({
                name: entry.name || entry.fullName || "Employee",
                email: entry.email || "",
                role: formatRole(entry.role || "Employee"),
              });
            });
          }
        }

        const teamRes = await fetch(`${getApiBaseUrl()}/api/auth/team-users`);
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          if (teamData.success && Array.isArray(teamData.data)) {
            teamData.data.forEach((user: any) => {
              addMember({
                name: user.name || user.fullName || "User",
                email: user.email || "",
                role: formatRole(user.role || "Employee"),
              });
            });
          }
        }

        setMembers(Array.from(collected.values()).sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div style={{ position: "fixed", top: "56px", right: 0, bottom: 0, width: "320px", zIndex: 500, background: "var(--bg-secondary)", borderLeft: "1px solid var(--border)", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
          {activeTab === "members" ? `Members (${members.length})` : `Activity Log (${activityLog.length})`}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex" }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {([
          { key: "members" as const, label: "Members" },
          { key: "activity" as const, label: "Activity Log" },
        ]).map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "0.6rem 0",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: selected ? "var(--accent)" : "var(--text-secondary)",
                borderBottom: selected ? "2px solid var(--accent)" : "2px solid transparent",
                background: "none",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "members" ? (
          loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Loading...</div>
          ) : members.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>No members found</div>
          ) : (
            members.map((member) => (
              <div key={member.email + member.name} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#262626", border: "1px solid #3f3f46", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 800, flexShrink: 0, position: "relative" }}>
                  {initialsFor(member.name)}
                  <span style={{ position: "absolute", right: 0, bottom: 0, width: 9, height: 9, borderRadius: "50%", background: "#00c853", border: "1.5px solid var(--bg-secondary)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>{member.name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.email}</div>
                </div>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "0.15rem 0.5rem", borderRadius: "9999px", background: member.role === "Manager" ? "#ec489910" : "var(--bg-primary)", color: member.role === "Manager" ? "#ec4899" : "var(--text-secondary)", border: `1px solid ${member.role === "Manager" ? "#ec489930" : "var(--border)"}`, flexShrink: 0 }}>
                  {member.role}
                </span>
              </div>
            ))
          )
        ) : activityLog.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            No activity yet. Updates from task comments, work logs, and history will appear here.
          </div>
        ) : (
          activityLog.map((entry) => (
            <div key={entry.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-primary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.75rem", flexShrink: 0, color: "var(--text-primary)" }}>
                {entry.user.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600 }}>{entry.user}</span> {entry.action}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                  {entry.taskId} · {entry.taskTitle}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>{entry.time}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
