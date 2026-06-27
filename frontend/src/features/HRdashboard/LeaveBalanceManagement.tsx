import {
  Check,
  ChevronDown,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import {
  fetchAllLeaveBalances,
  updateLeaveBalance,
  resetYearBalances,
  type ApiLeaveBalance,
} from "../../services/leaveApi";
import {
  btnPrimary,
  btnSecondary,
  card,
  HR_YEAR_OPTIONS,
  hrPageWrap,
  inputMuted,
  rowHover,
  tableHead,
  textPrimary,
  textSecondary,
} from "./hrTheme";

type LeaveBalance = {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  department: string;
  leavesPerMonth: number;
  overallLeaves: number;
  earned: number;
  used: number;
  remaining: number;
  compOff: number;
};

function mapApiToLocal(api: ApiLeaveBalance): LeaveBalance {
  return {
    id: api.id || api.employee_id,
    employee_id: api.employee_id,
    name: api.employee_name || "Unknown",
    email: "",
    department: api.department || "",
    leavesPerMonth: 1.5,
    overallLeaves: 18,
    earned: api.earned,
    used: api.used,
    remaining: api.remaining,
    compOff: 0,
  };
}

function getBalance(row: LeaveBalance) {
  return Number((row.earned - row.used).toFixed(1));
}

function getEffectiveBalance(row: LeaveBalance) {
  return Number((getBalance(row) + row.compOff).toFixed(1));
}

export default function LeaveBalanceManagement() {
  const [search] = useTopHeaderSearch();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [rows, setRows] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"add" | "remove">("add");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [leaveType, setLeaveType] = useState("");
  const [allocationDays, setAllocationDays] = useState("");
  const [allocationReason, setAllocationReason] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [editingRow, setEditingRow] = useState<LeaveBalance | null>(null);
  const [editEarned, setEditEarned] = useState("");
  const [editUsed, setEditUsed] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllLeaveBalances(Number(year));
      setRows(data.map(mapApiToLocal));
    } catch (err) {
      console.error("Failed to load balances:", err);
      setError(err instanceof Error ? err.message : "Failed to load balances");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadBalances();
    }, 0);
    return () => clearTimeout(t);
  }, [loadBalances]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      [row.id, row.name, row.email, row.department]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [rows, search]);

  const exportCSV = () => {
    const headers = [
      "Employee ID",
      "Name",
      "Department",
      "Leaves/Month",
      "Overall",
      "Earned",
      "Used",
      "Balance",
      "Comp-Off",
      "Effective Balance",
    ];
    const csvRows = filteredRows.map((row) => [
      row.employee_id,
      row.name,
      row.department,
      row.leavesPerMonth,
      row.overallLeaves,
      row.earned,
      row.used,
      getBalance(row),
      row.compOff,
      getEffectiveBalance(row),
    ]);

    const csv = [headers, ...csvRows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leave-balance-${year}.csv`;
    link.click();
  };

  const handleResetYear = async () => {
    if (!confirm(`Reset all leave balances for ${year}? This will set earned=18 and used=0 for all employees.`)) {
      return;
    }
    setLoading(true);
    try {
      await resetYearBalances(Number(year), 18);
      await loadBalances();
    } catch (err) {
      console.error("Reset year failed:", err);
      setError(err instanceof Error ? err.message : "Failed to reset year");
    } finally {
      setLoading(false);
    }
  };

  const drawerEmployees = useMemo(() => {
    const query = employeeQuery.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.name, row.email, row.id, row.department].join(" ").toLowerCase().includes(query)
    );
  }, [employeeQuery, rows]);

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds((previous) =>
      previous.includes(employeeId)
        ? previous.filter((id) => id !== employeeId)
        : [...previous, employeeId]
    );
  };

  const closeBulkDrawer = () => {
    setIsBulkOpen(false);
    setEmployeeQuery("");
    setIsEmployeeDropdownOpen(false);
    setSelectedEmployeeIds([]);
    setLeaveType("");
    setAllocationDays("");
    setAllocationReason("");
    setBulkMode("add");
  };

  const applyBulkAssignment = async () => {
    const days = Number(allocationDays);
    if (!selectedEmployeeIds.length || !leaveType || Number.isNaN(days) || days <= 0) {
      return;
    }

    setBulkSubmitting(true);
    try {
      for (const empId of selectedEmployeeIds) {
        const row = rows.find((r) => r.employee_id === empId);
        if (!row) continue;

        const currentEarned = row.earned;
        const newEarned = bulkMode === "add" ? currentEarned + days : Math.max(0, currentEarned - days);

        await updateLeaveBalance(empId, { earned: Number(newEarned.toFixed(1)) }, Number(year));
      }
      closeBulkDrawer();
      await loadBalances();
    } catch (err) {
      console.error("Bulk assignment failed:", err);
      setError(err instanceof Error ? err.message : "Bulk assignment failed");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const openEditModal = (row: LeaveBalance) => {
    setEditingRow(row);
    setEditEarned(String(row.earned));
    setEditUsed(String(row.used));
  };

  const closeEditModal = () => {
    setEditingRow(null);
    setEditEarned("");
    setEditUsed("");
  };

  const saveEditModal = async () => {
    if (!editingRow) return;

    const earned = Number(editEarned);
    const used = Number(editUsed);
    if (Number.isNaN(earned) || Number.isNaN(used)) return;

    setEditSaving(true);
    try {
      await updateLeaveBalance(editingRow.employee_id, { earned, used }, Number(year));
      closeEditModal();
      await loadBalances();
    } catch (err) {
      console.error("Update failed:", err);
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className={`${hrPageWrap} max-w-[1600px] mx-auto`}>

      {error && (
        <div className="mb-5 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
        <div className="col-span-2 flex w-full items-center gap-2 text-sm font-semibold sm:col-span-1 sm:w-36" style={textSecondary}>
          <span className="shrink-0">Year:</span>
          <ConstrainedDropdown
            value={year}
            onChange={setYear}
            options={HR_YEAR_OPTIONS}
            className="flex-1"
            buttonStyle={inputMuted}
          />
        </div>

        <button
          onClick={loadBalances}
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold sm:w-10 disabled:opacity-50"
          style={btnSecondary}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>

        <button
          type="button"
          onClick={exportCSV}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold sm:w-auto sm:px-4"
          style={btnSecondary}
        >
          <Download size={15} />
          Export CSV
        </button>

        <button
          type="button"
          onClick={handleResetYear}
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold sm:w-auto sm:px-4 disabled:opacity-50"
          style={btnSecondary}
        >
          Reset Year
        </button>

        <button
          type="button"
          onClick={() => setIsBulkOpen(true)}
          className="col-span-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold sm:col-span-1 sm:w-auto sm:px-4"
          style={btnPrimary}
        >
          <Users size={15} />
          Bulk Assignment
        </button>
      </div>

      <div className="rounded-2xl p-4" style={card}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={textSecondary} />
            <span className="ml-2 text-sm" style={textSecondary}>Loading balances...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead style={tableHead}>
                <tr style={tableHead}>
                  {[
                    "Employee ID",
                    "Name",
                    "Department",
                    "Leaves/Month",
                    "Overall/Year",
                    "Earned",
                    "Used",
                    "Balance",
                    "Comp-Off",
                    "Effective",
                    "Actions",
                  ].map((column, index, columns) => (
                    <th
                      key={column}
                      className={`px-4 py-4 text-xs font-semibold ${
                        index >= 3 && index < columns.length - 1 ? "text-center" : ""
                      } ${index === columns.length - 1 ? "text-right" : "text-left"}`}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderTop: "1px solid var(--border)" }}
                    {...rowHover}
                  >
                    <td className="px-4 py-4 text-sm" style={textSecondary}>
                      {row.employee_id.slice(-8)}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold" style={textPrimary}>
                      {row.name}
                    </td>
                    <td className="px-4 py-4 text-sm" style={textSecondary}>
                      {row.department || "-"}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-semibold" style={textPrimary}>
                      {row.leavesPerMonth}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-semibold" style={textPrimary}>
                      {row.overallLeaves}
                    </td>
                    <td className="px-4 py-4 text-center text-sm" style={textSecondary}>
                      {row.earned}
                    </td>
                    <td className="px-4 py-4 text-center text-sm" style={textSecondary}>
                      {row.used}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-semibold" style={{ color: "#10b981" }}>
                      {getBalance(row)}
                    </td>
                    <td className="px-4 py-4 text-center text-sm" style={textSecondary}>
                      {row.compOff}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-semibold" style={{ color: "#10b981" }}>
                      {getEffectiveBalance(row)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(row)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                        style={btnSecondary}
                        aria-label={`Edit leave balance for ${row.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-sm"
                      style={textSecondary}
                    >
                      No leave balances found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            aria-label="Close edit modal"
            onClick={closeEditModal}
            className="absolute inset-0 bg-black/45"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={textPrimary}>Edit Leave Balance</h2>
              <button onClick={closeEditModal} style={btnSecondary} className="inline-flex h-9 w-9 items-center justify-center rounded-lg">
                <X size={16} />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm font-semibold" style={textPrimary}>{editingRow.name}</p>
              <p className="text-xs" style={textSecondary}>{editingRow.employee_id}</p>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-semibold" style={textPrimary}>Earned Leaves</label>
              <input
                type="number"
                step="0.5"
                value={editEarned}
                onChange={(e) => setEditEarned(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputMuted}
              />
            </div>
            <div className="mb-5">
              <label className="mb-1 block text-sm font-semibold" style={textPrimary}>Used Leaves</label>
              <input
                type="number"
                step="0.5"
                value={editUsed}
                onChange={(e) => setEditUsed(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputMuted}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={closeEditModal} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={btnSecondary}>Cancel</button>
              <button onClick={saveEditModal} disabled={editSaving} className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50" style={btnPrimary}>
                {editSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assignment Drawer */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close bulk leave assignment"
            onClick={closeBulkDrawer}
            className="absolute inset-0 bg-black/45"
          />

          <aside
            className="relative z-10 flex h-full w-full max-w-[430px] flex-col border-l p-5 shadow-2xl"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold" style={textPrimary}>
                  Bulk Leave Assignment
                </h2>
                <p className="mt-1 text-xs" style={textSecondary}>
                  Add leave allocation for multiple employees at once
                </p>
              </div>

              <button
                type="button"
                onClick={closeBulkDrawer}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                style={btnSecondary}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBulkMode("add")}
                className="rounded-lg px-4 py-3 text-sm font-semibold"
                style={bulkMode === "add" ? btnPrimary : btnSecondary}
              >
                + Add Leave
              </button>
              <button
                type="button"
                onClick={() => setBulkMode("remove")}
                className="rounded-lg px-4 py-3 text-sm font-semibold"
                style={bulkMode === "remove" ? btnPrimary : btnSecondary}
              >
                - Remove Leave
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto pr-1">
              <div>
                <label className="mb-2 block text-sm font-semibold" style={textPrimary}>
                  Employees *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsEmployeeDropdownOpen((value) => !value)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none"
                    style={inputMuted}
                  >
                    <span style={selectedEmployeeIds.length ? textPrimary : textSecondary}>
                      {selectedEmployeeIds.length
                        ? `${selectedEmployeeIds.length} employees selected`
                        : "Select employees..."}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 transition-transform ${
                        isEmployeeDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isEmployeeDropdownOpen && (
                    <div
                      className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 rounded-lg border p-2 shadow-xl"
                      style={card}
                    >
                      <div className="relative mb-2">
                        <Search
                          size={15}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                          style={textSecondary}
                        />
                        <input
                          value={employeeQuery}
                          autoFocus
                          onChange={(event) => setEmployeeQuery(event.target.value)}
                          placeholder="Search employee..."
                          className="w-full rounded-md py-2 pl-9 pr-3 text-sm outline-none"
                          style={inputMuted}
                        />
                      </div>

                      {drawerEmployees.slice(0, 6).map((employee) => (
                        <button
                          key={employee.id}
                          type="button"
                          onClick={() => {
                            toggleEmployeeSelection(employee.employee_id);
                            setEmployeeQuery("");
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm"
                        >
                          <span>
                            <span className="block font-semibold" style={textPrimary}>
                              {employee.name}
                            </span>
                            <span className="block text-xs" style={textSecondary}>
                              {employee.department || employee.employee_id.slice(-8)}
                            </span>
                          </span>
                          <span className="text-xs" style={textSecondary}>
                            {selectedEmployeeIds.includes(employee.employee_id) ? (
                              <Check size={16} />
                            ) : (
                              employee.employee_id.slice(-6)
                            )}
                          </span>
                        </button>
                      ))}

                      {drawerEmployees.length === 0 && (
                        <div className="px-3 py-2 text-sm" style={textSecondary}>
                          No employees found
                        </div>
                      )}

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEmployeeIds(rows.map((employee) => employee.employee_id));
                            setEmployeeQuery("");
                          }}
                          className="rounded-md px-3 py-2 text-sm font-semibold"
                          style={btnPrimary}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeIds([])}
                          className="rounded-md px-3 py-2 text-sm font-semibold"
                          style={btnSecondary}
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEmployeeDropdownOpen(false)}
                          className="rounded-md px-3 py-2 text-sm font-semibold"
                          style={btnSecondary}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <ConstrainedDropdown
                label="Leave Type *"
                value={leaveType}
                onChange={setLeaveType}
                options={[
                  { value: "", label: "Select leave type..." },
                  { value: "earned", label: "Earned Leave" },
                  { value: "casual", label: "Casual Leave" },
                  { value: "sick", label: "Sick Leave" },
                  { value: "comp-off", label: "Comp-Off" },
                ]}
                buttonStyle={inputMuted}
                labelStyle={textPrimary}
              />

              <ConstrainedDropdown
                label="Leave Allocation *"
                value={allocationDays}
                onChange={setAllocationDays}
                options={[
                  { value: "", label: "Select number of days..." },
                  { value: "0.5", label: "0.5 day" },
                  { value: "1", label: "1 day" },
                  { value: "1.5", label: "1.5 days" },
                  { value: "2", label: "2 days" },
                  { value: "3", label: "3 days" },
                ]}
                buttonStyle={inputMuted}
                labelStyle={textPrimary}
              />

              <div>
                <label className="mb-2 block text-sm font-semibold" style={textPrimary}>
                  Allocation Reason <span style={textSecondary}>(optional)</span>
                </label>
                <textarea
                  value={allocationReason}
                  onChange={(event) => setAllocationReason(event.target.value)}
                  placeholder="e.g. Annual allocation, performance bonus leave..."
                  rows={4}
                  className="w-full resize-none rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={inputMuted}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={closeBulkDrawer}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold"
                style={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyBulkAssignment}
                disabled={bulkSubmitting}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={btnPrimary}
              >
                {bulkSubmitting ? "Processing..." : `${bulkMode === "add" ? "Add" : "Remove"} Leave - ${selectedEmployeeIds.length} Employees`}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
