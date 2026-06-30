import { CalendarDays, Download, RefreshCw } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import {
  btnPrimary,
  btnSecondary,
  card,
  hrPageWrap,
  inputMuted,
  rowHover,
  tableHead,
  textPrimary,
  textSecondary,
} from "../HRdashboard/hrTheme";

type AttendanceStatus = "On Time" | "Late" | "Absent" | "Early Out";

type AttendanceRecord = {
  id: string;
  employee: string;
  role: string;
  shift: string;
  workMode: string;
  status: AttendanceStatus;
  marked: string;
  department: string;
};

type AttendanceProps = {
  employeePortal?: boolean;
};

import { fetchHrAttendance } from "../../services/attendanceApi";

const statusOptions = ["All", "On Time", "Late", "Absent", "Early Out"];

function statusStyle(status: AttendanceStatus) {
  if (status === "On Time") {
    return { background: "rgba(16,185,129,0.12)", color: "#10b981" };
  }
  if (status === "Late") {
    return { background: "rgba(245,158,11,0.12)", color: "#f59e0b" };
  }
  if (status === "Early Out") {
    return { background: "rgba(139,92,246,0.12)", color: "#8b5cf6" };
  }
  return { background: "rgba(239,68,68,0.12)", color: "#ef4444" };
}

export default function Attendance({ employeePortal = false }: AttendanceProps) {
  void employeePortal;

  const [search] = useTopHeaderSearch();
  const [period, setPeriod] = useState("Today");
  const [date, setDate] = useState("2026-06-01");
  const [department, setDepartment] = useState("All Departments");
  const [employee, setEmployee] = useState("All Employees");
  const [status, setStatus] = useState("All");

  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch attendance for selected date
  useEffect(() => {
    setLoading(true);
    fetchHrAttendance({ start: date })
      .then((res) => {
        const mapped: AttendanceRecord[] = (res.data || []).map((row) => ({
          id: row.id,
          employee: row.name,
          role: row.role,
          shift: row.shift,
          workMode: row.workMode,
          status: row.status as AttendanceStatus,
          marked: row.clockIn ? `In: ${row.clockIn.slice(11, 16)}` : row.marked ? "Marked" : "Absent",
          department: row.department,
        }));
        setAttendanceData(mapped);
      })
      .catch((e) => {
        console.error("Failed to fetch attendance", e);
      })
      .finally(() => setLoading(false));
  }, [date]);

  const departments = useMemo(
    () => [
      "All Departments",
      ...new Set(attendanceData.map((record) => record.department)),
    ],
    [attendanceData],
  );

  const employees = useMemo(
    () => [
      "All Employees",
      ...new Set(attendanceData.map((record) => record.employee)),
    ],
    [attendanceData],
  );

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return attendanceData.filter((record) => {
      const matchesSearch =
        !query ||
        [
          record.employee,
          record.role,
          record.shift,
          record.workMode,
          record.status,
          record.department,
          record.marked,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesDepartment =
        department === "All Departments" || record.department === department;
      const matchesEmployee =
        employee === "All Employees" || record.employee === employee;
      const matchesStatus = status === "All" || record.status === status;

      return matchesSearch && matchesDepartment && matchesEmployee && matchesStatus;
    });
  }, [attendanceData, department, employee, search, status]);

  const metrics = useMemo(() => {
    const total = attendanceData.length;
    const checkedIn = attendanceData.filter(
      (record) => record.status !== "Absent",
    ).length;
    const onTime = attendanceData.filter(
      (record) => record.status === "On Time",
    ).length;
    const late = attendanceData.filter((record) => record.status === "Late").length;
    const absent = attendanceData.filter(
      (record) => record.status === "Absent",
    ).length;
    const earlyOut = attendanceData.filter(
      (record) => record.status === "Early Out",
    ).length;
    const rate = total ? `${Math.round((checkedIn / total) * 100)}%` : "0%";

    return [
      { label: "Total", value: total.toString(), color: "#3b82f6" },
      { label: "Checked In", value: checkedIn.toString(), color: "#10b981" },
      { label: "On Time", value: onTime.toString(), color: "#3b82f6" },
      { label: "Late", value: late.toString(), color: "#f59e0b" },
      { label: "Absent", value: absent.toString(), color: "#ef4444" },
      { label: "Early Out", value: earlyOut.toString(), color: "#8b5cf6" },
      { label: "Rate", value: rate, color: "#0891b2" },
    ];
  }, [attendanceData]);

  const exportCSV = () => {
    const headers = [
      "Employee",
      "Role",
      "Shift",
      "Work Mode",
      "Status",
      "Marked",
    ];
    const rows = filteredRecords.map((record) => [
      record.employee,
      record.role,
      record.shift,
      record.workMode,
      record.status,
      record.marked,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "attendance.csv";
    link.click();
  };

  const resetFilters = () => {
    setPeriod("Today");
    setDate("2026-06-01");
    setDepartment("All Departments");
    setEmployee("All Employees");
    setStatus("All");
  };

  return (
    <div className={`${hrPageWrap} max-w-400 mx-auto`}>
      <div className="mb-5 flex flex-col gap-2">
        <p className="text-sm" style={textSecondary}>
          Monday, June 1, 2026
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl p-4" style={card}>
            <p className="text-xl font-bold" style={{ color: metric.color }}>
              {metric.value}
            </p>
            <p className="text-xs mt-1" style={textSecondary}>
              {metric.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {["Today", "This Week", "This Month", "Day", "Range"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={period === item ? btnPrimary : btnSecondary}
            >
              {item}
            </button>
          ))}

          <label className="flex items-center gap-2 rounded-lg px-3 py-2" style={inputMuted}>
            <CalendarDays size={15} style={textSecondary} />
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="bg-transparent text-sm outline-none"
              style={textPrimary}
            />
          </label>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
            style={btnSecondary}
          >
            <RefreshCw size={15} />
            Reset
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-end">
          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="rounded-lg px-4 py-2.5 text-sm outline-none min-w-45"
            style={inputMuted}
          >
            {departments.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <select
            value={employee}
            onChange={(event) => setEmployee(event.target.value)}
            className="rounded-lg px-4 py-2.5 text-sm outline-none min-w-42.5"
            style={inputMuted}
          >
            {employees.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg px-4 py-2.5 text-sm outline-none min-w-32.5"
            style={inputMuted}
          >
            {statusOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {/* Dynamically display selected date */}
            <p className="text-sm font-semibold" style={textPrimary}>
              Attendance for {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-xs mt-1" style={textSecondary}>
              {filteredRecords.length} employees shown
            </p>
          </div>

          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
            style={btnPrimary}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-245">
            <thead>
              <tr style={tableHead}>
                {[
                  "Employee",
                  "Role",
                  "Shift",
                  "Work Mode",
                  "Status",
                  "Marked",
                ].map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRecords.map((record) => (
                <tr
                  key={record.id}
                  style={{ borderTop: "1px solid var(--border)" }}
                  {...rowHover}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          background: "var(--icon-accent-bg)",
                          color: "var(--accent)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {record.employee
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <span className="text-sm font-semibold" style={textPrimary}>
                        {record.employee}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm" style={textSecondary}>
                    {record.role}
                  </td>
                  <td className="px-4 py-4 text-sm" style={textSecondary}>
                    {record.shift}
                  </td>
                  <td className="px-4 py-4 text-sm" style={textSecondary}>
                    {record.workMode}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                      style={statusStyle(record.status)}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm" style={textSecondary}>
                    {record.marked}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

