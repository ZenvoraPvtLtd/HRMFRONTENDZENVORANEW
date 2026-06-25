import { useEffect, useMemo, useState } from "react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import api from "../../utils/axiosInstance";
import {
  btnPrimary,
  card,
  getStatusStyle,
  hrPageWrap,
  inputMuted,
  tableHead,
  textPrimary,
  textSecondary,
} from "./hrTheme";

type Grievance = {
  id: string;
  employee_id?: string;
  employee_name?: string;
  employee_email?: string;
  subject: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  resolution?: string;
  created_at?: string;
};

const statuses = ["Open", "Under Review", "In Progress", "Resolved", "Closed", "Rejected"];

export default function GrievanceHandling() {
  const [search] = useTopHeaderSearch();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const response = await api.get("/api/grievances");
        if (!mounted) return;
        setGrievances(response.data);
        setResolutions(
          Object.fromEntries(
            response.data.map((item: Grievance) => [item.id, item.resolution || ""]),
          ),
        );
      } catch {
        // API fail ho to koi message show nahi hoga.
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredGrievances = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return grievances;

    return grievances.filter((item) =>
      [
        item.employee_name || "",
        item.employee_email || "",
        item.subject,
        item.category,
        item.priority,
        item.status,
        item.description,
        item.resolution || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [grievances, search]);

  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [updateMsg, setUpdateMsg] = useState<Record<string, string>>({});

  const updateGrievance = async (id: string, newStatus: string, resolution = resolutions[id] || "") => {
    setUpdating((prev) => ({ ...prev, [id]: true }));

    // Optimistic update
    setGrievances((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus, resolution } : item)),
    );

    try {
      const response = await api.patch(`/api/grievances/${id}/status`, {
        status: newStatus,
        resolution,
      });
      if (response.data) {
        const updated = { ...response.data, id: response.data.id || id };
        setGrievances((prev) =>
          prev.map((item) => (item.id === id ? updated : item)),
        );
        setUpdateMsg((prev) => ({ ...prev, [id]: "✓ Saved" }));
        setTimeout(() => setUpdateMsg((prev) => ({ ...prev, [id]: "" })), 2000);
      }
    } catch (err) {
      console.error("Failed to update grievance:", err);
      setUpdateMsg((prev) => ({ ...prev, [id]: "✗ Failed" }));
      setTimeout(() => setUpdateMsg((prev) => ({ ...prev, [id]: "" })), 3000);
    } finally {
      setUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className={hrPageWrap}>
      <div className="mx-auto max-w-[1280px]">
        <div className="rounded-lg p-4" style={card}>
          <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full min-w-[1180px] text-sm">
              <thead style={tableHead}>
                <tr>
                  {["Employee", "Subject", "Category", "Priority", "Status", "Submitted", "Resolution", "Action"].map((column) => (
                    <th key={column} className="px-4 py-4 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredGrievances.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-4 py-4">
                      <p className="font-semibold" style={textPrimary}>
                        {item.employee_name || item.employee_id || "-"}
                      </p>
                      <p className="mt-1 text-xs" style={textSecondary}>
                        {item.employee_email || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold" style={textPrimary}>
                        {item.subject}
                      </p>
                      <p className="mt-1 max-w-[260px] truncate text-xs" style={textSecondary}>
                        {item.description}
                      </p>
                    </td>
                    <td className="px-4 py-4" style={textSecondary}>
                      {item.category}
                    </td>
                    <td className="px-4 py-4" style={textSecondary}>
                      {item.priority}
                    </td>
                    <td className="px-4 py-4 min-w-[170px]">
                      <ConstrainedDropdown
                        value={item.status}
                        options={statuses}
                        onChange={(value) => updateGrievance(item.id, value)}
                        buttonStyle={{
                          ...getStatusStyle(item.status),
                          border: "none",
                          minHeight: "34px",
                          height: "34px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      />
                    </td>
                    <td className="px-4 py-4" style={textSecondary}>
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-4 py-4 min-w-[240px]">
                      <input
                        value={resolutions[item.id] || ""}
                        onChange={(event) =>
                          setResolutions((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                        placeholder="Add HR resolution"
                        className="w-full rounded-lg px-3 py-2 outline-none"
                        style={inputMuted}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateGrievance(item.id, item.status, resolutions[item.id] || "")}
                          disabled={updating[item.id]}
                          className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold"
                          style={{ ...btnPrimary, opacity: updating[item.id] ? 0.65 : 1 }}
                          aria-label="Save resolution"
                        >
                          {updating[item.id] ? "Saving…" : "Update"}
                        </button>
                        {updateMsg[item.id] && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: updateMsg[item.id].startsWith("✓") ? "#10b981" : "#ef4444",
                            }}
                          >
                            {updateMsg[item.id]}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredGrievances.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-sm italic text-center" style={textSecondary}>
                      No grievances found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
