import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import {
  createComplianceRecord,
  deleteComplianceRecord,
  fetchComplianceRecords,
  updateComplianceRecord,
  type CompliancePayload,
} from "../../services/complianceApi";
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

type ComplianceRecord = {
  id: number | string;
  employeeId: string;
  type: string;
  registrationNumber: string;
  amount: string;
  period: string;
};

const emptyForm: CompliancePayload = {
  employeeId: "",
  type: "",
  registrationNumber: "",
  amount: "",
  period: "",
};

export default function Compliance() {
  const [search] = useTopHeaderSearch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [form, setForm] = useState<CompliancePayload>(emptyForm);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadRecords() {
    await Promise.resolve();

    try {
      setIsLoading(true);
      setError("");
      const response = await fetchComplianceRecords();
      const list = Array.isArray(response) ? response : response.data || response.records || [];
      setRecords(list);
    } catch (err) {
      console.error("Failed to load compliance records", err);
      setError("Failed to load compliance records. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadRecords();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;

    return records.filter((record) =>
      [
        record.employeeId,
        record.type,
        record.registrationNumber,
        record.amount,
        record.period,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [records, search]);

  const openCreateModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (record: ComplianceRecord) => {
    setForm({
      employeeId: record.employeeId,
      type: record.type,
      registrationNumber: record.registrationNumber,
      amount: record.amount,
      period: record.period,
    });
    setEditingId(record.id);
    setIsModalOpen(true);
  };

  const handleSaveRecord = async () => {
    if (
      !form.employeeId.trim() ||
      !form.type.trim() ||
      !form.registrationNumber.trim() ||
      !form.amount.trim() ||
      !form.period.trim()
    ) {
      setError("Please fill all compliance record fields.");
      return;
    }

    try {
      setError("");
      if (editingId) {
        const updated = await updateComplianceRecord(editingId, form);
        setRecords((prev) =>
          prev.map((record) => (record.id === editingId ? updated : record)),
        );
      } else {
        const created = await createComplianceRecord(form);
        setRecords((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      console.error("Failed to save compliance record", err);
      setError("Failed to save compliance record. Please try again.");
    }
  };

  const handleDeleteRecord = async (recordId: number | string) => {
    try {
      setError("");
      await deleteComplianceRecord(recordId);
      setRecords((prev) => prev.filter((record) => record.id !== recordId));
    } catch (err) {
      console.error("Failed to delete compliance record", err);
      setError("Failed to delete compliance record. Please try again.");
    }
  };

  return (
    <div className={hrPageWrap}>
      <div className="max-w-[1280px] mx-auto">
        {error && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm font-medium" style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
            {error}
          </div>
        )}

        {isLoading && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm font-medium" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.25)" }}>
            Loading compliance records...
          </div>
        )}

        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"
            style={btnPrimary}
          >
            <Plus size={16} />
            Add Record
          </button>
        </div>

        <div className="rounded-lg p-4" style={card}>
          <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full min-w-[820px] text-sm">
              <thead style={tableHead}>
                <tr>
                  <th className="text-left px-5 py-4 font-semibold">Employee ID</th>
                  <th className="text-left px-5 py-4 font-semibold">Type</th>
                  <th className="text-left px-5 py-4 font-semibold">Registration Number</th>
                  <th className="text-left px-5 py-4 font-semibold">Amount</th>
                  <th className="text-left px-5 py-4 font-semibold">Period</th>
                  <th className="text-right px-5 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-4 font-semibold" style={textPrimary}>
                      {record.employeeId}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {record.type}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {record.registrationNumber}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {record.amount}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {record.period}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(record)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                          style={getStatusStyle("In Progress")}
                          aria-label={`Edit compliance record ${record.registrationNumber}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(record.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                          style={getStatusStyle("Rejected")}
                          aria-label={`Delete compliance record ${record.registrationNumber}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredRecords.length === 0 && (
                  <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td colSpan={6} className="px-5 py-10 text-sm italic" style={textSecondary}>
                      No compliance records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <AddRecordModal
          form={form}
          isEditMode={Boolean(editingId)}
          onChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveRecord}
        />
      )}
    </div>
  );
}

function AddRecordModal({
  form,
  isEditMode,
  onChange,
  onClose,
  onSave,
}: {
  form: CompliancePayload;
  isEditMode: boolean;
  onChange: (field: keyof CompliancePayload, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-lg rounded-lg" style={card}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-bold" style={textPrimary}>
            {isEditMode ? "Edit Compliance Record" : "Add Compliance Record"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2" style={btnSecondary}>
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
          <Field label="Employee ID" placeholder="EMP-1001" value={form.employeeId} onChange={(value) => onChange("employeeId", value)} />
          <Field label="Type" placeholder="PF / ESI / Tax" value={form.type} onChange={(value) => onChange("type", value)} />
          <Field label="Registration Number" placeholder="REG-0001" value={form.registrationNumber} onChange={(value) => onChange("registrationNumber", value)} />
          <Field label="Amount" placeholder="0.00" value={form.amount} onChange={(value) => onChange("amount", value)} />
          <div className="sm:col-span-2">
            <Field label="Period" placeholder="June 2026" value={form.period} onChange={(value) => onChange("period", value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold" style={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={onSave} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold" style={btnPrimary}>
            <Save size={16} />
            {isEditMode ? "Update Record" : "Save Record"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold" style={textSecondary}>
        {label}
      </span>
      <input
        className="h-10 w-full rounded-lg px-3 text-sm outline-none"
        style={input}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
