import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Lock, Plus, LayoutGrid, List,
  Filter, Users, BarChart2, UserPlus, ChevronLeft, X,
} from "lucide-react";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";

import { defaultBoard } from "./SprintBoard/sprintData";
import type { BoardTask, TaskStatus } from "./SprintBoard/sprintData";
import TaskDetailModal from "./TaskDetailModal";
import BoardView from "./SprintBoard/BoardView";
import ListView from "./SprintBoard/ListView";
import FilterPanel from "./SprintBoard/FilterPanel";
import StatsPanel from "./SprintBoard/StatsPanel";
import MembersDrawer from "./SprintBoard/MembersDrawer";
import AssigneesPanel from "./SprintBoard/AssigneesPanel";
import CreateTaskModal from "./SprintBoard/CreateTaskModal";
import { getSprintBoardBasePath } from "../../utils/sprintBoardPath";
import { getApiBaseUrl } from "../../config/apiConfig";

export type { BoardTask };

type PanelKey = "filter" | "stats" | "members" | "assignees";

export interface ApiTask {
  _id?: string;
  id?: string;
  title: string;
  workType?: string;
  taskId?: string;
  priority?: BoardTask["priority"];
  dueDate?: string | null;
  assignee?: string;
  reporter?: string;
  estimatedHours?: string | number;
  estimatedMinutes?: string | number;
  labels?: string[];
  status?: string;
  linkedIssues?: string[];
  subtasks?: string[];
  description?: string;
  comments?: { id: string; user: string; text: string; time: string }[];
  worklogs?: { id: string; user: string; hours: number; minutes: number; date: string; description: string }[];
  history?: { id: string; user: string; action: string; time: string }[];
}

const formatDueDate = (value?: string | null) => {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const normalizeTaskType = (value?: string): BoardTask["type"] => {
  const normalized = value?.toLowerCase() || "";
  if (normalized.includes("bug")) return "Bug";
  if (normalized.includes("feature") || normalized.includes("story")) return "Feature";
  return "Task";
};

const normalizeTaskStatus = (value?: string): TaskStatus => {
  const normalized = value?.toUpperCase();
  if (
    normalized === "TO DO" ||
    normalized === "IN PROGRESS" ||
    normalized === "IN REVIEW" ||
    normalized === "DONE" ||
    normalized === "BLOCKED"
  ) {
    return normalized;
  }

  return "TO DO";
};

const formatEstimate = (hours?: string | number, minutes?: string | number) => {
  const hourValue = String(hours ?? "").trim();
  const minuteValue = String(minutes ?? "").trim();
  const parts: string[] = [];

  if (hourValue && hourValue !== "-") {
    parts.push(`${hourValue}h`);
  }

  if (minuteValue && minuteValue !== "-") {
    parts.push(`${minuteValue}m`);
  }

  return parts.join(" ") || undefined;
};

const mapApiTask = (task: ApiTask): BoardTask => ({
  id: String(task._id || task.id),
  title: task.title,
  type: normalizeTaskType(task.workType),
  taskId: task.taskId || `TASK-${String(task._id || task.id).slice(-4).toUpperCase()}`,
  priority: task.priority,
  dueDate: formatDueDate(task.dueDate),
  assignee: task.assignee ? { name: task.assignee, color: "var(--accent)" } : undefined,
  reporter: task.reporter ? { name: task.reporter, color: "#e11d48" } : undefined,
  estimate: formatEstimate(task.estimatedHours, task.estimatedMinutes),
  tags: Array.isArray(task.labels)
    ? task.labels.map((label: string) => ({ label: label.toUpperCase(), color: "#3b82f6" }))
    : [],
  status: normalizeTaskStatus(task.status),
  linkedIssues: Array.isArray(task.linkedIssues) ? task.linkedIssues : [],
  subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
  description: task.description || "",
  comments: task.comments || [],
  worklogs: task.worklogs || [],
  history: task.history || [],
});

export default function SprintBoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const sprintBoardBasePath = getSprintBoardBasePath(location.pathname);

  const board = defaultBoard;
  const [boardData, setBoardData] = useState(board);
  const [sprintName, setSprintName] = useState("Sprint Board");
  const [sprintTeam, setSprintTeam] = useState("Zenvora Product Team");

  // Load sprint info
  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("accessToken") || "";
    fetch(`${getApiBaseUrl()}/api/sprints`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      if (data.success && Array.isArray(data.sprints)) {
        const sprint = data.sprints.find((s: ApiTask) => s.id === id || s._id === id);
        if (sprint) {
          setSprintName(sprint.name || sprint.title || "Sprint Board");
          setSprintTeam(sprint.team || "Zenvora Product Team");
        }
      }
    }).catch(() => {});
  }, [id]);

  const onStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setBoardData((prevBoard) => {
      const prev = prevBoard.columns;
      const sourceCol = prev.find((c) => c.tasks.some((t) => t.id === taskId));
      if (!sourceCol) return prevBoard;
      const task = sourceCol.tasks.find((t) => t.id === taskId)!;
      const nextColumns = prev.map((col) => {
        if (col.status === sourceCol.status) {
          return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
        }
        if (col.status === newStatus) {
          return { ...col, tasks: [...col.tasks, { ...task, status: newStatus }] };
        }
        return col;
      });
      return { ...prevBoard, columns: nextColumns };
    });

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        window.dispatchEvent(new Event("tasks:updated"));
      }
    } catch (e) {
      console.error("Failed to update task status:", e);
    }
  };

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"board" | "list">("list");
  const [suppressViewActive, setSuppressViewActive] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      // Fetch only tasks belonging to this sprint
      const sprintParam = id ? `?sprint_id=${id}` : "";
      const token = localStorage.getItem("accessToken") || "";
      const res = await fetch(`${getApiBaseUrl()}/api/tasks${sprintParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const newBoard: typeof defaultBoard = {
          ...defaultBoard,
          columns: defaultBoard.columns.map((column) => ({
            ...column,
            tasks: [],
          })),
        };
        const apiTasks: BoardTask[] = (data.data as ApiTask[]).map(mapApiTask);
        for (const task of apiTasks) {
          const column = newBoard.columns.find((col) => col.status === task.status);
          column?.tasks.push(task);
        }
        setBoardData(newBoard);
      }
    } catch (e) {
      console.error(e);
    }
  }, [id]);

  const handleTaskCreated = (createdTask: ApiTask) => {
    const task = mapApiTask(createdTask);
    setBoardData((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.status === (task.status || "TO DO")
          ? { ...column, tasks: [task, ...column.tasks.filter((item) => item.id !== task.id)] }
          : { ...column, tasks: column.tasks.filter((item) => item.id !== task.id) }
      ),
    }));
  };

  useEffect(() => {
    const loadTasks = async () => {
      await fetchTasks();
    };
    void loadTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const handler = (e: Event) => setSearch((e as CustomEvent<string>).detail);
    window.addEventListener(SEARCH_EVENT, handler);
    return () => window.removeEventListener(SEARCH_EVENT, handler);
  }, []);

  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskStatus, setCreateTaskStatus] = useState<TaskStatus>("TO DO");
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);

  useEffect(() => {
    const taskParam = new URLSearchParams(location.search).get("task");
    if (!taskParam) return;

    const linkedTask = boardData.columns
      .flatMap((column) => column.tasks)
      .find((task) => task.id === taskParam || task.taskId === taskParam);

    if (!linkedTask || selectedTask?.id === linkedTask.id) {
      return;
    }

    const frame = window.requestAnimationFrame(() => setSelectedTask(linkedTask));
    return () => window.cancelAnimationFrame(frame);
  }, [boardData.columns, location.search, selectedTask?.id]);

  const closeTaskModal = () => {
    const params = new URLSearchParams(location.search);
    if (params.has("task")) {
      params.delete("task");
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "", hash: location.hash },
        { replace: true }
      );
    }
    setSelectedTask(null);
    fetchTasks();
  };

  const handleAddTask = (status: TaskStatus) => {
    setCreateTaskStatus(status);
    setShowCreateTask(true);
  };

  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const allAssignees = Array.from(
    new Set(boardData.columns.flatMap((c) => c.tasks.map((t) => t.assignee?.name)).filter(Boolean))
  ) as string[];

  const hasActiveFilter =
    filterAssignee !== "all" || filterPriority !== "all" || filterType !== "all" ||
    filterDateFrom !== "" || filterDateTo !== "";

  const clearFilters = () => {
    setFilterAssignee("all"); setFilterPriority("all");
    setFilterType("all"); setFilterDateFrom(""); setFilterDateTo("");
  };

  const applyFilters = (task: BoardTask) => {
    if (filterAssignee !== "all" && task.assignee?.name !== filterAssignee) return false;
    if (filterPriority !== "all" && (task.priority ?? "Medium") !== filterPriority) return false;
    if (filterType !== "all" && task.type !== filterType) return false;
    if (filterDateFrom && task.dueDate) {
      const [d, m, y] = task.dueDate.split("/");
      if (new Date(`${y}-${m}-${d}`) < new Date(filterDateFrom)) return false;
    }
    if (filterDateTo && task.dueDate) {
      const [d, m, y] = task.dueDate.split("/");
      if (new Date(`${y}-${m}-${d}`) > new Date(filterDateTo)) return false;
    }
    return true;
  };

  const filteredColumns = boardData.columns.map((col) => ({
    ...col,
    tasks: col.tasks.filter(
      (t) => t.title.toLowerCase().includes(search.toLowerCase()) && applyFilters(t)
    ),
  }));

  const closePanel = () => {
    setActivePanel(null);
    setSuppressViewActive(true);
  };

  const togglePanel = (key: PanelKey) => {
    setActivePanel((prev) => {
      if (prev === key) {
        setSuppressViewActive(true);
        return null;
      }
      setSuppressViewActive(false);
      return key;
    });
  };
  const totalTasks = boardData.columns.reduce((a, c) => a + c.tasks.length, 0);
  const allBoardTasks = boardData.columns.flatMap((column) => column.tasks);

  const panelBtns: { key: PanelKey; icon: React.ReactNode; label: string }[] = [
    { key: "assignees", icon: <UserPlus size={14} />, label: "Assignees" },
    { key: "stats",     icon: <BarChart2 size={14} />,  label: "Stats"     },
    { key: "members",   icon: <Users size={14} />,      label: "Members"   },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>

      {/* ── Page heading row ── */}
      <div
        className="sprint-header"
        style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          paddingBottom: "1rem", marginBottom: "1rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => navigate(sprintBoardBasePath)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "var(--text-secondary)", flexShrink: 0 }}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sprintName}
          </h1>
          <Lock size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          <span
            className="sprint-meta-badge"
            style={{
              fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.55rem",
              borderRadius: "9999px", background: "var(--bg-hover)",
              color: "var(--text-secondary)", border: "1px solid var(--border)",
              flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            {sprintTeam}
          </span>
          <span
            className="sprint-meta-badge"
            style={{
              fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.55rem",
              borderRadius: "9999px", background: "var(--bg-hover)",
              color: "var(--text-secondary)", border: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            {totalTasks} tasks
          </span>
        </div>

        {/* View toggle */}
        <div
          style={{
            display: "flex", borderRadius: "0.5rem", overflow: "hidden",
            border: "1px solid var(--border)", flexShrink: 0,
          }}
        >
          {(["board", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setActivePanel(null);
                setSuppressViewActive(false);
              }}
              style={{
                display: "flex", alignItems: "center", gap: "0.35rem",
                padding: "0.35rem 0.6rem", fontSize: "0.75rem", fontWeight: 600,
                background: view === v && !activePanel && !suppressViewActive ? "var(--accent)" : "transparent",
                color: view === v && !activePanel && !suppressViewActive ? "var(--accent-text, #fff)" : "var(--text-secondary)",
                border: "none", cursor: "pointer",
              }}
            >
              {v === "board" ? <LayoutGrid size={13} /> : <List size={13} />}
              <span className="sprint-panel-btn-label">{v.charAt(0).toUpperCase() + v.slice(1)}</span>
            </button>
          ))}
        </div>

        {/* Panel buttons */}
        <div className="sprint-header-btns" style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
          {panelBtns.map(({ key, icon, label }) => (
            <button
              key={key}
              title={label}
              onClick={() => togglePanel(key)}
              style={{
                display: "flex", alignItems: "center", gap: "0.3rem",
                padding: "0.35rem 0.65rem", borderRadius: "0.4rem",
                fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
                background: activePanel === key ? "var(--accent)" : "transparent",
                color: activePanel === key ? "var(--accent-text, #fff)" : "var(--text-secondary)",
                border: "1px solid " + (activePanel === key ? "var(--accent)" : "var(--border)"),
              }}
            >
              {icon} <span className="sprint-panel-btn-label">{label}</span>
            </button>
          ))}

          <button
            onClick={() => togglePanel("filter")}
            style={{
              display: "flex", alignItems: "center", gap: "0.3rem",
              padding: "0.35rem 0.65rem", borderRadius: "0.4rem",
              fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
              background: activePanel === "filter" || hasActiveFilter ? "var(--accent)" : "transparent",
              color: activePanel === "filter" || hasActiveFilter ? "var(--accent-text, #fff)" : "var(--text-secondary)",
              border: "1px solid " + (activePanel === "filter" || hasActiveFilter ? "var(--accent)" : "var(--border)"),
            }}
          >
            <Filter size={13} />
            <span className="sprint-panel-btn-label">Filter</span>
          </button>
        </div>

        <button
          onClick={() => setShowCreateTask(true)}
          style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            fontSize: "0.8rem", fontWeight: 700, padding: "0.45rem 1rem",
            borderRadius: "0.5rem", background: "var(--accent)",
            color: "var(--accent-text, #fff)", border: "none", cursor: "pointer",
            flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
          }}
        >
          <Plus size={14} /> New Task
        </button>
      </div>

      {/* ── Side panel  */}
      {activePanel && (
        <div
          style={{
            marginBottom: "1rem",
            background: "var(--bg-secondary)",
            borderRadius: "0.75rem",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            padding: "0.75rem 1.25rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {activePanel === "assignees" && (
              <AssigneesPanel
                columns={boardData.columns}
                allAssignees={allAssignees}
                filterAssignee={filterAssignee}
                onSelect={setFilterAssignee}
                onClear={() => setFilterAssignee("all")}
              />
            )}
            {activePanel === "filter" && (
              <FilterPanel
                allAssignees={allAssignees}
                filterAssignee={filterAssignee} filterPriority={filterPriority}
                filterType={filterType} filterDateFrom={filterDateFrom} filterDateTo={filterDateTo}
                onAssignee={setFilterAssignee} onPriority={setFilterPriority}
                onType={setFilterType} onDateFrom={setFilterDateFrom} onDateTo={setFilterDateTo}
                onClear={clearFilters}
              />
            )}
            {activePanel === "stats" && <StatsPanel columns={boardData.columns} />}
            {activePanel === "members" && <MembersDrawer onClose={closePanel} tasks={allBoardTasks} />}
          </div>
          <button
            onClick={closePanel}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-secondary)", display: "flex", alignItems: "center",
              flexShrink: 0, padding: "0.1rem",
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Board / List ── */}
      {activePanel !== "assignees" && (
        <div style={{ flex: 1, minHeight: 0 }}>
          {view === "board"
            ? <BoardView columns={filteredColumns} onTaskClick={setSelectedTask} onStatusChange={onStatusChange} onAddTask={handleAddTask} />
            : <ListView columns={filteredColumns} onTaskClick={setSelectedTask} onStatusChange={onStatusChange} />
          }
        </div>
      )}

      {showCreateTask && <CreateTaskModal onClose={() => { setShowCreateTask(false); setCreateTaskStatus("TO DO"); }} onCreated={handleTaskCreated} sprintId={id} initialStatus={createTaskStatus} />}
      {selectedTask && <TaskDetailModal task={selectedTask} onClose={closeTaskModal} />}
    </div>
  );
}
