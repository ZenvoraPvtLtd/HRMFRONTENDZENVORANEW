import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { getFastApiBaseUrl } from "../../config/fastApiConfig";
import {
  btnPrimary,
  btnSecondary,
  card,
  getStatusStyle,
  hrPageWrap,
  input,
  inputMuted,
  rowHover,
  textPrimary,
  textSecondary,
} from "./hrTheme";

const BASE = getFastApiBaseUrl();

// ─── helpers ────────────────────────────────────────────────
function authHeaders() {
  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("hr_accessToken") ||
    "";
  const role =
    localStorage.getItem("userRole") ||
    localStorage.getItem("hr_userRole") ||
    "hr";
  const name =
    localStorage.getItem("userName") ||
    localStorage.getItem("hr_userName") ||
    "HR";
  const id =
    localStorage.getItem("userId") ||
    localStorage.getItem("hr_userEmail") ||
    "hr";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-User-Role": role,
    "X-User-Name": name,
    "X-User-Id": id,
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─── types ───────────────────────────────────────────────────
type Employee = {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  status: string;
};

type AttendanceRecord = {
  date: string;
  status: string;
  check_in_time?: string;
  check_out_time?: string;
  shift?: string;
  source?: string;
  hr_note?: string;
};

type FormState = {
  date: string;
  status: string;
  checkInTime: string;
  checkOutTime: string;
  note: string;
};

const STATUS_OPTIONS = ["Present", "Absent", "Late", "On Leave", "Remote"];

// ─── component ───────────────────────────────────────────────
export default function AttendanceCorrection() {
  // search
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // selected employee
  const [selected, setSelected] = useState<Employee | null>(null);
  const [existing, setExisting] = useState<AttendanceRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  // form
  const [form, setForm] = useState<FormState>({
    date: todayISO(),
    status: "Present",
    checkInTime: "",
    checkOutTime: "",
    note: "",
  });

  // submit
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // history
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── search employees ──────────────────────────────────────
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    
    if (!query.trim()) {
      searchTimer.current = setTimeout(() => {
        setEmployees([]);
        setSearchErr("");
        setSearching(false);
      }, 0);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      setSearchErr("");
      try {
        const res = await fetch(
          `${BASE}/api/hr-actions/employees?search=${encodeURIComponent(query)}&limit=20`,
          { headers: authHeaders() },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || data.message || "Search failed");
        setEmployees(Array.isArray(data.data) ? data.data : []);
      } catch (e) {
        setSearchErr(e instanceof Error ? e.message : "Search failed");
        setEmployees([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  // ── fetch existing record when date changes ───────────────
  useEffect(() => {
    if (!selected) return;
    fetchExistingRecord(selected.employee_id, form.date);
  }, [form.date, selected]);

  async function fetchExistingRecord(empId: string, date: string) {
    setLoadingRecord(true);
    setExisting(null);
    try {
      const res = await fetch(
        `${BASE}/api/hr-actions/employees/${encodeURIComponent(empId)}?date=${date}`,
        { headers: authHeaders() },
      );
      const data = await res.json().catch(() => ({}));
      const rec: AttendanceRecord | null =
        data?.attendance?.record ?? null;
      setExisting(rec);
      if (rec) {
        setForm((f) => ({
          ...f,
          status: rec.status || "Present",
          checkInTime: rec.check_in_time || "",
          checkOutTime: rec.check_out_time || "",
          note: rec.hr_note || "",
        }));
      } else {
        setForm((f) => ({
          ...f,
          status: "Present",
          checkInTime: "",
          checkOutTime: "",
          note: "",
        }));
      }
    } catch {
      setExisting(null);
    } finally {
      setLoadingRecord(false);
    }
  }

  async function fetchHistory(empId: string) {
    setLoadingHistory(true);
    try {
      // Fetch last 10 days
      const end = todayISO();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 29);
      const start = startDate.toISOString().slice(0, 10);
      const res = await fetch(
        `${BASE}/api/attendance/all?employee_id=${encodeURIComponent(empId)}&start_date=${start}&end_date=${end}`,
        { headers: authHeaders() },
      );
      const data = await res.json().catch(() => ({}));
      const rows: AttendanceRecord[] = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.records)
        ? data.records
        : [];
      setHistory(rows.slice(0, 10));
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  function selectEmployee(emp: Employee) {
    setSelected(emp);
    setQuery("");
    setEmployees([]);
    setSuccessMsg("");
    setErrorMsg("");
    setHistory([]);
    fetchHistory(emp.employee_id);
    fetchExistingRecord(emp.employee_id, form.date);
  }

  function clearSelected() {
    setSelected(null);
    setExisting(null);
    setHistory([]);
    setSuccessMsg("");
    setErrorMsg("");
    setForm({ date: todayISO(), status: "Present", checkInTime: "", checkOutTime: "", note: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const body: Record<string, string> = {
        date: form.date,
        status: form.status,
      };
      if (form.checkInTime) body.checkInTime = form.checkInTime;
      if (form.checkOutTime) body.checkOutTime = form.checkOutTime;
      if (form.note) body.note = form.note;

      const res = await fetch(
        `${BASE}/api/hr-actions/employees/${encodeURIComponent(selected.employee_id)}/attendance`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || "Failed to save");

      setSuccessMsg(
        existing
          ? `Attendance updated for ${selected.name} on ${form.date}`
          : `Attendance marked for ${selected.name} on ${form.date}`,
      );
      // Refresh existing record and history
      await fetchExistingRecord(selected.employee_id, form.date);
      fetchHistory(selected.employee_id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ─── render ───────────────────────────────────────────────
  return (
    <div className={`${hrPageWrap} w-full`}>
      <div className="max-w-[900px] mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={textPrimary}>
            Attendance Correction
          </h1>
          <p className="text-sm mt-1" style={textSecondary}>
            Manually add or correct an employee's attendance record on their behalf.
          </p>
        </div>

        {/* Employee search */}
        {!selected ? (
          <div className="rounded-xl p-5" style={card}>
            <label className="block text-sm font-semibold mb-2" style={textPrimary}>
              Search Employee
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={textSecondary}
              />
              <input
                type="text"
                placeholder="Name, email, employee ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-11 rounded-lg pl-9 pr-4 text-sm outline-none"
                style={input}
              />
            </div>

            {/* search status */}
            {searching && (
              <p className="text-xs mt-2" style={textSecondary}>Searching…</p>
            )}
            {searchErr && (
              <p className="text-xs mt-2 font-medium" style={getStatusStyle("Rejected")}>
                {searchErr}
              </p>
            )}

            {/* results */}
            {employees.length > 0 && (
              <ul className="mt-3 divide-y rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {employees.map((emp) => (
                  <li key={emp.id}>
                    <button
                      type="button"
                      onClick={() => selectEmployee(emp)}
                      className="w-full text-left px-4 py-3 text-sm transition"
                      style={{ background: "var(--bg-secondary)" }}
                      {...rowHover}
                    >
                      <span className="font-semibold" style={textPrimary}>{emp.name}</span>
                      <span className="ml-2 text-xs" style={textSecondary}>
                        {emp.employee_id} · {emp.department}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!searching && query.trim() && employees.length === 0 && !searchErr && (
              <p className="text-xs mt-3" style={textSecondary}>No employees found.</p>
            )}
          </div>
        ) : (
          /* Selected employee card */
          <div className="rounded-xl p-4 flex items-center justify-between" style={card}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm" style={textPrimary}>{selected.name}</p>
                <p className="text-xs" style={textSecondary}>
                  {selected.employee_id} · {selected.department} · {selected.role}
                </p>
              </div>
            </div>
            <button
              onClick={clearSelected}
              className="p-1 rounded-lg transition"
              title="Change employee"
              style={btnSecondary}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Form — shown once employee selected */}
        {selected && (
          <form onSubmit={handleSubmit} className="rounded-xl p-5 space-y-5" style={card}>
            <h2 className="text-base font-semibold" style={textPrimary}>
              {existing ? "Update Attendance Record" : "Add Attendance Record"}
            </h2>

            {/* existing record banner */}
            {loadingRecord && (
              <p className="text-xs" style={textSecondary}>Checking existing record…</p>
            )}
            {!loadingRecord && existing && (
              <div
                className="flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2"
                style={getStatusStyle("In Progress")}
              >
                <Clock size={13} />
                Existing record found: {existing.status}
                {existing.check_in_time ? ` · In: ${existing.check_in_time}` : ""}
                {existing.check_out_time ? ` · Out: ${existing.check_out_time}` : ""}
                {existing.source ? ` · Source: ${existing.source}` : ""}
              </div>
            )}
            {!loadingRecord && !existing && (
              <div
                className="flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2"
                style={getStatusStyle("Pending")}
              >
                <UserCheck size={13} />
                No attendance record yet for this date.
              </div>
            )}

            {/* date + status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={textSecondary}>
                  Date *
                </label>
                <input
                  type="date"
                  required
                  max={todayISO()}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full h-10 rounded-lg px-3 text-sm outline-none"
                  style={input}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={textSecondary}>
                  Status *
                </label>
                <select
                  required
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full h-10 rounded-lg px-3 text-sm outline-none"
                  style={inputMuted}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* check-in / check-out */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={textSecondary}>
                  Check-In Time
                </label>
                <input
                  type="time"
                  value={form.checkInTime.slice(0, 5)}
                  onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                  className="w-full h-10 rounded-lg px-3 text-sm outline-none"
                  style={input}
                />
                <p className="text-[11px] mt-1" style={textSecondary}>
                  Leave blank to use current time
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={textSecondary}>
                  Check-Out Time
                </label>
                <input
                  type="time"
                  value={form.checkOutTime.slice(0, 5)}
                  onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                  className="w-full h-10 rounded-lg px-3 text-sm outline-none"
                  style={input}
                />
              </div>
            </div>

            {/* note */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={textSecondary}>
                HR Note (optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Employee was present but face scanner was offline"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                style={input}
              />
            </div>

            {/* feedback */}
            {successMsg && (
              <div
                className="flex items-center gap-2 text-sm font-medium rounded-lg px-3 py-2"
                style={getStatusStyle("Approved")}
              >
                <CheckCircle2 size={15} />
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div
                className="flex items-center gap-2 text-sm font-medium rounded-lg px-3 py-2"
                style={getStatusStyle("Rejected")}
              >
                <X size={15} />
                {errorMsg}
              </div>
            )}

            {/* submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-6 rounded-lg text-sm font-semibold disabled:opacity-50 transition"
                style={btnPrimary}
              >
                {saving
                  ? "Saving…"
                  : existing
                  ? "Update Attendance"
                  : "Mark Attendance"}
              </button>
            </div>
          </form>
        )}

        {/* Recent attendance history for selected employee */}
        {selected && (
          <div className="rounded-xl overflow-hidden" style={card}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-sm font-semibold" style={textPrimary}>
                Last 10 Attendance Records
              </h2>
            </div>
            {loadingHistory ? (
              <p className="text-xs px-5 py-4" style={textSecondary}>Loading history…</p>
            ) : history.length === 0 ? (
              <p className="text-xs px-5 py-4" style={textSecondary}>No records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead>
                    <tr style={{ background: "var(--table-head-bg)", color: "var(--table-head-text)" }}>
                      {["Date", "Status", "Check-In", "Check-Out", "Source"].map((col) => (
                        <th key={col} className="px-4 py-3 text-left text-xs font-semibold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row, i) => (
                      <tr
                        key={i}
                        style={{ borderTop: "1px solid var(--border)" }}
                        {...rowHover}
                      >
                        <td className="px-4 py-3 font-medium" style={textPrimary}>{row.date}</td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={getStatusStyle(row.status)}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={textSecondary}>
                          {row.check_in_time || "—"}
                        </td>
                        <td className="px-4 py-3" style={textSecondary}>
                          {row.check_out_time || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs" style={textSecondary}>
                          {row.source || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
