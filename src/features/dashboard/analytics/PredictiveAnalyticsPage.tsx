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

import { useTheme } from "../../../context/ThemeContext";

interface MetricItem {
  label: string;
  value: string | number;
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
    {
      label: "AI Hiring Success",
      value: "94.2%",
      change: "+2.4% vs last month",
      color: "#06b6d4",
    },
    {
      label: "Predicted Attrition",
      value: "4.8%",
      change: "-1.2% vs last month",
      color: "#8b5cf6",
    },
    {
      label: "Workforce Efficiency",
      value: "87.5%",
      change: "+5.1% vs last month",
      color: "#10b981",
    },
    {
      label: "Avg Time to Hire",
      value: "14 Days",
      change: "3 days faster",
      color: "#f59e0b",
    },
  ],

  workforce_data: [
    {
      label: "Total Employees",
      value: "342",
      change: "+18 this quarter",
      color: "#06b6d4",
    },
    {
      label: "Retention Rate",
      value: "94.2%",
      change: "+1.8%",
      color: "#8b5cf6",
    },
    {
      label: "Diversity Index",
      value: "78%",
      change: "+4.2%",
      color: "#10b981",
    },
    {
      label: "Open Positions",
      value: "27",
      change: "8 urgent",
      color: "#f59e0b",
    },
  ],

  attrition_data: [

    {
      label: "Low Risk",
      value: 72,
      color: "#10b981",
    },
    {
      label: "Medium Risk",
      value: 19,
      color: "#f59e0b",
    },
    {
      label: "High Risk",
      value: 9,
      color: "#ef4444",
    },
  ],

  attendance_data: [
    {
      label: "Average Present",
      value: "92%",
      change: "+3.1%",
    },
    {
      label: "Average Absent",
      value: "8%",
      change: "-1.4%",
    },
  ],

  performance_index: [
    {
      dept: "Engineering",
      score: "91",
      status: "Excellent",
    },
    {
      dept: "HR",
      score: "84",
      status: "Good",
    },
    {
      dept: "Sales",
      score: "76",
      status: "Average",
    },
    {
      dept: "Support",
      score: "88",
      status: "Good",
    },
    {
      dept: "Design",
      score: "93",
      status: "Excellent",
    },
    {
      dept: "Finance",
      score: "81",
      status: "Good",
    },
  ],

  team_heatmap_data: [
    {
      team: "Engineering",
      d1: 5,
      d2: 4,
      d3: 5,
      d4: 4,
      d5: 5,
    },
    {
      team: "HR",
      d1: 4,
      d2: 4,
      d3: 3,
      d4: 5,
      d5: 4,
    },
    {
      team: "Sales",
      d1: 3,
      d2: 4,
      d3: 3,
      d4: 4,
      d5: 3,
    },
    {
      team: "Support",
      d1: 4,
      d2: 5,
      d3: 4,
      d4: 4,
      d5: 5,
    },
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

const getIcon = (label: string) =>
  iconMap[label] ?? <BrainCircuit size={20} />;

export default function PredictiveAnalyticsPage() {
  const { isDark } = useTheme();

  const [dashboardData, setDashboardData] =
    useState<DashboardData>(fallbackDashboardData);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchDashboardData = async () => {
      try {
        const response = await axios.get<DashboardData>(
          "http://127.0.0.1:8000/dashboard/analytics"
        );

        if (active) {
          setDashboardData({
            ...fallbackDashboardData,
            ...response.data,
          });
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
      secondary: "#8b5cf6",
      grid: isDark
        ? "rgba(255,255,255,0.12)"
        : "rgba(0,0,0,0.1)",
      text: isDark ? "#d1d5db" : "#4b5563",

      tooltip: {
        backgroundColor: isDark ? "#111111" : "#ffffff",
        border: "1px solid #333",
        color: isDark ? "#ffffff" : "#111111",
      },
    }),
    [isDark]
  );
  const kpis =
    dashboardData.kpi_metrics &&
      dashboardData.kpi_metrics.length > 0
      ? dashboardData.kpi_metrics
      : fallbackDashboardData.kpi_metrics;

  const attrition =
    dashboardData.attrition_data &&
      dashboardData.attrition_data.length > 0
      ? dashboardData.attrition_data
      : fallbackDashboardData.attrition_data;
  console.log("Attrition Data:", attrition);
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">

      {loading && (
        <div className="text-sm mb-4 text-gray-400">
          Loading latest analytics...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-3xl p-6"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: `${kpi.color}15`,
                  color: kpi.color,
                }}
              >
                {getIcon(kpi.label)}
              </div>

              <span className="text-xs text-gray-400">
                {kpi.label}
              </span>
            </div>

            <h2 className="text-4xl font-bold mb-2">
              {kpi.value}
            </h2>

            {kpi.change && (
              <p className="text-green-500 text-sm">
                {kpi.change}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">

        <section
          className="rounded-3xl p-6"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <TrendingUp size={18} />
            Hiring Trends Forecast
          </h3>

          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hiringTrendsData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartColors.grid}
                />

                <XAxis dataKey="month" />
                <YAxis />

                <Tooltip contentStyle={chartColors.tooltip} />
                <Legend />

                <Line
                  type="monotone"
                  dataKey="applicants"
                  stroke="#06b6d4"
                  strokeWidth={3}
                />

                <Line
                  type="monotone"
                  dataKey="hired"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section
          className="rounded-3xl p-6"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Activity size={18} />
            Employee Performance Index
          </h3>

          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartColors.grid}
                />

                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />

                <Tooltip contentStyle={chartColors.tooltip} />

                <Bar
                  dataKey="score"
                  fill="#06b6d4"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        <section
          className="rounded-3xl p-6"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <ShieldAlert size={18} />
            Attrition Risk Overview
          </h3>

          <div className="text-sm text-red-500 mb-2">
            Data Count: {attrition.length}
          </div>

          <div style={{ width: "100%", height: 260 }}>
            <PieChart width={400} height={260}>
              <Pie
                data={attrition}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {attrition.map((item) => (
                  <Cell
                    key={item.label}
                    fill={item.color || "#8884d8"}
                  />
                ))}
              </Pie>

              <Tooltip />
              <Legend />
            </PieChart>
          </div>
        </section>

        <section
          className="rounded-3xl p-6"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <CalendarCheck size={18} />
            Weekly Attendance Overview
          </h3>

          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrendData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartColors.grid}
                />

                <XAxis dataKey="day" />
                <YAxis />

                <Tooltip contentStyle={chartColors.tooltip} />
                <Legend />

                <Area
                  type="monotone"
                  dataKey="present"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.5}
                />

                <Area
                  type="monotone"
                  dataKey="absent"
                  stackId="1"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div >
    </div >
  );
}