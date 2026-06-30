import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, Plus } from "lucide-react";
import { SEARCH_EVENT } from "../../components/layout/TopHeader";
import CreateSprintModal from "./SprintBoard/CreateSprintModal";
import { getSprintBoardBasePath } from "../../utils/sprintBoardPath";
import { getApiBaseUrl } from "../../config/apiConfig";

interface Sprint {
  id: string;
  _id?: string;
  name?: string;
  title?: string;
  description: string;
  team?: string;
  start_date?: string;
  end_date?: string;
  progress: number;
  locked: boolean;
  created_at?: string;
}

type SprintTaskSummary = {
  sprintId?: string;
  sprint_id?: string;
  status?: string;
};

function SprintCard({ sprint, onClick }: { sprint: Sprint; onClick: () => void }) {
  const title = sprint.name || sprint.title || "Sprint";
  const startDate = sprint.start_date
    ? new Date(sprint.start_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : sprint.created_at
    ? new Date(sprint.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const endDate = sprint.end_date
    ? new Date(sprint.end_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  return (
    <div
      onClick={onClick}
      className="rounded-2xl flex flex-col gap-3 cursor-pointer transition-all duration-200 hover:-translate-y-1"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", minWidth: 0, padding: "1.25rem 1.5rem" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--text-secondary)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{title}</h3>
        {sprint.locked && <Lock size={13} style={{ color: "var(--text-secondary)", flexShrink: 0, marginTop: 2 }} />}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--bg-hover)", color: "var(--accent)", border: "1px solid var(--border)" }}>
          Active
        </span>
        {sprint.team && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            {sprint.team}
          </span>
        )}
      </div>

      {sprint.description && (
        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>{sprint.description}</p>
      )}



      {(startDate || endDate) && (
        <div className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
          {startDate && <span>{startDate}</span>}
          {startDate && endDate && <span style={{ color: "var(--accent)" }}>→</span>}
          {endDate && <span>{endDate}</span>}
        </div>
      )}
    </div>
  );
}

export default function SprintBoardPage() {
  const [search, setSearch] = useState("");
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
  const sprintBoardBasePath = getSprintBoardBasePath(location.pathname);

  const loadSprints = async () => {
    try {
      const token =
        localStorage.getItem("accessToken") ||
        localStorage.getItem("hr_accessToken") ||
        localStorage.getItem("admin_accessToken") ||
        localStorage.getItem("manager_accessToken") ||
        "";
      const [sprintsRes, tasksRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/api/sprints`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${getApiBaseUrl()}/api/tasks`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
      ]);

      const [sprintsData, tasksData] = await Promise.all([sprintsRes.json(), tasksRes.json()]);

      const tasks = Array.isArray(tasksData.data) ? (tasksData.data as SprintTaskSummary[]) : [];
      const progressBySprint = tasks.reduce<Record<string, { total: number; done: number }>>((acc, task) => {
        const sprintId = task.sprintId || task.sprint_id;
        if (!sprintId) return acc;

        if (!acc[sprintId]) {
          acc[sprintId] = { total: 0, done: 0 };
        }

        acc[sprintId].total += 1;
        if ((task.status || "").toUpperCase() === "DONE") {
          acc[sprintId].done += 1;
        }

        return acc;
      }, {});

      if (sprintsData.success && Array.isArray(sprintsData.sprints)) {
        setSprints(
          sprintsData.sprints.map((sprint: Sprint) => {
            const sprintId = sprint.id || sprint._id || "";
            const stats = progressBySprint[sprintId];
            const progress = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : Number(sprint.progress) || 0;

            return {
              ...sprint,
              progress,
            };
          })
        );
      } else {
        setSprints([]);
      }
    } catch {
      setSprints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSprints();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleSearch(e: Event) { setSearch((e as CustomEvent<string>).detail); }
    window.addEventListener(SEARCH_EVENT, handleSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleSearch);
  }, []);

  const filtered = sprints.filter((s) => {
    const title = (s.name || s.title || "").toLowerCase();
    const desc = (s.description || "").toLowerCase();
    const q = search.toLowerCase();
    return title.includes(q) || desc.includes(q);
  });

  const handleCreated = (sprint: any) => {
    setSprints((prev) => [sprint, ...prev]);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        {/* <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Sprint Board</h2> */}
        {userRole !== "employee" && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center flex-1 sm:flex-none gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
            style={{ background: "var(--accent)", color: "var(--accent-text, #fff)", border: "none", cursor: "pointer" }}
          >
            <Plus size={15} /> New Sprint
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-1">
          {filtered.map((sprint) => (
            <SprintCard
              key={sprint.id || sprint._id}
              sprint={sprint}
              onClick={() => navigate(`${sprintBoardBasePath}/${sprint.id || sprint._id}`)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-sm" style={{ color: "var(--text-secondary)" }}>
              {search ? `No sprints found matching "${search}"` : 'No sprints yet. Click "New Sprint" to create one.'}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateSprintModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
