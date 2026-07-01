import axios from "axios";
import { Area, AreaChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { useEffect, useMemo, useState } from "react";
import { Activity, CheckSquare, Clock, BatteryWarning, AlertTriangle, BrainCircuit, Download } from "lucide-react";

interface DashboardData {
  productivity_trends?: any[];
  team_performance?: any[];
  risk_employees?: any[];
  activity_log?: any[];
}

export default function AIAnalytics() {

  const { isDark } = useTheme();

  const [dashboardData, setDashboardData] = useState<DashboardData>({} as DashboardData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchDashboardData = async () => {
      try {
        const response = await axios.get<DashboardData>("http://127.0.0.1:8000/dashboard/analytics");
        if (active) {
          setDashboardData(response.data);
        }
      } catch (error) {
        console.error("Analytics API error:", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDashboardData();
    return () => { active = false; };
  }, []);



  // Extract data for charts and tables from dashboardData
  const textColor = "var(--text-secondary)";
  const gridColor = "var(--border)";
  const tooltipStyle = { background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: "0.5rem", fontSize: "0.85rem", padding: "0.5rem" };
  const productivityTrends = dashboardData.productivity_trends ?? [];
  const teamPerformanceData = dashboardData.team_performance ?? [];
  const riskEmployees = dashboardData.risk_employees ?? [];
  const activityLog = dashboardData.activity_log ?? [];
  

  return (
    <div
      className="animate-fade-in"
      style={{ width: "100%", maxWidth: "none", padding: "0 0.5rem", margin: 0 }}
    >


      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Avg Work Activity",
            value: "78%",
            icon: <Activity size={18} />,
            color: "var(--accent)",
            trend: "âˆ’5% this week",
          },
          {
            label: "Task Completion",
            value: "92%",
            icon: <CheckSquare size={18} />,
            color: "var(--accent)",
            trend: "+2% this week",
          },
          {
            label: "Avg Active Hours",
            value: "7.2 hrs",
            icon: <Clock size={18} />,
            color: "var(--accent)",
            trend: "Stable",
          },
          {
            label: "Overall Burnout Risk",
            value: "24%",
            icon: <BatteryWarning size={18} />,
            color: "var(--accent)",
            trend: "Elevated",
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {kpi.label}
              </span>
              <div
                style={{
                  color: "var(--accent)",
                  background: "var(--icon-accent-bg)",
                  padding: "0.4rem",
                  borderRadius: "0.5rem",
                }}
              >
                {kpi.icon}
              </div>
            </div>
            <div
              className="text-2xl font-bold mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              {kpi.value}
            </div>
            <div
              className="text-xs font-medium"
              style={{
                color: "var(--text-secondary)",
              }}
            >
              {kpi.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Productivity Trends */}
        <div
          className="lg:col-span-2 rounded-2xl p-5"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <h3
            className="text-base font-semibold mb-4 flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}
          >
            <Activity size={18} style={{ color: "var(--accent)" }} /> Productivity &
            Task Trends
          </h3>
          <div style={{ height: "300px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={productivityTrends}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorWork" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isDark ? "#ffffff" : "#111111"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={isDark ? "#ffffff" : "#111111"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  stroke={textColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={textColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={gridColor}
                />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="workActivity"
                  stroke={isDark ? "#ffffff" : "#111111"}
                  fillOpacity={1}
                  fill="url(#colorWork)"
                  name="Work Activity %"
                />
                <Line
                  type="monotone"
                  dataKey="taskCompletion"
                  stroke={isDark ? "#888888" : "#888888"}
                  strokeWidth={2}
                  name="Task Completion %"
                />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke="var(--text-secondary)"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="Expected Baseline"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Team Performance Radar */}
        <div
          className="rounded-2xl p-5 flex flex-col"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <h3
            className="text-base font-semibold mb-2 flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}
          >
            <BrainCircuit size={18} style={{ color: "var(--accent)" }} /> Team
            Performance Index
          </h3>
          <p
            className="text-xs mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            Comparing Output (Blue) vs Expected (Purple)
          </p>
          <div style={{ flex: 1, width: "100%", minHeight: "250px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="70%"
                data={teamPerformanceData}
              >
                <PolarGrid stroke={gridColor} />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: textColor, fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 150]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name="Actual Output"
                  dataKey="A"
                  stroke={isDark ? "#ffffff" : "#111111"}
                  fill={isDark ? "#ffffff" : "#111111"}
                  fillOpacity={0.5}
                />
                <Radar
                  name="Expected Target"
                  dataKey="B"
                  stroke={isDark ? "#888888" : "#888888"}
                  fill={isDark ? "#888888" : "#888888"}
                  fillOpacity={0.2}
                />
                <RechartsTooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI Risk Predictions & Activity Log Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* AI Risk Predictions */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h3
              className="text-base font-semibold mb-4 flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <AlertTriangle size={18} style={{ color: "var(--text-secondary)" }} /> AI
              Predictive Risk Alerts
            </h3>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {riskEmployees.map((emp) => (
              <div
                key={emp.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: "1rem",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "1rem" }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{
                      background: "var(--icon-accent-bg)",
                      color: "var(--accent)",
                    }}
                  >
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        fontSize: "0.875rem",
                      }}
                    >
                      {emp.name}
                    </div>
                    <div
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.75rem",
                      }}
                    >
                      {emp.role}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      justifyContent: "flex-end",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {emp.risk} Risk
                    </span>
                    <span
                      style={{
                        background: "var(--bg-secondary)",
                        padding: "0.125rem 0.5rem",
                        borderRadius: "1rem",
                        fontSize: "0.75rem",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {emp.probability}%
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Detected: {emp.metric}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time Activity Log */}
        <div
          className="rounded-2xl p-5 flex flex-col"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h3
              className="text-base font-semibold flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <Clock size={18} style={{ color: "var(--accent)" }} /> Live Activity
              Stream
            </h3>
            <button
              style={{
                background: "var(--accent)",
                border: "1px solid var(--border)",
                color: "var(--accent-text)",
                padding: "0.375rem 0.75rem",
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <Download size={14} /> Export Log
            </button>
          </div>

          <div className="overflow-x-auto px-4 sm:px-6 pt-4 pb-6">
            <table
              className="w-full text-left border-collapse"
              style={{ minWidth: "340px" }}
            >
              <thead>
                <tr
                  className="text-xs font-semibold"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <th className="py-4 px-4 rounded-l-xl">Employee</th>
                  <th className="py-4 px-4">Latest Action</th>
                  <th className="py-4 px-4">Time</th>
                  <th className="py-4 px-4 text-center rounded-r-xl">AI Flag</th>
                </tr>
              </thead>
              <tbody>
                {activityLog.map((log, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom:
                        idx !== activityLog.length - 1
                          ? "1px solid var(--border)"
                          : "none",
                    }}
                  >
                    <td
                      style={{
                        padding: "1rem 0",
                        fontSize: "0.875rem",
                        color: "var(--text-primary)",
                        fontWeight: 500,
                      }}
                    >
                      {log.name}
                    </td>
                    <td
                      style={{
                        padding: "1rem 0",
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {log.action}
                    </td>
                    <td
                      style={{
                        padding: "1rem 0",
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {log.time}
                    </td>
                    <td style={{ padding: "1rem 0" }}>
                      <span
                        style={{
                          padding: "0.25rem 0.625rem",
                          borderRadius: "1rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background:
                            log.status === "Overworking"
                              ? "rgba(239,68,68,0.1)"
                              : log.status === "High Output"
                                ? "rgba(16,185,129,0.1)"
                                : "var(--bg-hover)",
                          color:
                            log.status === "Overworking"
                              ? "#ef4444"
                              : log.status === "High Output"
                                ? "#10b981"
                                : "var(--text-secondary)",
                        }}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}