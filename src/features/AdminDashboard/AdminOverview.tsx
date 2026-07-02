import { useCallback, useEffect, useState } from "react";
import { 
  Users, 
  ShieldCheck, 
  Database, 
  UserX,
  Loader2,
  RefreshCw
} from "lucide-react";
import api from "../../utils/axiosInstance";

interface MetricsData {
  dbConnected: boolean;
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  roles: {
    admin: number;
    hr: number;
    manager: number;
    employee: number;
    candidate: number;
  };
  auditLogsCount: number;
  integrations: {
    gemini: boolean;
    whatsapp: boolean;
    smtp: boolean;
  };
}

export default function AdminOverview() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/api/admin/metrics");
      setMetrics(response.data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch admin metrics. Make sure you are logged in as an Admin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(fetchMetrics, 0);
    return () => window.clearTimeout(timer);
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="w-10 h-10 text-zinc-900 dark:text-zinc-100 animate-spin" />
        <p className="text-sm text-zinc-500">Loading system metrics...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-10">
        <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 p-4 rounded-xl mb-4 text-sm font-medium">
          {error || "Something went wrong."}
        </div>
        <button
          onClick={fetchMetrics}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-text)", border: "none" }}
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {/* Admin Dashboard Overview */}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {/* Monitor users, database, and central integration statuses. */}
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          className="p-2 border rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          title="Refresh metrics"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Users */}
        <div className="p-5 rounded-2xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Total Users</p>
              <h3 className="text-3xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>{metrics.totalUsers}</h3>
            </div>
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="text-xs mt-3 font-semibold" style={{ color: "var(--text-secondary)" }}>
            Active Accounts: {metrics.activeUsers}
          </div>
        </div>

        {/* Suspended Accounts */}
        <div className="p-5 rounded-2xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Suspended Users</p>
              <h3 className="text-3xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>{metrics.suspendedUsers}</h3>
            </div>
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-950 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
              <UserX className="w-6 h-6" />
            </div>
          </div>
          <div className="text-xs mt-3" style={{ color: "var(--text-secondary)" }}>
            Accounts with blocked login permissions
          </div>
        </div>

        {/* Database Connectivity */}
        <div className="p-5 rounded-2xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Database Status</p>
              <h3 className="text-2xl font-extrabold mt-2" style={{ color: "var(--text-primary)" }}>Online</h3>
            </div>
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
              <Database className="w-6 h-6" />
            </div>
          </div>
          <div className="text-xs mt-3" style={{ color: "var(--text-secondary)" }}>
            MongoDB Server connection is stable
          </div>
        </div>

        {/* Audit Log Count */}
        <div className="p-5 rounded-2xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Security Logs</p>
              <h3 className="text-3xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>{metrics.auditLogsCount}</h3>
            </div>
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
          <div className="text-xs mt-3" style={{ color: "var(--text-secondary)" }}>
            Total audit logs recorded this session
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Role Distribution */}
        <div className="lg:col-span-3 p-4 rounded-2xl border space-y-3" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>User Role Breakdown</h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Distribution of Zenvora portal user roles.</p>
          </div>

          <div className="space-y-2.5 pt-1">
            {[
              { roleName: "Administrators", code: "admin", count: metrics.roles.admin, color: "bg-zinc-900 dark:bg-zinc-100" },
              { roleName: "HR Managers", code: "hr", count: metrics.roles.hr, color: "bg-zinc-700 dark:bg-zinc-300" },
              { roleName: "Team Managers", code: "manager", count: metrics.roles.manager, color: "bg-zinc-500 dark:bg-zinc-500" },
              { roleName: "Employees", code: "employee", count: metrics.roles.employee, color: "bg-zinc-400 dark:bg-zinc-600" },
              { roleName: "Candidates", code: "candidate", count: metrics.roles.candidate, color: "bg-zinc-300 dark:bg-zinc-700" },
            ].map((item) => {
              const percentage = metrics.totalUsers > 0 ? Math.round((item.count / metrics.totalUsers) * 100) : 0;
              return (
                <div key={item.code} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span style={{ color: "var(--text-primary)" }}>{item.roleName}</span>
                    <span style={{ color: "var(--text-secondary)" }}>{item.count} ({percentage}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${percentage}%`, transition: "width 0.5s ease" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
