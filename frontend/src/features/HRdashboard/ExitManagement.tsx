import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type ExitRecord = {
  id: string;
  employee_id: string;
  employee_name: string;
  resignation_date: string;
  last_working_date: string;
  reason: string;
  conducted_date: string;
  status: string;
};

type ExitPayload = {
  employee_id: string;
  employee_name: string;
  resignation_date: string;
  last_working_date: string;
  reason: string;
};

export default function ExitManagement() {
  const [search] = useTopHeaderSearch();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [exitRecords, setExitRecords] = useState<ExitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExitRecord | null>(null);
  const [editError, setEditError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const fetchExitRecords = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/api/exit-management");
      setExitRecords(response.data.exit_interviews || []);
    } catch (error) {
      console.error("Failed to fetch exit interviews", error);
      setExitRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadExitRecords = async () => {
      try {
        setIsLoading(true);
        const response = await api.get("/api/exit-management");
        if (isMounted) {
          setExitRecords(response.data.exit_interviews || []);
        }
      } catch (error) {
        console.error("Failed to fetch exit interviews", error);
        if (isMounted) {
          setExitRecords([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadExitRecords();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return exitRecords;

    return exitRecords.filter((record) =>
      [
        record.employee_name,
        record.employee_id,
        record.resignation_date,
        record.last_working_date,
        record.reason,
        record.conducted_date,
        record.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [exitRecords, search]);

  const createExitInterview = async (payload: ExitPayload) => {
    setCreateError("");
    if (
      !payload.employee_name.trim() ||
      !payload.resignation_date ||
      !payload.last_working_date
    ) {
      setCreateError("Employee name, resignation date, and last working date are required.");
      return;
    }

    try {
      setIsCreating(true);
      await api.post("/api/exit-management", payload);
      setIsCreateOpen(false);
      fetchExitRecords();
    } catch (error) {
      console.error("Failed to create exit interview", error);
    } finally {
      setIsCreating(false);
    }
  };

  const updateExitInterview = async (payload: ExitPayload) => {
    if (!editingRecord) return;

    setEditError("");
    if (
      !payload.employee_name.trim() ||
      !payload.employee_id.trim() ||
      !payload.resignation_date ||
      !payload.last_working_date
    ) {
      setEditError("Employee name, employee ID, resignation date, and last working date are required.");
      return;
    }

    try {
      setIsUpdating(true);
      const response = await api.put(
        `/api/exit-management/${editingRecord.id}`,
        payload,
      );
      setExitRecords((records) =>
        records.map((record) =>
          record.id === editingRecord.id ? response.data : record,
        ),
      );
      setEditingRecord(null);
    } catch (error) {
      console.error("Failed to update exit interview", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteExitInterview = async (record: ExitRecord) => {
    const confirmed = window.confirm(
      `Delete exit interview request for ${record.employee_name}?`,
    );

    if (!confirmed) return;

    try {
      setDeletingId(record.id);
      await api.delete(`/api/exit-management/${record.id}`);
      setExitRecords((records) =>
        records.filter((item) => item.id !== record.id),
      );
    } catch (error) {
      console.error("Failed to delete exit interview", error);
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className={hrPageWrap}>
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"
            style={btnPrimary}
          >
            <Plus size={16} />
            Create Exit Interview
          </button>
        </div>

        <div className="rounded-lg p-4" style={card}>
          <div
            className="overflow-x-auto rounded-lg"
            style={{ border: "1px solid var(--border)" }}
          >
            <table className="w-full min-w-[1080px] text-sm">
              <thead style={tableHead}>
                <tr>
                  <th className="px-5 py-4 text-left font-semibold">
                    Employee
                  </th>
                  <th className="px-5 py-4 text-left font-semibold">
                    Employee ID
                  </th>
                  <th className="px-5 py-4 text-left font-semibold">
                    Resignation Date
                  </th>
                  <th className="px-5 py-4 text-left font-semibold">
                    Last Working Date
                  </th>
                  <th className="px-5 py-4 text-left font-semibold">Reason</th>
                  <th className="px-5 py-4 text-left font-semibold">
                    Conducted
                  </th>
                  <th className="px-5 py-4 text-left font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm" style={textSecondary}>
                      Loading exit interviews...
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
                      <td className="px-5 py-4" style={textSecondary}>
                        {record.resignation_date}
                      </td>
                      <td className="px-5 py-4" style={textSecondary}>
                        {record.last_working_date}
                      </td>
                      <td className="px-5 py-4 max-w-[260px] truncate" title={record.reason} style={textSecondary}>
                        {record.reason}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={getStatusStyle("Approved")}>
                          {record.conducted_date || record.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditError("");
                              setEditingRecord(record);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                            style={btnSecondary}
                            title="Edit"
                            aria-label={`Edit exit interview for ${record.employee_name}`}
                          >
                            <Pencil size={16} />
                          </button>
                        <button
                          type="button"
                          onClick={() => deleteExitInterview(record)}
                          disabled={deletingId === record.id}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-60"
                          style={btnSecondary}
                          title="Delete"
                          aria-label={`Delete exit interview for ${record.employee_name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {!isLoading && filteredRecords.length === 0 && (
                  <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm" style={textSecondary}>
                      No exit interviews found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <CreateExitInterviewModal
          title="Create Exit Interview"
          submitLabel="Create Interview"
          loadingLabel="Creating..."
          onClose={() => {
            setCreateError("");
            setIsCreateOpen(false);
          }}
          onCreate={createExitInterview}
          error={createError}
          isCreating={isCreating}
        />
      )}

      {editingRecord && (
        <CreateExitInterviewModal
          title="Edit Exit Interview"
          submitLabel="Update Interview"
          loadingLabel="Updating..."
          initialValues={{
            employee_id: editingRecord.employee_id,
            employee_name: editingRecord.employee_name,
            resignation_date: editingRecord.resignation_date,
            last_working_date: editingRecord.last_working_date,
            reason: editingRecord.reason,
          }}
          onClose={() => {
            setEditError("");
            setEditingRecord(null);
          }}
          onCreate={updateExitInterview}
          error={editError}
          isCreating={isUpdating}
        />
      )}
    </div>
  );
}

function CreateExitInterviewModal({
  title,
  submitLabel,
  loadingLabel,
  initialValues,
  onClose,
  onCreate,
  error,
  isCreating,
}: {
  title: string;
  submitLabel: string;
  loadingLabel: string;
  initialValues?: ExitPayload;
  onClose: () => void;
  onCreate: (payload: ExitPayload) => void;
  error: string;
  isCreating: boolean;
}) {
  const [form, setForm] = useState<ExitPayload>(initialValues || {
    employee_id: "",
    employee_name: "",
    resignation_date: "",
    last_working_date: "",
    reason: "",
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="w-full max-w-md rounded-lg" style={card}>
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="text-lg font-bold" style={textPrimary}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2"
            style={btnSecondary}
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <InputField
              label="Employee Name"
              value={form.employee_name}
              onChange={(value) => setForm({ ...form, employee_name: value })}
            />

            <InputField
              label="Employee ID"
              value={form.employee_id}
              onChange={(value) => setForm({ ...form, employee_id: value })}
            />
            <InputField
              label="Resignation Date"
              type="date"
              value={form.resignation_date}
              onChange={(value) =>
                setForm({ ...form, resignation_date: value })
              }
              min={new Date().toISOString().split("T")[0]}
            />

            <InputField
              label="Last Working Date"
              type="date"
              value={form.last_working_date}
              onChange={(value) =>
                setForm({ ...form, last_working_date: value })
              }
              min={new Date().toISOString().split("T")[0]}
            />
            <TextAreaField
              label="Reason For Leaving"
              rows={4}
              value={form.reason}
              onChange={(value) => setForm({ ...form, reason: value })}
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

        <div
          className="flex justify-end gap-3 border-t px-5 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={btnSecondary}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isCreating}
            onClick={() => onCreate(form)}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={btnPrimary}
          >
            {isCreating ? loadingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  type = "text",
  value,
  onChange,
  min,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
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
        min={min}
        className="h-10 w-full rounded-lg px-3 text-sm outline-none"
        style={input}
      />
    </label>
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
