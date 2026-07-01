
import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import PageHeader from "../../components/hrDashboard/PageHeader";
import { ClipboardList, Trash2, Edit2, CheckCircle2, Clock } from "lucide-react";
import "./Reports.css";

interface Report {
  id: number;
  name: string;
  description: string;
  status: string;
  date: string;
}

function Reports() {
  const { isDark } = useTheme();
  const userName = localStorage.getItem("userName") || "HR";
  const avatarLetter = userName.charAt(0).toUpperCase();

  const [reports, setReports] = useState<Report[]>([
    {
      id: 1,
      name: "Attendance Report",
      description: "Summary of employee attendance",
      status: "Generated",
      date: "26 May, 2024"
    },
    {
      id: 2,
      name: "Employee Performance",
      description: "Performance overview of employees",
      status: "Pending",
      date: "25 May, 2024"
    },
    {
      id: 3,
      name: "Salary Report",
      description: "Monthly salary breakdown",
      status: "Generated",
      date: "24 May, 2024"
    }
  ]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const generateReport = () => {
    const newReport: Report = {
      id: reports.length + 1,
      name: `New Report ${reports.length + 1}`,
      description: "Auto generated report",
      status: "Generated",
      date: new Date().toLocaleDateString()
    };
    setReports([...reports, newReport]);
  };

  const deleteReport = (id: number) => {
    setReports(reports.filter((report) => report.id !== id));
  };

  const startEdit = (report: Report) => {
    setEditingId(report.id);
    setEditName(report.name);
  };

  const saveEdit = (id: number) => {
    setReports(
      reports.map((report) =>
        report.id === id
          ? { ...report, name: editName }
          : report
      )
    );
    setEditingId(null);
  };

  const totalReports = reports.length;
  const generatedReports = reports.filter((r) => r.status === "Generated").length;
  const pendingReports = reports.filter((r) => r.status === "Pending").length;

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto py-4 sm:py-6">
        
        {/* Header */}
        <PageHeader
          icon={<ClipboardList className="w-5 h-5" style={{ color: "var(--accent)" }} />}
          title="Reports"
          userName={userName}
          avatarLetter={avatarLetter}
          isDark={isDark}
          onToggleTheme={() => {}}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
          {/* Total Reports Card */}
          <div
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
            }}
            className="rounded-xl p-4 sm:p-6 border"
          >
            <div className="flex items-center gap-4">
              <div style={{ backgroundColor: "var(--icon-accent-bg)" }} className="p-3 rounded-lg">
                <ClipboardList size={24} style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>Total Reports</p>
                <h2 className="text-2xl sm:text-3xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>{totalReports}</h2>
              </div>
            </div>
          </div>

          {/* Generated Card */}
          <div
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
            }}
            className="rounded-xl p-4 sm:p-6 border"
          >
            <div className="flex items-center gap-4">
              <div style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }} className="p-3 rounded-lg">
                <CheckCircle2 size={24} style={{ color: "#22c55e" }} />
              </div>
              <div>
                <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>Generated</p>
                <h2 className="text-2xl sm:text-3xl font-bold mt-1" style={{ color: "#22c55e" }}>{generatedReports}</h2>
              </div>
            </div>
          </div>

          {/* Pending Card */}
          <div
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
            }}
            className="rounded-xl p-4 sm:p-6 border"
          >
            <div className="flex items-center gap-4">
              <div style={{ backgroundColor: "rgba(245, 158, 11, 0.1)" }} className="p-3 rounded-lg">
                <Clock size={24} style={{ color: "#f59e0b" }} />
              </div>
              <div>
                <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>Pending</p>
                <h2 className="text-2xl sm:text-3xl font-bold mt-1" style={{ color: "#f59e0b" }}>{pendingReports}</h2>
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="mb-6">
          <button
            onClick={generateReport}
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-text)",
            }}
            className="px-4 sm:px-6 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition"
          >
            + Generate Report
          </button>
        </div>

        {/* Reports List */}
        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
          }}
          className="rounded-xl p-4 sm:p-6 border"
        >
          <h2 className="text-lg sm:text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>Reports List</h2>

          <div className="space-y-2">
            {reports.map((report) => (
              <div
                key={report.id}
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border)",
                }}
                className="rounded-lg p-3 sm:p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-(--text-secondary) transition"
              >
                <div className="flex-1 w-full">
                  <div className="flex items-start gap-3">
                    <span style={{ color: "var(--text-secondary)" }} className="font-bold text-sm min-w-fit">#{report.id}</span>
                    <div className="flex-1 min-w-0">
                      {editingId === report.id ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{
                            backgroundColor: "var(--bg-secondary)",
                            borderColor: "var(--border)",
                            color: "var(--text-primary)",
                          }}
                          className="w-full px-2 py-1 rounded border text-sm outline-none"
                          autoFocus
                        />
                      ) : (
                        <>
                          <h4 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{report.name}</h4>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{report.description}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto text-xs sm:text-sm">
                  <span
                    style={{
                      backgroundColor: report.status === "Generated" ? "rgba(34, 197, 94, 0.1)" : "rgba(245, 158, 11, 0.1)",
                      color: report.status === "Generated" ? "#22c55e" : "#f59e0b",
                    }}
                    className="px-2 py-1 rounded whitespace-nowrap font-medium"
                  >
                    {report.status}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }} className="whitespace-nowrap">{report.date}</span>

                  <div className="flex gap-1 ml-auto sm:ml-0">
                    {editingId === report.id ? (
                      <button
                        onClick={() => saveEdit(report.id)}
                        className="p-1.5 rounded hover:opacity-70 transition"
                        style={{ color: "#22c55e" }}
                        title="Save"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => startEdit(report)}
                        className="p-1.5 rounded hover:opacity-70 transition"
                        style={{ color: "var(--accent)" }}
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="p-1.5 rounded hover:opacity-70 transition"
                      style={{ color: "#ef4444" }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
