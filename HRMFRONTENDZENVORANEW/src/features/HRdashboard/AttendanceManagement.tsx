import {
  CheckCircle2,
  Clock3,
  Download,
  TrendingUp,
  UserCircle2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import {
  ATTENDANCE_STATUS_OPTIONS,
  fetchHrAttendance,
  type HrAttendanceRow,
  type HrAttendanceSummary,
  type HrEmployeeOption,
} from "../../services/attendanceApi";
import {
  btnSecondary,
  card,
  getStatusStyle,
  hrPageWrap,
  inputMuted,
  rowHover,
  tableHead,
  textPrimary,
  textSecondary,
} from "./hrTheme";

const tabs = ["Today", "This Week", "This Month", "Day", "Range"];
const filterStatuses = ["All", ...ATTENDANCE_STATUS_OPTIONS];

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(tab: string, date: string, rangeEnd: string) {
  const base = date ? new Date(`${date}T00:00:00`) : new Date();

  if (tab === "This Week") {
    const day = base.getDay() || 7;
    const start = new Date(base);
    start.setDate(base.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toDateKey(start), end: toDateKey(end), singleDay: false };
  }

  if (tab === "This Month") {
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { start: toDateKey(start), end: toDateKey(end), singleDay: false };
  }

  if (tab === "Range") {
    return { start: date, end: rangeEnd || date, singleDay: date === (rangeEnd || date) };
  }

  return { start: date, end: date, singleDay: true };
}

function formatDateLabel(start: string, end: string) {
  const fmt = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return start === end ? fmt(start) : `${fmt(start)} - ${fmt(end)}`;
}

export default function AttendanceManagement() {
  const [search] = useTopHeaderSearch();
  const [activeTab, setActiveTab] = useState("Today");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [rangeEnd, setRangeEnd] = useState(toDateKey(new Date()));
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All Departments");
  const [employeeFilter, setEmployeeFilter] = useState("All Employees");

  const [rows, setRows] = useState<HrAttendanceRow[]>([]);
  const [summary, setSummary] = useState<HrAttendanceSummary>({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    onLeave: 0,
  });
  const [departments, setDepartments] = useState<string[]>([]);
  const [employees, setEmployees] = useState<HrEmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedRange = useMemo(
    () => getDateRange(activeTab, date, rangeEnd),
    [activeTab, date, rangeEnd],
  );

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await fetchHrAttendance({
        start: selectedRange.start,
        end: selectedRange.end,
        status: statusFilter,
        department: departmentFilter,
        employeeId: employeeFilter,
        search,
        includeAbsent: selectedRange.singleDay,
      });

      setRows(result.data);
      setSummary(result.summary);
      setDepartments(result.departments);
      setEmployees(result.employees);
    } catch (requestError) {
      setRows([]);
      setError(requestError instanceof Error ? requestError.message : "Unable to load attendance");
    } finally {
      setLoading(false);
    }
  }, [selectedRange, statusFilter, departmentFilter, employeeFilter, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAttendance();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadAttendance]);

  const departmentOptions = useMemo(
    () => ["All Departments", ...departments],
    [departments],
  );

  const employeeOptions = useMemo(
    () => ["All Employees", ...employees.map((item) => item.name)],
    [employees],
  );

  const exportCsv = () => {
    const headers = ["Date", "Employee", "Department", "Status", "Clock In", "Clock Out", "Work Mode", "Shift", "Note"];
    const lines = rows.map((row) =>
      [row.date, row.name, row.department, row.status, row.clockIn, row.clockOut, row.workMode, row.shift, row.note]
        .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
        .join(","),
    );

    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `attendance-${selectedRange.start}${selectedRange.end !== selectedRange.start ? `-to-${selectedRange.end}` : ""}.csv`;
    link.click();
  };

  return (
    <div className={`${hrPageWrap} max-w-[1600px] mx-auto px-4 lg:px-6 py-6`}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={textPrimary}>Attendance Management</h1>
          <p className="text-sm mt-1" style={textSecondary}>
            View attendance for all employees — {formatDateLabel(selectedRange.start, selectedRange.end)}
          </p>
        </div>
        <button type="button" onClick={exportCsv} style={btnSecondary} className="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          <Download size={16} /> Export
        </button>
      </div>

      {error && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: "rgba(239,68,68,0.12)",
            color: "#ef4444",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <StatCard label="Total" value={summary.total} icon={<UserCircle2 size={18} />} />
        <StatCard label="Checked In" value={summary.checkedIn ?? 0} icon={<CheckCircle2 size={18} />} tone="success" />
        <StatCard label="On Time" value={summary.onTime ?? summary.present} icon={<CheckCircle2 size={18} />} tone="success" />
        <StatCard label="Late" value={summary.late} icon={<Clock3 size={18} />} tone="warning" />
        <StatCard label="Absent" value={summary.absent} icon={<XCircle size={18} />} tone="danger" />
        <StatCard label="Early Out" value={summary.earlyOut ?? 0} icon={<Clock3 size={18} />} />
        <StatCard label="Rate" value={`${summary.rate ?? 0}%`} icon={<TrendingUp size={18} />} tone="success" isText />
      </div>

      <div className="rounded-2xl p-4 mb-6" style={card}>
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={
                activeTab === tab
                  ? { background: "var(--accent)", color: "var(--accent-text)" }
                  : { background: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <Field label={activeTab === "Range" ? "Start Date" : "Date"}>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (activeTab !== "Range") setRangeEnd(e.target.value);
              }}
              style={inputMuted}
              className="w-full h-10 rounded-lg px-3 text-sm outline-none"
            />
          </Field>

          {activeTab === "Range" && (
            <Field label="End Date">
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                style={inputMuted}
                className="w-full h-10 rounded-lg px-3 text-sm outline-none"
              />
            </Field>
          )}

          <Field label="Status">
            <ConstrainedDropdown value={statusFilter} options={filterStatuses} onChange={setStatusFilter} />
          </Field>

          <Field label="Department">
            <ConstrainedDropdown value={departmentFilter} options={departmentOptions} onChange={setDepartmentFilter} />
          </Field>

          <Field label="Employee">
            <ConstrainedDropdown
              value={
                employeeFilter === "All Employees"
                  ? "All Employees"
                  : employees.find((item) => item.id === employeeFilter)?.name || "All Employees"
              }
              options={employeeOptions}
              onChange={(value) => {
                if (value === "All Employees") {
                  setEmployeeFilter("All Employees");
                  return;
                }
                const match = employees.find((item) => item.name === value);
                setEmployeeFilter(match?.id || "All Employees");
              }}
            />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden hidden lg:block" style={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={tableHead}>
                <th className="text-left px-4 py-3 font-semibold">Employee</th>
                <th className="text-left px-4 py-3 font-semibold">Department</th>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Clock In</th>
                <th className="text-left px-4 py-3 font-semibold">Clock Out</th>
                <th className="text-left px-4 py-3 font-semibold">Work Mode</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={textSecondary}>Loading attendance...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={textSecondary}>No attendance records found.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} {...rowHover}>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={textPrimary}>{row.name}</div>
                      <div className="text-xs" style={textSecondary}>{row.role}</div>
                    </td>
                    <td className="px-4 py-3" style={textSecondary}>{row.department}</td>
                    <td className="px-4 py-3" style={textSecondary}>{row.date}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={getStatusStyle(row.status)}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={textSecondary}>{row.clockIn}</td>
                    <td className="px-4 py-3" style={textSecondary}>{row.clockOut}</td>
                    <td className="px-4 py-3" style={textSecondary}>{row.workMode}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="rounded-2xl p-6 text-center" style={card}>Loading attendance...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={card}>No attendance records found.</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-2xl p-4" style={card}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold" style={textPrimary}>{row.name}</div>
                  <div className="text-xs" style={textSecondary}>{row.department} • {row.date}</div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={getStatusStyle(row.status)}>
                  {row.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm" style={textSecondary}>
                <div>In: {row.clockIn}</div>
                <div>Out: {row.clockOut}</div>
                <div>Mode: {row.workMode}</div>
                <div>Shift: {row.shift}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "default",
  isText = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "default" | "success" | "danger" | "warning";
  isText?: boolean;
}) {
  const colors = {
    default: { bg: "var(--bg-secondary)", color: "var(--text-primary)" },
    success: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
    danger: { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
    warning: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  }[tone];

  return (
    <div className="rounded-2xl p-4" style={{ ...card, background: colors.bg }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={textSecondary}>{label}</span>
        <span style={{ color: colors.color }}>{icon}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: colors.color }}>{isText ? value : value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={textSecondary}>{label}</span>
      {children}
    </label>
  );
}
