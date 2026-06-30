import { useEffect, useMemo, useState } from "react";
import { Plus, Send, X } from "lucide-react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import api from "../../utils/axiosInstance";
import {
  btnPrimary,
  card,
  getStatusStyle,
  hrPageWrap,
  inputMuted,
  tableHead,
  textPrimary,
  textSecondary,
} from "../HRdashboard/hrTheme";

type Grievance = {
  id: string;
  subject: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  resolution?: string;
  created_at?: string;
};

const emptyForm = {
  subject: "",
  category: "Workplace",
  priority: "Medium",
  description: "",
};

export default function MyGrievancesPage() {
  const [search] = useTopHeaderSearch();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;

    const loadGrievances = async () => {
      try {
        const response = await api.get("/api/grievances/my");
        if (active) {
          setGrievances(response.data);
        }
      } catch {
        // API fail ho to koi message show nahi hoga.
      }
    };

    void loadGrievances();
    return () => {
      active = false;
    };
  }, []);

  const filteredGrievances = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return grievances;

    return grievances.filter((item) =>
      [item.subject, item.category, item.priority, item.status, item.resolution || ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [grievances, search]);

  const submitGrievance = async () => {
    if (!form.subject.trim() || !form.description.trim()) return;

    try {
      const response = await api.post("/api/grievances", {
        ...form,
        employee_name: localStorage.getItem("userName") || "",
        employee_email: localStorage.getItem("userEmail") || "",
      });
      setGrievances((prev) => [response.data, ...prev]);
      setForm(emptyForm);
      setShowModal(false);
    } catch {
      // API fail ho to koi message show nahi hoga.
    }
  };

  return (
    <div className={hrPageWrap}>
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"
            style={btnPrimary}
          >
            <Plus size={16} />
            Raise Grievance
          </button>
        </div>

        <div className="rounded-lg p-4" style={card}>
          <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full min-w-[920px] text-sm">
              <thead style={tableHead}>
                <tr>
                  {["Subject", "Category", "Priority", "Status", "Submitted", "HR Resolution"].map((column) => (
                    <th key={column} className="px-5 py-4 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredGrievances.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-5 py-4 font-semibold" style={textPrimary}>
                      {item.subject}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {item.category}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {item.priority}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full px-3 py-1 text-xs font-semibold" style={getStatusStyle(item.status)}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-5 py-4" style={textSecondary}>
                      {item.resolution || "-"}
                    </td>
                  </tr>
                ))}

                {filteredGrievances.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-sm italic text-center" style={textSecondary}>
                      No grievances found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-lg shadow-2xl" style={card}>
            <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-lg font-bold" style={textPrimary}>
                Raise Grievance
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg">
                <X size={18} style={textSecondary} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-6">
              <FormField label="Subject" required>
                <input
                  value={form.subject}
                  onChange={(event) => setForm({ ...form, subject: event.target.value })}
                  placeholder="Enter grievance subject"
                  className="w-full rounded-lg px-4 py-3 outline-none"
                  style={inputMuted}
                />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DropdownField
                  label="Category"
                  value={form.category}
                  options={["Workplace", "Payroll", "Manager", "Policy", "Harassment", "Other"]}
                  onChange={(value) => setForm({ ...form, category: value })}
                />
                <DropdownField
                  label="Priority"
                  value={form.priority}
                  options={["Low", "Medium", "High", "Critical"]}
                  onChange={(value) => setForm({ ...form, priority: value })}
                />
              </div>

              <FormField label="Description" required>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={5}
                  placeholder="Describe your concern..."
                  className="w-full rounded-lg px-4 py-3 outline-none"
                  style={inputMuted}
                />
              </FormField>

              <button
                type="button"
                onClick={submitGrievance}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold"
                style={btnPrimary}
              >
                <Send size={16} />
                Submit Grievance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold" style={textPrimary}>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function DropdownField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold" style={textPrimary}>
        {label}
      </span>
      <ConstrainedDropdown value={value} options={options} onChange={onChange} buttonStyle={inputMuted} />
    </label>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
