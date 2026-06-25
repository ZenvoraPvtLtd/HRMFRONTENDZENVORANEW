import { useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import {
  Activity,
  BrainCircuit,
  CalendarCheck,
  Clock,
  ClipboardList,
  Globe,
  RefreshCw,
  ShieldAlert,
  Star,
  Target,
  TrendingUp,
  UserMinus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "../../context/ThemeContext";

interface MetricItem {
  label: string;
  value: string;
  change?: string;
  color?: string;
}

interface PerformanceItem {
  dept: string;
  score: string;
  status: string;
}

interface HeatmapRow {
  team: string;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5: number;
}

interface DashboardData {
  kpi_metrics?: MetricItem[];
  workforce_data?: MetricItem[];
  attrition_data?: MetricItem[];
  attendance_data?: MetricItem[];
  performance_index?: PerformanceItem[];
  team_heatmap_data?: HeatmapRow[];
}

const fallbackDashboardData: Required<DashboardData> = {
  kpi_metrics: [
    { label: "AI Hiring Success", value: "94.2%", change: "+2.4% vs last month", color: "var(--accent)" },
    { label: "Predicted Attrition", value: "4.8%", change: "-1.2% vs last month", color: "var(--accent)" },
    { label: "Workforce Efficiency", value: "87.5%", change: "+5.1% vs last month", color: "var(--accent)" },
    { label: "Avg Time to Hire", value: "14 Days", change: "3 days faster", color: "var(--accent)" },
  ],
  workforce_data: [
    { label: "Total Employees", value: "342", change: "+18 this quarter", color: "var(--accent)" },
    { label: "Retention Rate", value: "94.2%", change: "+1.8%", color: "var(--accent)" },
    { label: "Diversity Index", value: "78%", change: "+4.2%", color: "var(--accent)" },
    { label: "Open Positions", value: "27", change: "8 urgent", color: "var(--accent)" },
  ],
  attrition_data: [
    { label: "Low Risk", value: "72%", color: "#10b981" },
    { label: "Medium Risk", value: "19%", color: "#f59e0b" },
    { label: "High Risk", value: "9%", color: "#ef4444" },
  ],
  attendance_data: [
    { label: "Average Present", value: "92%", change: "+3.1%" },
    { label: "Average Absent", value: "8%", change: "-1.4%" },
  ],
  performance_index: [
    { dept: "Engineering", score: "91", status: "Excellent" },
    { dept: "HR", score: "84", status: "Good" },
    { dept: "Sales", score: "76", status: "Average" },
    { dept: "Support", score: "88", status: "Good" },
    { dept: "Design", score: "93", status: "Excellent" },
    { dept: "Finance", score: "81", status: "Good" },
  ],
  team_heatmap_data: [
    { team: "Engineering", d1: 5, d2: 4, d3: 5, d4: 4, d5: 5 },
    { team: "HR", d1: 4, d2: 4, d3: 3, d4: 5, d5: 4 },
    { team: "Sales", d1: 3, d2: 4, d3: 3, d4: 4, d5: 3 },
    { team: "Support", d1: 4, d2: 5, d3: 4, d4: 4, d5: 5 },
  ],
};

const hiringTrendsData = [
  { month: "Jan", applicants: 210, hired: 24 },
  { month: "Feb", applicants: 260, hired: 31 },
  { month: "Mar", applicants: 240, hired: 28 },
  { month: "Apr", applicants: 310, hired: 36 },
  { month: "May", applicants: 340, hired: 41 },
  { month: "Jun", applicants: 390, hired: 46 },
];

const performanceChartData = [
  { name: "Eng", score: 91 },
  { name: "HR", score: 84 },
  { name: "Sales", score: 76 },
  { name: "Support", score: 88 },
  { name: "Design", score: 93 },
];

const attendanceTrendData = [
  { day: "Mon", present: 94, absent: 6 },
  { day: "Tue", present: 91, absent: 9 },
  { day: "Wed", present: 93, absent: 7 },
  { day: "Thu", present: 89, absent: 11 },
  { day: "Fri", present: 92, absent: 8 },
];

const iconMap: Record<string, ReactNode> = {
  "AI Hiring Success": <Target size={20} />,
  "Predicted Attrition": <UserMinus size={20} />,
  "Workforce Efficiency": <Activity size={20} />,
  "Avg Time to Hire": <Clock size={20} />,
  "Total Employees": <Users size={20} />,
  "Retention Rate": <RefreshCw size={20} />,
  "Diversity Index": <Globe size={20} />,
  "Open Positions": <ClipboardList size={20} />,
};

const getIcon = (label: string) => iconMap[label] ?? <BrainCircuit size={20} />;

export default function PredictiveAnalyticsPage() {
  const { isDark } = useTheme();
  const [dashboardData, setDashboardData] = useState<DashboardData>(fallbackDashboardData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchDashboardData = async () => {
      try {
const response = await axios.get<DashboardData>("http://127.0.0.1:8000/manager/productivity/predictions?start_date=2023-01-01&end_date=2023-12-31");
        if (active) {
          setDashboardData({ ...fallbackDashboardData, ...response.data });
        }
      } catch (error) {
        console.error("Predictive analytics API error:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      active = false;
    };
  }, []);

  const chartColors = useMemo(
    () => ({
      primary: isDark ? "#ffffff" : "#111111",
      secondary: "#888888",
      grid: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
      text: isDark ? "#d1d5db" : "#4b5563",
      tooltip: {
        backgroundColor: isDark ? "#111111" : "#ffffff",
        border: "1px solid var(--border)",
        color: isDark ? "#ffffff" : "#111111",
      },
    }),
    [isDark]
  );

  const kpis = dashboardData.kpi_metrics ?? fallbackDashboardData.kpi_metrics;
  const workforce = dashboardData.workforce_data ?? fallbackDashboardData.workforce_data;
  const attrition = dashboardData.attrition_data ?? fallbackDashboardData.attrition_data;
  const attendance = dashboardData.attendance_data ?? fallbackDashboardData.attendance_data;
  const performance = dashboardData.performance_index ?? fallbackDashboardData.performance_index;
  const heatmap = dashboardData.team_heatmap_data ?? fallbackDashboardData.team_heatmap_data;

  return (
    <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto py-3 sm:py-5 overflow-x-hidden">


      {loading && (
        <div className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading latest analytics...
        </div>
      )}

      <div className="grid grid-cols-1 xs:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5 mb-5 sm:mb-6">
        {kpis.map((kpi) => {
          const color = kpi.color ?? "var(--accent)";
          return (
            <div key={kpi.label} className="rounded-2xl sm:rounded-3xl p-4 sm:p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
                  {getIcon(kpi.label)}
                </div>
                <span className="text-xs font-medium text-right" style={{ color: "var(--text-secondary)" }}>
                  {kpi.label}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                {kpi.value}
              </h2>
              {kpi.change && <p className="text-sm text-green-500 font-medium">{kpi.change}</p>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mb-5 sm:mb-6">
        <section className="rounded-2xl sm:rounded-3xl p-4 sm:p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <TrendingUp size={18} />
            Hiring Trends Forecast
          </h3>
          <div style={{ height: 260, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hiringTrendsData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="month" stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartColors.tooltip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                <Line type="monotone" dataKey="applicants" stroke={chartColors.primary} strokeWidth={3} dot={{ r: 4 }} name="Applicants" />
                <Line type="monotone" dataKey="hired" stroke={chartColors.secondary} strokeWidth={3} dot={{ r: 4 }} name="Hired" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl sm:rounded-3xl p-4 sm:p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Activity size={18} />
            Employee Performance Index
          </h3>
          <div style={{ height: 260, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="name" stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={chartColors.tooltip} cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="score" fill={chartColors.primary} radius={[4, 4, 0, 0]} barSize={38} name="Avg Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section className="rounded-3xl p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <ShieldAlert size={18} />
            Attrition Risk Overview
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div style={{ height: 220, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={attrition} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={4}>
                    {attrition.map((item) => (
                      <Cell key={item.label} fill={item.color ?? "var(--accent)"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartColors.tooltip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {attrition.map((item) => {
                const color = item.color ?? "var(--accent)";
                return (
                  <div key={item.label} className="rounded-2xl p-4" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                    <div className="text-sm mb-1" style={{ color }}>{item.label}</div>
                    <div className="text-2xl font-bold" style={{ color }}>{item.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-3xl p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <CalendarCheck size={18} />
            Weekly Attendance Overview
          </h3>
          <div style={{ height: 220, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrendData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="day" stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={chartColors.text} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartColors.tooltip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                <Area type="monotone" dataKey="present" stackId="1" stroke={chartColors.primary} fill={chartColors.primary} fillOpacity={0.45} name="Present (%)" />
                <Area type="monotone" dataKey="absent" stackId="1" stroke={chartColors.secondary} fill={chartColors.secondary} fillOpacity={0.45} name="Absent (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {attendance.map((item) => {
              const isPresent = item.label === "Average Present";
              const color = isPresent ? "#10b981" : "#ef4444";
              return (
                <div key={item.label} className="rounded-2xl p-4" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                  <div className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{item.label}</div>
                  <div className="text-3xl font-bold mb-1" style={{ color }}>{item.value}</div>
                  {item.change && <div className={`text-sm font-medium ${isPresent ? "text-green-500" : "text-red-500"}`}>{item.change}</div>}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <section className="rounded-3xl p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Star size={18} />
            Employee Performance Overview
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {performance.map((item) => (
              <div key={item.dept} className="rounded-2xl p-5 text-center" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                <div className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>{item.dept}</div>
                <div className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{item.score}</div>
                <div className={`text-xs font-semibold ${item.status === "Excellent" ? "text-green-500" : item.status === "Average" ? "text-orange-500" : "text-blue-500"}`}>
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Users size={18} />
            Team Productivity Overview
          </h3>
          <div className="overflow-x-auto scrollbar-thin pb-2">
            <table className="min-w-[560px] w-full">
              <thead>
                <tr style={{ color: "var(--text-secondary)" }}>
                  <th className="text-left p-3 text-sm">Team</th>
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
                    <th key={day} className="text-center p-3 text-sm">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.map((row) => (
                  <tr key={row.team} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="p-3 font-semibold" style={{ color: "var(--text-primary)" }}>{row.team}</td>
                    {[row.d1, row.d2, row.d3, row.d4, row.d5].map((value, index) => {
                      const color = value >= 4 ? "#10b981" : value === 3 ? "#f59e0b" : "#ef4444";
                      return (
                        <td key={index} className="p-3">
                          <div className="rounded-lg sm:rounded-xl h-9 sm:h-10 flex items-center justify-center font-semibold text-xs sm:text-sm" style={{ background: `${color}15`, color }}>
                            {value * 20}%
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-3xl p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <BrainCircuit size={18} />
          Workforce Snapshot
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {workforce.map((item) => {
            const color = item.color ?? "var(--accent)";
            return (
              <div key={item.label} className="rounded-2xl p-4 sm:p-5" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${color}15`, color }}>
                  {getIcon(item.label)}
                </div>
                <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>{item.value}</div>
                <div className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{item.label}</div>
                {item.change && <div className="text-sm text-green-500 font-medium">{item.change}</div>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}