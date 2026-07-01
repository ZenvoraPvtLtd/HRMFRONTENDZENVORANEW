import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckSquare, Circle, Clock, AlertCircle, Filter, X } from "lucide-react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";
import { statusColor } from "./SprintBoard/sprintData";
import PaginationControls from "../../components/PaginationControls";
import { getApiBaseUrl } from "../../config/apiConfig";

const PAGE_SIZE = 5;

type Priority = "High" | "Medium" | "Low";
type TaskStatus = "Todo" | "In Progress" | "Done";

interface Task {
  id: string;
  title: string;
  sprint: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
}

interface ApiAssignee {
  name?: string;
}

interface ApiTask {
  id?: string;
  _id?: string;
  title?: string;
  sprintId?: string;
  assignee?: string | ApiAssignee;
  reporter?: string | ApiAssignee;
  status?: string;
  priority?: string;
  dueDate?: string;
}

interface ApiSprint {
  id?: string;
  _id?: string;
  name?: string;
  title?: string;
}

const priorityColor: Record<Priority, string> = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#10b981",
};

const taskStatusColor: Record<TaskStatus, string> = {
  Todo: statusColor["TO DO"],
  "In Progress": statusColor["IN PROGRESS"],
  Done: statusColor.DONE,
};

const statusIcon: Record<TaskStatus, React.ReactNode> = {
  Todo: <Circle size={15} style={{ color: "var(--text-secondary)" }} />,
  "In Progress": <Clock size={15} style={{ color: taskStatusColor["In Progress"] }} />,
  Done: <CheckSquare size={15} style={{ color: taskStatusColor.Done }} />,
};

const statuses: TaskStatus[] = ["Todo", "In Progress", "Done"];

function TaskRow({ task }: { task: Task }) {
  const sColor = taskStatusColor[task.status];

  return (
    <div
      className="grid gap-3 px-4 py-3 transition-colors duration-150"
      style={{
        gridTemplateColumns: "minmax(220px, 1.4fr) 150px 120px 140px",
        alignItems: "center",
        borderBottom: "1px solid var(--border)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "rgba(128,128,128,0.06)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0">{statusIcon[task.status]}</span>
        <p
          className="text-sm font-semibold truncate"
          style={{
            color: "var(--text-primary)",
            textDecoration: task.status === "Done" ? "line-through" : "none",
            opacity: task.status === "Done" ? 0.6 : 1,
            margin: 0,
          }}
          title={task.title}
        >
          {task.title}
        </p>
      </div>

      <div className="min-w-0">
        <span
          className="text-xs truncate block"
          style={{ color: "var(--text-secondary)" }}
          title={task.sprint}
        >
          {task.sprint}
        </span>
      </div>

      <div>
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{
            background: sColor + "18",
            color: sColor,
            border: `1px solid ${sColor}35`,
          }}
        >
          {task.status}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: priorityColor[task.priority] + "18",
            color: priorityColor[task.priority],
            border: `1px solid ${priorityColor[task.priority]}30`,
          }}
        >
          {task.priority}
        </span>
        <span className="flex items-center gap-1 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
          <AlertCircle size={12} />
          {task.dueDate}
        </span>
      </div>
    </div>
  );
}

export default function MyTasksPage() {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [sprintFilter, setSprintFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch both tasks and sprints from backend APIs
  const loadTasks = useCallback((isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    const token = localStorage.getItem("accessToken") || "";
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${getApiBaseUrl()}/api/tasks`, { headers }).then((r) => r.json()).catch(() => ({ success: false, data: [] })),
      fetch(`${getApiBaseUrl()}/api/sprints`, { headers }).then((r) => r.json()).catch(() => ({ success: false, sprints: [] })),
    ])
      .then(([tasksData, sprintsData]) => {
        const sprintMap: Record<string, string> = {};
        if (sprintsData && sprintsData.success && Array.isArray(sprintsData.sprints)) {
          sprintsData.sprints.forEach((s: ApiSprint) => {
            const sprintId = s.id || s._id;
            if (sprintId) {
              sprintMap[sprintId] = s.name || s.title || "";
            }
          });
        }

        // Show all tasks without user filtering
        if (tasksData && tasksData.success && Array.isArray(tasksData.data)) {
          const mapped = tasksData.data
            .map((t: ApiTask): Task => {
              let status: TaskStatus = "Todo";
              const apiStatus = (t.status || "").toUpperCase();
              if (apiStatus === "IN PROGRESS") status = "In Progress";
              else if (apiStatus === "DONE" || apiStatus === "IN REVIEW") status = "Done";

              let priority: Priority = "Medium";
              const apiPriority = (t.priority || "").toLowerCase();
              if (apiPriority === "high" || apiPriority === "critical") priority = "High";
              else if (apiPriority === "low") priority = "Low";

              const rawDueDate = t.dueDate || "";
              let formattedDueDate = "—";
              if (rawDueDate) {
                const d = new Date(rawDueDate);
                if (!Number.isNaN(d.getTime())) {
                  formattedDueDate = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                } else {
                  formattedDueDate = rawDueDate;
                }
              }

              return {
                id: (t._id ?? t.id ?? ""),
                title: t.title || "",
                sprint: sprintMap[t.sprintId ?? ""] || "Backlog",
                priority,
                status,
                dueDate: formattedDueDate,
              };
            });
          setTasks(mapped);
        }
      })
      .catch((e) => {
        console.error("Error loading tasks:", e);
        setTasks([]);
      })
      .finally(() => {
        if (isInitial) {
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    loadTasks(true);

    const handleFocus = () => loadTasks(false);
    window.addEventListener("focus", handleFocus);

    const interval = setInterval(() => loadTasks(false), 5000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [loadTasks]);

  useEffect(() => {
    const handler = (e: Event) => setSearch((e as CustomEvent<string>).detail);
    window.addEventListener(SEARCH_EVENT, handler);
    return () => window.removeEventListener(SEARCH_EVENT, handler);
  }, []);

  const sprintOptions = useMemo(
    () => Array.from(new Set(tasks.map((task) => task.sprint))),
    [tasks]
  );

  const hasActiveFilter = statusFilter !== "all" || priorityFilter !== "all" || sprintFilter !== "all";

  const clearFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setSprintFilter("all");
    setCurrentPage(1);
  };

  const closeFilters = () => {
    setShowFilters(false);
  };

  const filtered = tasks.filter((t) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      t.title.toLowerCase().includes(query) ||
      t.sprint.toLowerCase().includes(query) ||
      t.status.toLowerCase().includes(query) ||
      t.priority.toLowerCase().includes(query);

    return (
      matchesSearch &&
      (statusFilter === "all" || t.status === statusFilter) &&
      (priorityFilter === "all" || t.priority === priorityFilter) &&
      (sprintFilter === "all" || t.sprint === sprintFilter)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedTasks = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    const timeout = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(timeout);
  }, [search, statusFilter, priorityFilter, sprintFilter]);

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Done").length;
  const inProgress = tasks.filter((t) => t.status === "In Progress").length;


  return (
    <>
      <div className="flex items-center justify-end mb-2 flex-wrap">
        <button
          onClick={() => setShowFilters((value) => !value)}
          className="flex items-center gap-1.5 text-xs font-semibold p-2  rounded-lg"
          style={{
            background:
              showFilters || hasActiveFilter
                ? "var(--accent)"
                : "var(--bg-secondary)",
            border: `1px solid ${showFilters || hasActiveFilter ? "var(--accent)" : "var(--border)"}`,
            color:
              showFilters || hasActiveFilter
                ? "var(--accent-text)"
                : "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <Filter size={13} /> Filter
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Tasks", value: total, color: "var(--accent)" },
          {
            label: "In Progress",
            value: inProgress,
            color: taskStatusColor["In Progress"],
          },
          { label: "Completed", value: done, color: taskStatusColor.Done },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl p-4"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {label}
            </div>
            <div className="text-2xl font-bold" style={{ color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {showFilters && (
        <div
          className="mb-4 rounded-xl p-4 flex flex-col gap-3"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-sm font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Filters
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={clearFilters}
                className="text-xs font-semibold"
                style={{
                  color: "var(--accent)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Clear all
              </button>
              <button
                onClick={closeFilters}
                aria-label="Close filters"
                className="flex items-center justify-center rounded-md"
                style={{
                  width: 28,
                  height: 28,
                  color: "var(--text-secondary)",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ConstrainedDropdown
              label="Status"
              value={statusFilter}
              onChange={(value) =>
                setStatusFilter(value as TaskStatus | "all")
              }
              options={[{ value: "all", label: "All statuses" }, ...statuses]}
              buttonStyle={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              labelStyle={{ color: "var(--text-secondary)", textTransform: "uppercase" }}
            />

            <ConstrainedDropdown
              label="Priority"
              value={priorityFilter}
              onChange={(value) =>
                setPriorityFilter(value as Priority | "all")
              }
              options={[
                { value: "all", label: "All priorities" },
                "High",
                "Medium",
                "Low",
              ]}
              buttonStyle={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              labelStyle={{ color: "var(--text-secondary)", textTransform: "uppercase" }}
            />

            <ConstrainedDropdown
              label="Sprint"
              value={sprintFilter}
              onChange={setSprintFilter}
              options={[{ value: "all", label: "All sprints" }, ...sprintOptions]}
              buttonStyle={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              labelStyle={{ color: "var(--text-secondary)", textTransform: "uppercase" }}
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="mb-4 rounded-xl p-3 text-sm" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          Loading tasks...
        </div>
      )}

      {/* Task rows */}
      <div
        className="rounded-xl overflow-x-auto"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ minWidth: "760px" }}>
          <div
            className="grid gap-3 px-4 py-2.5 text-[11px] font-bold uppercase"
            style={{
              gridTemplateColumns: "minmax(220px, 1.4fr) 150px 120px 140px",
              background: "var(--table-head-bg)",
              color: "var(--table-head-text)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span>Task</span>
            <span>Sprint</span>
            <span>Status</span>
            <span>Priority / Due</span>
          </div>

          {pagedTasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}

          {filtered.length === 0 && (
            <div
              className="text-center py-12 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              No tasks found
            </div>
          )}
        </div>
      </div>

      {filtered.length > 0 && (
        <PaginationControls
          currentPage={safePage}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          itemLabel="tasks"
          onPageChange={setCurrentPage}
        />
      )}
    </>
  );
}
