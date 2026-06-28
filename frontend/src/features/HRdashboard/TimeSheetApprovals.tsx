import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  RefreshCcw,
  XCircle,
  Search,
} from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, ValueFormatterParams } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { useTheme } from "../../context/ThemeContext";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import RefreshButton from "../../components/button/RefreshButton";
import { getFastApiBaseUrl } from "../../config/fastApiConfig";
import {
  btnPrimary,
  getStatusStyle,
  HR_YEAR_OPTIONS,
  hrPageWrap,
} from "./hrTheme";

ModuleRegistry.registerModules([AllCommunityModule]);

const FASTAPI_BASE_URL = getFastApiBaseUrl();
const TIMESHEETS_API_URL = `${FASTAPI_BASE_URL}/api/timesheets`;
const darkTextPrimary = { color: "var(--text-primary)" };
const darkTextSecondary = { color: "var(--text-secondary)" };
const darkCard = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};
const darkInput = {
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};
const darkBtnSecondary = {
  background: "var(--text-primary)",
  border: "1px solid var(--border)",
  color: "var(--bg-primary)",
};

type TimesheetRecord = {
  id: string;
  employeeId: string;
  employee: string;
  email: string;
  department: string;
  month: string;
  monthNumber: number;
  year: string;
  status: "Submitted" | "Not Submitted" | "Approved" | "Pending" | "Rejected";
  submitted: boolean;
  hours: number;
  attendanceCount: number;
  approvalComment?: string | null;
  reviewedAt?: string | null;
};

type TimesheetSummary = {
  total: number;
  submitted: number;
  notSubmitted: number;
  pending: number;
  approved: number;
  rejected: number;
};

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getAuthHeaders() {
  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("hr_accessToken") ||
    localStorage.getItem("token");
  const userRole =
    localStorage.getItem("userRole") ||
    localStorage.getItem("hr_userRole") ||
    "hr";
  const userName =
    localStorage.getItem("userName") ||
    localStorage.getItem("hr_userName") ||
    "HR";
  const userId =
    localStorage.getItem("userId") ||
    localStorage.getItem("hr_userEmail") ||
    localStorage.getItem("userEmail") ||
    "hr";

  return {
    "Content-Type": "application/json",
    "X-User-Role": userRole,
    "X-User-Name": userName,
    "X-User-Id": userId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function currentMonthName() {
  return months[new Date().getMonth()] || "June";
}

function currentYear() {
  return String(new Date().getFullYear());
}

function monthNumber(monthName: string) {
  return Math.max(months.indexOf(monthName), 0) + 1;
}

function statusStyleKey(status: TimesheetRecord["status"]) {
  if (status === "Not Submitted" || status === "Rejected") return "Rejected";
  return status;
}

export default function TimesheetApprovals() {
  const { isDark } = useTheme();

  const agTheme = themeQuartz.withParams({
    backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
    foregroundColor: isDark ? "#ffffff" : "#000000",
    headerBackgroundColor: isDark ? "#111111" : "#f3f4f6",
    headerTextColor: isDark ? "#ffffff" : "#111111",
    rowHoverColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
    borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    oddRowBackgroundColor: isDark ? "#0d0d0d" : "#fafafa",
    cellTextColor: isDark ? "#ffffff" : "#111111",
    secondaryForegroundColor: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
    paginationBackgroundColor: isDark ? "#0a0a0a" : "#ffffff",
    cellFocusBorderColor: "transparent",
    rangeSelectionBorderColor: "transparent",
  });
  const [search, setSearch] = useTopHeaderSearch();
  const [records, setRecords] = useState<TimesheetRecord[]>([]);
  const [summary, setSummary] = useState<TimesheetSummary>({
    total: 0,
    submitted: 0,
    notSubmitted: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [month, setMonth] = useState(currentMonthName);
  const [year, setYear] = useState(currentYear);
  const [submittedOnly, setSubmittedOnly] = useState(true);
  const [department, setDepartment] = useState("All Departments");
  const [status, setStatus] = useState("All Status");
  const [sortBy, setSortBy] = useState<"employee" | "employeeId" | "hours" | "status">("employee");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchTimesheets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        month: String(monthNumber(month)),
        year,
        submitted_only: "false",
      });
      const response = await fetch(`${TIMESHEETS_API_URL}/approvals?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || data.message || "Unable to load timesheets");
      }

      setRecords(Array.isArray(data.data) ? data.data : []);
      setSummary(data.summary || {
        total: 0,
        submitted: 0,
        notSubmitted: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      });
    } catch (requestError) {
      setRecords([]);
      setError(requestError instanceof Error ? requestError.message : "Unable to load timesheets");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    // call async function to avoid calling setState synchronously within effect
    (async () => {
      await fetchTimesheets();
    })();
  }, [fetchTimesheets]);

  const departments = useMemo(
    () => [
      "All Departments",
      ...Array.from(new Set(records.map((record) => record.department))),
    ],
    [records],
  );

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = records.filter((record) => {
      const matchesMonth = record.month === month;
      const matchesYear = record.year === year;
      const matchesSearch =
        !query ||
        [
          record.employee,
          record.email,
          record.employeeId,
          record.department,
          record.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesSubmitted = !submittedOnly || record.submitted;
      const matchesDepartment =
        department === "All Departments" || record.department === department;
      const matchesStatus = status === "All Status" || record.status === status;

      return (
        matchesMonth &&
        matchesYear &&
        matchesSearch &&
        matchesSubmitted &&
        matchesDepartment &&
        matchesStatus
      );
    });

    return [...filtered].sort((a, b) => {
      let valA = a[sortBy] ?? "";
      let valB = b[sortBy] ?? "";

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [department, month, records, search, status, submittedOnly, year, sortBy, sortOrder]);

  const handleRefresh = () => {
    setSearch("");
    setMonth("June");
    setYear("2026");
    setSubmittedOnly(true);
    setDepartment("All Departments");
    setStatus("All Status");
    setSortBy("employee");
    setSortOrder("asc");
    setMessage("");
    fetchTimesheets();
  };

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 100,
  }), []);

  const EmployeeCellRenderer = (params: ICellRendererParams<TimesheetRecord>) => {
    if (!params.data) return null;
    return (
      <div style={{ padding: "6px 0", lineHeight: 1.4 }}>
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
          {params.data.employee}
        </div>
        <div style={{ fontSize: "0.75rem", marginTop: "2px", color: "var(--text-secondary)", wordBreak: "break-all" }}>
          {params.data.email}
        </div>
      </div>
    );
  };

  const StatusCellRenderer = (params: ICellRendererParams<TimesheetRecord>) => {
    if (!params.data) return null;
    return (
      <span
        className="inline-flex px-3 py-1 rounded-full text-xs font-semibold"
        style={getStatusStyle(statusStyleKey(params.data.status))}
      >
        {params.data.status}
      </span>
    );
  };

  const ActionsCellRenderer = (params: ICellRendererParams<TimesheetRecord>) => {
    const record = params.data;
    if (!record) return null;
    const { updateTimesheetStatus: updateStatus, submittingId: currentSubmittingId } = params.context;

    // Not submitted — no action available
    if (!record.submitted) {
      return (
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
          No submission
        </span>
      );
    }

    const isProcessing = currentSubmittingId === record.id;
    const status = record.status;

    // Final states — show compact badge only, no buttons
    if (status === "Approved") {
      return (
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "rgba(16,185,129,0.18)", color: "#10b981", border: "1px solid rgba(16,185,129,0.4)", display: "inline-flex", width: "fit-content" }}>
          <CheckCircle2 size={13} /> Approved
        </div>
      );
    }

    if (status === "Rejected") {
      return (
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "rgba(239,68,68,0.18)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", display: "inline-flex", width: "fit-content" }}>
          <XCircle size={13} /> Rejected
        </div>
      );
    }

    // Submitted / Pending — show action buttons (same style as LeaveManagement)
    const isApproved = status === "Approved";
    const isRejected = status === "Rejected";

    return (
      <div style={{ display: "flex", gap: "0.5rem", padding: "4px 0", alignItems: "center" }}>
        <button
          onClick={() => updateStatus(record, "Approved")}
          disabled={isProcessing}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
          style={
            isApproved
              ? { background: "rgba(16,185,129,0.18)", color: "#10b981", border: "1px solid rgba(16,185,129,0.4)" }
              : isProcessing
              ? { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", opacity: 0.4, cursor: "default" }
              : { background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)", cursor: "pointer" }
          }
        >
          <CheckCircle2 size={13} /> Approve
        </button>
        <button
          onClick={() => updateStatus(record, "Rejected")}
          disabled={isProcessing}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity"
          style={
            isRejected
              ? { background: "rgba(239,68,68,0.18)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }
              : isProcessing
              ? { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", opacity: 0.4, cursor: "default" }
              : { background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", cursor: "pointer" }
          }
        >
          <XCircle size={13} /> Reject
        </button>
      </div>
    );
  };

  const columnDefs = useMemo<ColDef<TimesheetRecord>[]>(() => [
    {
      headerName: "Employee",
      field: "employee",
      cellRenderer: EmployeeCellRenderer,
      minWidth: 220,
      flex: 2,
      autoHeight: true,
      wrapText: true,
    },
    {
      headerName: "Employee ID",
      field: "employeeId",
      minWidth: 120,
    },
    {
      headerName: "Department",
      field: "department",
      minWidth: 130,
    },
    {
      headerName: "Hours",
      field: "hours",
      valueFormatter: (params: ValueFormatterParams<TimesheetRecord, number>) =>
        params.value ? `${params.value} hrs` : "-",
      minWidth: 100,
    },
    {
      headerName: "Status",
      field: "status",
      cellRenderer: StatusCellRenderer,
      minWidth: 130,
    },
    {
      headerName: "Actions",
      field: "id",
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      minWidth: 180,
    },
  ], []);

  const updateTimesheetStatus = async (
    record: TimesheetRecord,
    nextStatus: "Approved" | "Rejected",
  ) => {
    // Show loading indicator for the specific row
    setSubmittingId(record.id);
    setError("");
    setMessage("");

    try {
      // Build query params for month and year context
      const params = new URLSearchParams({
        month: String(monthNumber(month)),
        year,
      });

      // Use the timesheet record ID for the endpoint (more reliable than employeeId)
      const endpoint = `${TIMESHEETS_API_URL}/approvals/${encodeURIComponent(record.id)}/status?${params.toString()}`;

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: nextStatus,
          comment: `${nextStatus} from Timesheet Approvals`,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || data.message || "Unable to update timesheet");
      }

      // Show a short success message and refresh the list
      setMessage(data.message || `Timesheet ${nextStatus.toLowerCase()}`);
      await fetchTimesheets();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update timesheet");
    } finally {
      // Reset the submitting state regardless of outcome
      setSubmittingId(null);
    }
  };

  return (
    <div className={`${hrPageWrap} w-full`}>
      <div className="max-w-[1280px] mx-auto">
        <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
            <ConstrainedDropdown
              value={month}
              onChange={setMonth}
              options={months}
              className="w-full sm:w-36"
              buttonStyle={darkInput}
            />

            <ConstrainedDropdown
              value={year}
              onChange={setYear}
              options={HR_YEAR_OPTIONS}
              className="w-full sm:w-32"
              buttonStyle={darkInput}
            />
        </div>

        <div className="rounded-xl p-4 mb-6" style={darkCard}>
          <div className="flex flex-wrap items-center gap-4">
            {/* Search Input on Page */}
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={darkTextSecondary}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search timesheets..."
                className="w-full h-10 pl-9 pr-4 rounded-lg text-sm outline-none border transition-colors"
                style={darkInput}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>

            {/* Sort Control */}
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold" style={darkTextSecondary}>Sort:</span>
              <ConstrainedDropdown
                value={sortBy === "employee" ? "Name" : sortBy === "employeeId" ? "ID" : sortBy === "hours" ? "Hours" : "Status"}
                onChange={(val) => {
                  if (val === "Name") setSortBy("employee");
                  else if (val === "ID") setSortBy("employeeId");
                  else if (val === "Hours") setSortBy("hours");
                  else if (val === "Status") setSortBy("status");
                }}
                options={["Name", "ID", "Hours", "Status"]}
                className="w-28 h-10"
                buttonStyle={{ ...darkInput, height: "40px" }}
              />
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                className="h-10 w-10 rounded-lg flex items-center justify-center border hover:opacity-80 transition-opacity"
                style={darkInput}
                title={sortOrder === "asc" ? "Ascending" : "Descending"}
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </button>
            </div>

            {/* Department Dropdown */}
            <div className="w-48">
              <ConstrainedDropdown
                value={department}
                onChange={setDepartment}
                options={departments}
                className="h-10"
                buttonStyle={{ ...darkInput, height: "40px" }}
              />
            </div>

            {/* Status Dropdown */}
            <div className="w-40">
              <ConstrainedDropdown
                value={status}
                onChange={setStatus}
                options={["All Status", "Submitted", "Pending", "Approved", "Not Submitted"]}
                className="h-10"
                buttonStyle={{ ...darkInput, height: "40px" }}
              />
            </div>

            {/* Submitted Only Checkbox */}
            <label
              className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer"
              style={darkTextPrimary}
            >
              <input
                type="checkbox"
                checked={submittedOnly}
                onChange={(event) => setSubmittedOnly(event.target.checked)}
                className="h-4 w-4 accent-green-600 rounded"
              />
              <span>Submitted</span>
            </label>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="h-10 px-4 ml-auto rounded-lg inline-flex items-center justify-center gap-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
              style={btnPrimary}
            >
              <RefreshCcw size={15} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {(loading || error || message) && (
          <div
            className="mb-5 rounded-lg px-4 py-3 text-sm font-semibold"
            style={error ? getStatusStyle("Rejected") : getStatusStyle(loading ? "In Progress" : "Completed")}
          >
            {loading ? "Loading timesheets..." : error || message}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-8 mb-5">
          <SummaryPill
            icon={<CheckCircle2 size={16} />}
            label={`${summary.submitted} Submitted`}
            status="Submitted"
          />
          <SummaryPill
            icon={<XCircle size={16} />}
            label={`${summary.notSubmitted} Not Submitted`}
            status="Rejected"
          />
        </div>

        <div className="timesheet-approvals-grid rounded-xl overflow-hidden" style={darkCard}>
          <div style={{ height: 500, width: "100%" }}>
            <AgGridReact<TimesheetRecord>
              theme={agTheme}
              rowData={filteredRecords}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              pagination={true}
              paginationPageSize={10}
              paginationPageSizeSelector={[10, 20, 50, 100]}
              rowSelection="multiple"
              suppressRowClickSelection={true}
              suppressCellFocus={true}
              animateRows={true}
              loading={loading}
              overlayNoRowsTemplate={`<span style="padding: 10px; color: var(--text-secondary);">No timesheets found</span>`}
              overlayLoadingTemplate={`<span style="padding: 10px; color: var(--text-secondary);">Loading timesheets...</span>`}
              context={{ updateTimesheetStatus, submittingId, btnPrimary, btnSecondary: darkBtnSecondary, textSecondary: darkTextSecondary }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryPill({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 text-sm font-semibold">
      <span className="inline-flex items-center justify-center" style={getStatusStyle(status)}>
        {icon}
      </span>
      <span style={darkTextPrimary}>{label}</span>
    </div>
  );
}
