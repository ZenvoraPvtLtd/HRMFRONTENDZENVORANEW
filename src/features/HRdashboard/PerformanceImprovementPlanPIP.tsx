import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import api from "../../utils/axiosInstance";
import {
  btnPrimary,
  btnSecondary,
  card,
  getStatusStyle,
  hrPageWrap,
  input,
  tableHead,
  textPrimary,
  textSecondary,
} from "./hrTheme";

type PIPRecord = {
  id: string;
  employee_id: string;
  employee_name: string;
  issue_description: string;
  expectations: string;
  timeline_days: number;
  start_date: string;
  end_date: string;
  warning_message: string;
  status: string;
};

type PIPPayload = {
  employee_id: string;
  employee_name: string;
  issue_description: string;
  expectations: string;
  timeline_days: number;
  start_date: string;
  warning_message: string;
  status: string;
};

const defaultWarningMessage =
  "You are expected to improve your performance within the given timeline. If improvement is not observed, further disciplinary action, including termination, may be considered as per company policy.";

export default function PerformanceImprovementPlanPIP() {
  const [search] = useTopHeaderSearch();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pipRecords, setPipRecords] = useState<PIPRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchPips = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/api/pip");
      setPipRecords(response.data.pips || []);
    } catch (error) {
      console.error("Failed to fetch PIP records", error);
      setPipRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      await fetchPips();
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pipRecords;

    return pipRecords.filter((record) =>
      [
        record.employee_name,
        record.employee_id,
        record.issue_description,
        record.expectations,
        record.timeline_days,
        record.start_date,
        record.end_date,
        record.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [pipRecords, search]);

  const createPip = async (payload: PIPPayload) => {
    setCreateError("");

    if (
      !payload.employee_name.trim() ||
      !payload.issue_description.trim() ||
      !payload.expectations.trim() ||
      !payload.timeline_days ||
      !payload.start_date
    ) {
      setCreateError("Employee, issue, expectations, timeline, and start date are required.");
      return;
    }

    try {
      setIsCreating(true);
      const response = await api.post("/api/pip", payload);
      setPipRecords((records) => [response.data, ...records]);
      setIsCreateOpen(false);
    } catch (error) {
      console.error("Failed to create PIP", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={hrPageWrap}>
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setCreateError("");
              setIsCreateOpen(true);
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"
            style={btnPrimary}
          >
            <Plus size={16} />
            Create PIP
          </button>
        </div>

        <div className="rounded-lg p-4" style={card}>
          <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full min-w-[1080px] text-sm">
              <thead style={tableHead}>
                <tr>
                  <th className="px-5 py-4 text-left font-semibold">Employee</th>
                  <th className="px-5 py-4 text-left font-semibold">Employee ID</th>
                  <th className="px-5 py-4 text-left font-semibold">Issue Description</th>
                  <th className="px-5 py-4 text-left font-semibold">Timeline</th>
                  <th className="px-5 py-4 text-left font-semibold">Start Date</th>
                  <th className="px-5 py-4 text-left font-semibold">End Date</th>
                  <th className="px-5 py-4 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm" style={textSecondary}>
                      Loading PIPs...
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  filteredRecords.map((record) => (
                    <tr key={record.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-5 py-4 font-semibold" style={textPrimary}>
                        {record.employee_name}
                      </td>
                      <td className="px-5 py-4" style={textSecondary}>
                        {record.employee_id || "-"}
                      </td>
                      <td
                        className="px-5 py-4 max-w-[280px] truncate"
                        title={record.issue_description}
                        style={textSecondary}
                      >
                        {record.issue_description}
                      </td>
                      <td className="px-5 py-4" style={textSecondary}>
                        {record.timeline_days} days
                      </td>
                      <td className="px-5 py-4" style={textSecondary}>
                        {record.start_date}
                      </td>
                      <td className="px-5 py-4" style={textSecondary}>
                        {record.end_date}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={getStatusStyle(record.status)}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                {!isLoading && filteredRecords.length === 0 && (
                  <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td colSpan={7} className="px-5 py-10 text-sm italic" style={textSecondary}>
                      No PIPs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <CreatePIPModal
          onClose={() => {
            setCreateError("");
            setIsCreateOpen(false);
          }}
          onCreate={createPip}
          error={createError}
          isCreating={isCreating}
        />
      )}
    </div>
  );
}

function CreatePIPModal({
  onClose,
  onCreate,
  error,
  isCreating,
}: {
  onClose: () => void;
  onCreate: (payload: PIPPayload) => void;
  error: string;
  isCreating: boolean;
}) {
  const [form, setForm] = useState<PIPPayload>({
    employee_id: "",
    employee_name: "",
    issue_description: "",
    expectations: "",
    timeline_days: 30,
    start_date: "",
    warning_message: defaultWarningMessage,
    status: "Active",
  });

  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    api.get("/api/employees").then((res) => {
      setEmployees(res.data.employees || res.data || []);
    }).catch(console.error);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="w-full max-w-md rounded-lg" style={card}>
        <div className="flex items-start justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="max-w-[260px] text-lg font-bold leading-6" style={textPrimary}>
            Create Performance Improvement Plan
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2" style={btnSecondary}>
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold" style={textPrimary}>Employee</span>
              <select
                value={form.employee_id}
                onChange={(e) => {
                  const val = e.target.value;
                  const emp = employees.find(emp => emp.employeeId === val || String(emp.id) === val);
                  if (emp) {
                    setForm({
                      ...form,
                      employee_id: emp.employeeId || String(emp.id),
                      employee_name: emp.name || emp.fullName || "",
                    });
                  }
                }}
                className="h-10 w-full rounded-lg px-3 text-sm outline-none"
                style={input}
              >
                <option value="" disabled>Select an employee</option>
                {employees.map((emp) => (
                  <option key={emp.id || emp.employeeId} value={emp.employeeId || String(emp.id)}>
                    {emp.name || emp.fullName} ({emp.employeeId || emp.id})
                  </option>
                ))}
              </select>
            </label>
            <TextAreaField
              label="Issue Description"
              rows={4}
              value={form.issue_description}
              onChange={(value) => setForm({ ...form, issue_description: value })}
            />
            <TextAreaField
              label="Improvement Expectations"
              rows={4}
              value={form.expectations}
              onChange={(value) => setForm({ ...form, expectations: value })}
            />
            <InputField
              label="Timeline (days)"
              type="number"
              value={String(form.timeline_days)}
              onChange={(value) =>
                setForm({ ...form, timeline_days: Number(value) || 0 })
              }
            />
            <InputField
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={(value) => setForm({ ...form, start_date: value })}
            />
            <StatusField
              value={form.status}
              onChange={(value) => setForm({ ...form, status: value })}
            />
            <TextAreaField
              label="Employee Notification Message"
              rows={4}
              value={form.warning_message}
              onChange={(value) => setForm({ ...form, warning_message: value })}
            />
          </div>

          {error && (
            <div
              className="mt-4 rounded-lg px-3 py-2 text-sm font-medium"
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#ef4444",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold" style={btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            disabled={isCreating}
            onClick={() => onCreate(form)}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            style={btnPrimary}
          >
            {isCreating ? "Creating..." : "Create PIP"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ConstrainedDropdown
      label="Status"
      value={value}
      options={["Active", "Improved", "Extended", "Escalated", "Terminated", "Closed"]}
      onChange={onChange}
      buttonStyle={input}
      labelStyle={textPrimary}
    />
  );
}

function TextAreaField({
  label,
  rows,
  value,
  onChange,
}: {
  label: string;
  rows: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold" style={textPrimary}>
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
        rows={rows}
        style={input}
      />
    </label>
  );
}

function InputField({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold" style={textPrimary}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg px-3 text-sm outline-none"
        style={input}
      />
    </label>
  );
}
