import { Download, Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/button/Button";
import PaginationControls from "../../components/PaginationControls";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import api from "../../utils/axiosInstance";

type InterviewRow = {
  id: string;
  candidate: {
    name: string;
    role: string;
    avatarColor: string;
  };
  datetime: string;
  duration: string;
  type: string;
  status: string;
};

type RawInterview = {
  id?: string | number;
  _id?: string | number;
  candidate?: { name?: string; role?: string; avatarColor?: string };
  candidateName?: string;
  name?: string;
  role?: string;
  position?: string;
  datetime?: string;
  scheduledAt?: string;
  date?: string;
  duration?: string;
  type?: string;
  round?: string;
  status?: string | number;
};

const PAGE_SIZE = 10;

export default function Interviews() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState<InterviewRow[]>([]);
  const [search] = useTopHeaderSearch();
  const navigate = useNavigate();
  const tabs = [
    { key: "upcoming", label: "Upcoming", badge: rows.filter((row) => row.status === "pending" || row.status === "upcoming").length },
    { key: "completed", label: "Completed", badge: rows.filter((row) => row.status === "approved" || row.status === "completed").length },
    { key: "cancelled", label: "Cancelled", badge: rows.filter((row) => row.status === "rejected" || row.status === "cancelled").length },
  ];

  useEffect(() => {
    api.get("/api/interviews")
      .then((response) => {
        const rawRows = Array.isArray(response.data)
          ? response.data
          : response.data?.interviews || response.data?.data || [];
        setRows(rawRows.map((row: RawInterview, index: number): InterviewRow => ({
          id: String(row.id || row._id || index + 1),
          candidate: {
            name: row.candidate?.name || row.candidateName || row.name || "Candidate",
            role: row.candidate?.role || row.role || row.position || "Interview",
            avatarColor: row.candidate?.avatarColor || "#888888",
          },
          datetime: row.datetime || row.scheduledAt || row.date || "-",
          duration: row.duration || "—",
          type: row.type || row.round || "Interview",
          status: String(row.status || "pending").toLowerCase(),
        })));
      })
      .catch(() => setRows([]));
  }, []);

  const visibleRows = useMemo(() => {
    const statusRows =
      activeTab === "completed"
        ? rows.filter((row) => row.status === "approved" || row.status === "completed")
        : activeTab === "cancelled"
          ? rows.filter((row) => row.status === "rejected" || row.status === "cancelled")
          : rows.filter((row) => row.status === "pending" || row.status === "upcoming");
    const query = search.trim().toLowerCase();
    if (!query) return statusRows;
    return statusRows.filter((row) =>
      [
        row.id,
        row.candidate.name,
        row.candidate.role,
        row.datetime,
        row.duration,
        row.type,
        row.status,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [activeTab, search, rows]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedRows = visibleRows.slice(pageStart, pageEnd);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  };

  const exportCSV = () => {
    const headers = ["ID", "Candidate Name", "Role", "Date & Time", "Duration", "Interview Type", "Status"];
    const rows = visibleRows.map(r => [
      r.id,
      r.candidate.name,
      r.candidate.role,
      r.datetime,
      r.duration,
      r.type,
      r.status,
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interviews_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in px-2 sm:px-4">
      <div className="mb-4 flex justify-end">
        <Button
          onClick={exportCSV}
          style={{
            width: "auto",
            padding: "0.625rem 1.25rem",
            display: "inline-flex",
            gap: "0.5rem",
            flexShrink: 0,
          }}
        >
          <Download size={15} /> Export CSV
        </Button>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Tabs */}
        <div
          className="flex flex-wrap overflow-hidden gap-4 sm:gap-8 px-4 sm:px-6"
          style={{ borderBottom: "1px solid var(--border)", scrollbarWidth: "none" }}
        >
          {tabs.map(({ key, label, badge }) => (
            <div
              key={key}
              onClick={() => setActiveTab(key)}
              className="py-4 shrink-0 cursor-pointer text-sm font-medium transition-colors border-b-2 flex items-center gap-2"
              style={{
                borderBottomColor:
                  activeTab === key ? "var(--accent)" : "transparent",
                color:
                  activeTab === key ? "var(--accent)" : "var(--text-secondary)",
                marginBottom: "-1px",
              }}
            >
              {label}
              {badge && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{
                    background:
                      activeTab === key
                        ? "var(--icon-accent-bg)"
                        : "var(--bg-hover)",
                    color:
                      activeTab === key
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                  }}
                >
                  {badge}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto px-4 sm:px-6 pt-4 pb-6">
          <table
            className="w-full text-left border-collapse"
            style={{ minWidth: "640px" }}
          >
            <thead>
              <tr
                className="text-xs font-semibold"
                style={{
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <th className="py-4 px-4 rounded-l-xl">ID</th>
                <th className="py-4 px-4">Candidate</th>
                <th className="py-4 px-4">Date & Time</th>
                <th className="py-4 px-4">Duration</th>
                <th className="py-4 px-4">Interview Type</th>
                <th className="py-4 px-4 text-center rounded-r-xl">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr
                  key={row.id}
                  className="text-sm transition-colors"
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <td
                    className="py-4 px-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {row.id}
                  </td>

                  <td className="py-4 px-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-semibold text-sm text-white"
                        style={{ background: row.candidate.avatarColor }}
                      >
                        {row.candidate.name.charAt(0)}
                      </div>
                      <div>
                        <div
                          className="font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {row.candidate.name}
                        </div>
                        <div
                          className="text-xs mt-0.5"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {row.candidate.role}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td
                    className="py-4 px-2 font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {row.datetime}
                  </td>
                  <td
                    className="py-4 px-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {row.duration}
                  </td>
                  <td
                    className="py-4 px-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {row.type}
                  </td>

                  <td className="py-4 px-2">
                    {row.status === "pending" && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate("/interview/live")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                          style={{
                            border: "1px solid var(--border)",
                            color: "var(--text-primary)",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "var(--bg-hover)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          Start <Check size={13} />
                        </button>
                        <button
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                          style={{
                            border: "1px solid var(--border)",
                            color: "var(--text-secondary)",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "var(--bg-hover)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                    {row.status === "rejected" && (
                      <div
                        className="flex items-center justify-center gap-1.5 text-sm font-medium"
                        style={{ color: "#ef4444" }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: "#ef4444" }}
                        />
                        Cancelled
                      </div>
                    )}
                    {row.status === "approved" && (
                      <div
                        className="flex items-center justify-center gap-1.5 text-sm font-medium"
                        style={{ color: "#22c55e" }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: "#22c55e" }}
                        />
                        Completed
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {paginatedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    No interviews found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {visibleRows.length > 0 && (
          <PaginationControls
            currentPage={safeCurrentPage}
            totalItems={visibleRows.length}
            pageSize={PAGE_SIZE}
            itemLabel="interviews"
            onPageChange={goToPage}
          />
        )}
      </div>
    </div>
  );
}
