import { getApiBaseUrl } from "../config/apiConfig";

const API_BASE = getApiBaseUrl();

export type HrAttendanceRow = {
  id: string;
  recordId: string | null;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  shift: string;
  workMode: string;
  status: string;
  clockIn: string;
  clockOut: string;
  date: string;
  note: string;
  source?: string | null;
  marked: boolean;
  updatedAt?: string;
  createdAt?: string;
};

export type HrAttendanceSummary = {
  total: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  remote?: number;
  marked?: number;
  checkedIn?: number;
  onTime?: number;
  earlyOut?: number;
  rate?: number;
};

export type HrAttendanceFilters = {
  start: string;
  end?: string;
  status?: string;
  department?: string;
  employeeId?: string;
  search?: string;
  includeAbsent?: boolean;
};

export type AttendanceFormPayload = {
  employeeId: string;
  date: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  shift?: string;
  workMode?: string;
  note?: string;
};

export type HrEmployeeOption = {
  id: string;
  name: string;
  department: string;
};

function getAuthHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("hr_accessToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("manager_accessToken");

  const userId =
    localStorage.getItem("hr_userId") ||
    localStorage.getItem("userId") ||
    localStorage.getItem("employee_userId") ||
    "";

  const userName =
    localStorage.getItem("hr_userName") ||
    localStorage.getItem("userName") ||
    localStorage.getItem("employee_userName") ||
    "";

  const userRole =
    localStorage.getItem("hr_userRole") ||
    localStorage.getItem("userRole") ||
    localStorage.getItem("manager_userRole") ||
    "hr";

  return {
    "Content-Type": "application/json",
    "X-User-Id": userId,
    "X-User-Name": userName,
    "X-User-Role": userRole,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (data as { detail?: string | { msg?: string }[] }).detail;
    if (Array.isArray(detail)) {
      throw new Error(detail.map((item) => item.msg || JSON.stringify(item)).join(", "));
    }
    throw new Error(
      (typeof detail === "string" && detail) ||
        (data as { message?: string }).message ||
        "Request failed",
    );
  }
  return data as T;
}

export async function fetchHrAttendance(filters: HrAttendanceFilters): Promise<{
  data: HrAttendanceRow[];
  summary: HrAttendanceSummary;
  departments: string[];
  employees: HrEmployeeOption[];
}> {
  const params = new URLSearchParams({
    start: filters.start,
    end: filters.end || filters.start,
    status: filters.status || "All",
    department: filters.department || "All Departments",
    employee_id: filters.employeeId || "All Employees",
    search: filters.search || "",
    include_absent: String(filters.includeAbsent !== false),
  });

  const response = await fetch(`${API_BASE}/api/hr/attendance?${params.toString()}`, {
    headers: getAuthHeaders(),
  });

  const payload = await parseResponse<{
    success: boolean;
    data: HrAttendanceRow[];
    summary: HrAttendanceSummary;
    departments: string[];
    employees: HrEmployeeOption[];
  }>(response);

  return {
    data: payload.data || [],
    summary: payload.summary || { total: 0, present: 0, absent: 0, late: 0, onLeave: 0 },
    departments: payload.departments || [],
    employees: payload.employees || [],
  };
}

export async function createHrAttendance(payload: AttendanceFormPayload): Promise<HrAttendanceRow> {
  const response = await fetch(`${API_BASE}/api/hr/attendance`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      employee_id: payload.employeeId,
      date: payload.date,
      status: payload.status,
      checkInTime: payload.checkInTime || undefined,
      checkOutTime: payload.checkOutTime || undefined,
      shift: payload.shift || undefined,
      workMode: payload.workMode || "On-site",
      note: payload.note || undefined,
    }),
  });

  const result = await parseResponse<{ data: HrAttendanceRow }>(response);
  return result.data;
}

export async function updateHrAttendance(
  attendanceId: string,
  payload: Partial<AttendanceFormPayload>,
): Promise<HrAttendanceRow> {
  const response = await fetch(`${API_BASE}/api/hr/attendance/${encodeURIComponent(attendanceId)}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      date: payload.date,
      status: payload.status,
      checkInTime: payload.checkInTime,
      checkOutTime: payload.checkOutTime,
      shift: payload.shift,
      workMode: payload.workMode,
      note: payload.note,
    }),
  });

  const result = await parseResponse<{ data: HrAttendanceRow }>(response);
  return result.data;
}

export async function deleteHrAttendance(attendanceId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/hr/attendance/${encodeURIComponent(attendanceId)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  await parseResponse<{ success: boolean }>(response);
}

export const ATTENDANCE_STATUS_OPTIONS = [
  "Present",
  "Absent",
  "Late",
  "On Leave",
  "Remote",
];

export const WORK_MODE_OPTIONS = ["On-site", "Remote", "Hybrid"];
