import type { LeaveBalance, LeaveRequest } from "../types/leave";
import { getFastApiBaseUrl } from "../config/fastApiConfig";
import { getAuthToken } from "../utils/auth";

const FASTAPI_BASE_URL = getFastApiBaseUrl();
const LOCAL_LEAVE_CACHE_KEY = "zenvora_leave_requests";
const EMPLOYEE_LEAVE_CACHE_KEY = "zenvora_employee_leave_cache";
const LOCAL_HR_NOTIFICATIONS_KEY = "zenvora_hr_notifications";
const LAST_LEAVE_EMPLOYEE_NAME_KEY = "zenvora_last_leave_employee_name";

type ApiLeave = {
  id: string;
  employee_id: string;
  employee_name?: string;
  leave_type: LeaveRequest["leave_type"];
  duration_type: LeaveRequest["duration_type"];
  leave_date: string;
  days: number;
  reason: string;
  status: LeaveRequest["status"];
  internal_status?: string;
  applied_date: string;
  manager_reviewed_at?: string | null;
  hr_reviewed_at?: string | null;
  manager_comment?: string | null;
  hr_comment?: string | null;
};

export type LeavePayload = Pick<LeaveRequest, "leave_type" | "duration_type" | "leave_date" | "days" | "reason">;

export type HrLeaveRequest = {
  id: string;
  employee: string;
  employee_id: string;
  department: string;
  type: string;
  days: number;
  status: string;
  internal_status?: string;
  date: string;
  reason: string;
  created_at?: string;
  manager_comment?: string | null;
  hr_comment?: string | null;
};

type LocalHrNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

function getAuthHeaders() {
  const token = getAuthToken();
  const userName = currentEmployeeName();
  const userId = currentEmployeeId();
  const userRole = localStorage.getItem("userRole") || localStorage.getItem("hr_userRole") || localStorage.getItem("manager_userRole") || "employee";

  return {
    "Content-Type": "application/json",
    "X-User-Id": userId,
    "X-User-Name": userName,
    "X-User-Role": userRole,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function currentEmployeeName() {
  const possibleNames = [
    localStorage.getItem("employee_userName"),
    localStorage.getItem("userName"),
    localStorage.getItem("employeeName"),
  ];

  return possibleNames.find((name) => !isGenericEmployeeName(name ?? undefined)) || localStorage.getItem("userEmail") || "Employee";
}

function rememberLeaveEmployeeName(name: string) {
  if (!isGenericEmployeeName(name)) {
    localStorage.setItem(LAST_LEAVE_EMPLOYEE_NAME_KEY, name);
  }
}

function currentEmployeeId() {
  return localStorage.getItem("userId") || localStorage.getItem("employee_userEmail") || localStorage.getItem("userEmail") || "demo";
}

function normalizeLeave(leave: ApiLeave): LeaveRequest {
  return {
    id: leave.id,
    employee_id: leave.employee_id,
    leave_type: leave.leave_type,
    duration_type: leave.duration_type,
    leave_date: leave.leave_date,
    days: leave.days,
    applied_date: leave.applied_date?.split("T")[0] ?? "",
    reason: leave.reason,
    status: leave.status,
    internal_status: leave.internal_status,
    submitted_at: leave.applied_date,
    manager_reviewed_at: leave.manager_reviewed_at ?? null,
    hr_reviewed_at: leave.hr_reviewed_at ?? null,
    manager_comment: leave.manager_comment ?? null,
    hr_comment: leave.hr_comment ?? null,
  };
}

function todayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function localLeaveCreatedDate(leave: HrLeaveRequest) {
  if (leave.created_at) return leave.created_at.split("T")[0];

  const [, timestamp] = leave.id.match(/^(?:local|demo)-(\d+)/) || [];
  if (timestamp) {
    const parsedDate = new Date(Number(timestamp));
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split("T")[0];
    }
  }

  return leave.date;
}

function keepOnlyTodayLocalLeaves(leaves: HrLeaveRequest[]) {
  const today = todayIsoDate();
  return leaves.filter((leave) => localLeaveCreatedDate(leave) === today);
}

function readLocalLeaves(): HrLeaveRequest[] {
  try {
    const leaves = JSON.parse(localStorage.getItem(LOCAL_LEAVE_CACHE_KEY) || "[]") as HrLeaveRequest[];
    const todayLeaves = keepOnlyTodayLocalLeaves(leaves);
    if (todayLeaves.length !== leaves.length) {
      writeLocalLeaves(todayLeaves);
    }

    return todayLeaves;
  } catch {
    return [];
  }
}

function writeEmployeeLeaveCache(leaves: HrLeaveRequest[]) {
  localStorage.setItem(EMPLOYEE_LEAVE_CACHE_KEY, JSON.stringify(leaves));
  localStorage.setItem("zenvora_leave_requests_ping", new Date().toISOString());
}

function writeLocalLeaves(leaves: HrLeaveRequest[]) {
  localStorage.setItem(LOCAL_LEAVE_CACHE_KEY, JSON.stringify(leaves));
  localStorage.setItem("zenvora_leave_requests_ping", new Date().toISOString());
}

function pingLeaveUpdates() {
  localStorage.setItem("zenvora_leave_requests_ping", new Date().toISOString());
  window.dispatchEvent(new CustomEvent("zenvora-leave-updated"));
}

function readLocalHrNotifications(): LocalHrNotification[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_HR_NOTIFICATIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocalHrNotifications(notifications: LocalHrNotification[]) {
  localStorage.setItem(LOCAL_HR_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  localStorage.setItem("zenvora_hr_notifications_ping", new Date().toISOString());
}

async function createHrNotificationApi(notification: Pick<LocalHrNotification, "title" | "message" | "type">) {
  const token = getAuthToken();

  try {
    await fetch(`${FASTAPI_BASE_URL}/api/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        ...notification,
        role: "hr",
      }),
    });
  } catch {
    // Local notification fallback below keeps the HR bell informed when Node API is not running.
  }
}

async function notifyHrAboutDeletedLeave(leave: Partial<LeaveRequest> | HrLeaveRequest | undefined, leaveId: string) {
  const leaveInfo = leave as Partial<LeaveRequest> & Partial<HrLeaveRequest> | undefined;
  const employee = leaveInfo?.employee || currentEmployeeName();
  const leaveType = leaveInfo?.type || leaveInfo?.leave_type || "Leave";
  const leaveDate = leaveInfo?.date || leaveInfo?.leave_date || "";
  const message = `${employee} had applied for ${leaveType}${leaveDate ? ` on ${leaveDate}` : ""}, but deleted the request.`;
  const notification = {
    id: `leave-deleted-${leaveId}-${new Date().getTime()}`,
    title: "Leave Request Deleted",
    message,
    type: "leave_deleted",
    read: false,
    createdAt: new Date().toISOString(),
  };

  writeLocalHrNotifications([
    notification,
    ...readLocalHrNotifications(),
  ]);
  window.dispatchEvent(new CustomEvent("zenvora-notification-updated"));
  await createHrNotificationApi(notification);
}

export function getLocalHrLeaves() {
  return mergeHrLeaves([], readLocalLeaves());
}

function toHrLeaveFromApi(leave: ApiLeave): HrLeaveRequest {
  return {
    id: leave.id,
    employee: getDisplayEmployeeName(leave.employee_name, leave.employee_id),
    employee_id: leave.employee_id,
    department: "Employee",
    type: leave.leave_type,
    days: leave.days,
    status: leave.status,
    internal_status: leave.internal_status,
    date: leave.leave_date,
    reason: leave.reason,
    manager_comment: leave.manager_comment ?? null,
    hr_comment: leave.hr_comment ?? null,
  };
}

function mergeHrLeaves(apiLeaves: HrLeaveRequest[], localLeaves: HrLeaveRequest[]) {
  const localOnlyLeaves = localLeaves.filter((leave) => leave.id.startsWith("local-") || leave.id.startsWith("demo-"));
  const byKey = new Map<string, HrLeaveRequest>();

  [...localOnlyLeaves, ...apiLeaves].forEach((leave) => {
    const key = `${leave.employee_id}-${leave.date}-${leave.type}-${leave.reason}`;
    const existing = byKey.get(key);
    if (existing && isGenericEmployeeName(leave.employee, leave.employee_id) && !isGenericEmployeeName(existing.employee, existing.employee_id)) {
      byKey.set(key, { ...leave, employee: existing.employee });
      return;
    }

    byKey.set(key, leave);
  });

  return Array.from(byKey.values());
}

function isGenericEmployeeName(name?: string, employeeId?: string) {
  const value = (name || "").trim().toLowerCase();
  return !value || value === "employee" || value === "demo" || value === (employeeId || "").trim().toLowerCase();
}

function getDisplayEmployeeName(employeeName?: string, employeeId?: string) {
  if (!isGenericEmployeeName(employeeName, employeeId)) return employeeName as string;
  const rememberedName = localStorage.getItem(LAST_LEAVE_EMPLOYEE_NAME_KEY);
  if (!isGenericEmployeeName(rememberedName ?? undefined)) return rememberedName as string;
  return employeeId || "Employee";
}

function toHrLeaveFromEmployeeLeave(leave: LeaveRequest): HrLeaveRequest {
  return {
    id: leave.id,
    employee: currentEmployeeName(),
    employee_id: leave.employee_id,
    department: "Employee",
    type: leave.leave_type,
    days: leave.days,
    status: leave.status,
    date: leave.leave_date,
    reason: leave.reason,
  };
}

function mergeEmployeeLeaves(apiLeaves: LeaveRequest[]) {
  writeEmployeeLeaveCache(apiLeaves.map(toHrLeaveFromEmployeeLeave));
  return apiLeaves;
}

export async function createLeave(payload: LeavePayload) {
  rememberLeaveEmployeeName(currentEmployeeName());

  const localLeave: HrLeaveRequest = {
    id: `local-${new Date().getTime()}`,
    employee: currentEmployeeName(),
    employee_id: currentEmployeeId(),
    department: "Employee",
    type: payload.leave_type,
    days: payload.days,
    status: "Pending",
    date: payload.leave_date,
    reason: payload.reason,
    created_at: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Leave API request failed");
    const data = normalizeLeave(await response.json());
    writeLocalLeaves(readLocalLeaves().filter((leave) => leave.id !== localLeave.id));
    pingLeaveUpdates();
    return data;
  } catch {
    writeLocalLeaves([localLeave, ...readLocalLeaves()]);
    window.dispatchEvent(new CustomEvent("zenvora-leave-updated"));
    return {
      id: localLeave.id,
      employee_id: localLeave.employee_id,
      leave_type: payload.leave_type,
      duration_type: payload.duration_type,
      leave_date: payload.leave_date,
      days: payload.days,
      applied_date: new Date().toISOString().split("T")[0],
      reason: payload.reason,
      status: "Pending",
      submitted_at: new Date().toISOString(),
      manager_reviewed_at: null,
      hr_reviewed_at: null,
    } satisfies LeaveRequest;
  }
}

export async function updateLeave(leaveId: string, payload: LeavePayload) {
  if (leaveId.startsWith("local-") || leaveId.startsWith("demo-")) {
    writeLocalLeaves(
      readLocalLeaves().map((leave) =>
        leave.id === leaveId
          ? {
            ...leave,
            type: payload.leave_type,
            days: payload.days,
            date: payload.leave_date,
            reason: payload.reason,
          }
          : leave
      )
    );
    window.dispatchEvent(new CustomEvent("zenvora-leave-updated"));
  } else {
    const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/${leaveId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Unable to update leave");
    return normalizeLeave(await response.json());
  }

  return {
    id: leaveId,
    employee_id: currentEmployeeId(),
    leave_type: payload.leave_type,
    duration_type: payload.duration_type,
    leave_date: payload.leave_date,
    days: payload.days,
    applied_date: new Date().toISOString().split("T")[0],
    reason: payload.reason,
    status: "Pending",
    submitted_at: new Date().toISOString(),
    manager_reviewed_at: null,
    hr_reviewed_at: null,
  } satisfies LeaveRequest;
}

export async function deleteLeave(leaveId: string, leave?: Partial<LeaveRequest> | HrLeaveRequest) {
  if (leaveId.startsWith("local-") || leaveId.startsWith("demo-")) {
    writeLocalLeaves(readLocalLeaves().filter((leave) => leave.id !== leaveId));
    await notifyHrAboutDeletedLeave(leave, leaveId);
    window.dispatchEvent(new CustomEvent("zenvora-leave-updated"));
    return;
  }

  const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/${leaveId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) throw new Error("Unable to delete leave");
  await notifyHrAboutDeletedLeave(leave, leaveId);
  window.dispatchEvent(new CustomEvent("zenvora-leave-updated"));
}

export async function fetchMyLeaves() {
  const employeeId = currentEmployeeId();

  try {
    const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/my?limit=100`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error("Unable to fetch employee leaves");
    const result = await response.json();
    const apiLeaves = (result.data || []).map(normalizeLeave) as LeaveRequest[];
    return mergeEmployeeLeaves(apiLeaves);
  } catch {
    // API unavailable — show local pending leaves for this employee
    const localLeaves = readLocalLeaves()
      .filter((l) => l.employee_id === employeeId || l.id.startsWith("local-") || l.id.startsWith("demo-"))
      .map((l): LeaveRequest => ({
        id: l.id,
        employee_id: l.employee_id,
        leave_type: l.type as LeaveRequest["leave_type"],
        duration_type: "Full Day" as LeaveRequest["duration_type"],
        leave_date: l.date,
        days: l.days,
        applied_date: new Date().toISOString().split("T")[0],
        reason: l.reason,
        status: l.status as LeaveRequest["status"],
        submitted_at: new Date().toISOString(),
        manager_reviewed_at: null,
        hr_reviewed_at: null,
      }));
    return localLeaves;
  }
}

export async function fetchLeaveBalance() {
  const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/balance/my`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) throw new Error("Unable to fetch leave balance");
  const data = await response.json();
  return {
    id: data.employee_id,
    employee_id: data.employee_id,
    year: data.year,
    earned: data.earned,
    used: data.used,
    remaining: data.remaining,
  } satisfies LeaveBalance;
}

export async function fetchHrLeaves() {
  const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/?limit=100`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) throw new Error("Unable to fetch HR leaves");
  const result = await response.json();
  const apiLeaves = (result.data || []) as ApiLeave[];
  return mergeHrLeaves(apiLeaves.map(toHrLeaveFromApi), readLocalLeaves()) satisfies HrLeaveRequest[];
}

export async function updateHrLeaveStatus(leaveId: string, status: "approved" | "rejected", comment?: string) {
  if (leaveId.startsWith("local-") || leaveId.startsWith("demo-")) {
    const displayStatus = status === "approved" ? "Approved" : "Rejected";
    writeLocalLeaves(readLocalLeaves().map((leave) => (leave.id === leaveId ? { ...leave, status: displayStatus } : leave)));
    return;
  }

  const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/${leaveId}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),

    body: JSON.stringify({ status, comment: comment || "" }),
  });

  if (!response.ok) throw new Error("Unable to update leave status");
  pingLeaveUpdates();
}

function getManagerAuthHeaders() {
  const token = getAuthToken();
  const userName = currentEmployeeName();
  const userId = currentEmployeeId();
  const userRole = localStorage.getItem("manager_userRole") || localStorage.getItem("hr_userRole") || localStorage.getItem("userRole") || "manager";

  return {
    "Content-Type": "application/json",
    "X-User-Id": userId,
    "X-User-Name": userName,
    "X-User-Role": userRole,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchManagerLeaves() {
  const headers = getManagerAuthHeaders();
  const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/manager`, { headers });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to fetch manager leaves (${response.status}): ${text}`);
  }
  const result = await response.json();
  const apiLeaves = (result.data || []) as ApiLeave[];
  return apiLeaves.map(toHrLeaveFromApi) satisfies HrLeaveRequest[];
}

export async function updateManagerLeaveStatus(leaveId: string, status: "manager_approved" | "manager_rejected", comment?: string) {
  const reviewComment = comment?.trim();
  if (!reviewComment) {
    throw new Error("Manager reason is required");
  }

  if (leaveId.startsWith("local-") || leaveId.startsWith("demo-")) {
    writeLocalLeaves(
      readLocalLeaves().map((leave) =>
        leave.id === leaveId ? { ...leave, status, internal_status: status, manager_comment: reviewComment } : leave
      )
    );
    return;
  }

  const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/${leaveId}/manager-status`, {
    method: "PATCH",
    headers: getManagerAuthHeaders(),
    body: JSON.stringify({ status, comment: reviewComment }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to update leave status");
  }
  pingLeaveUpdates();
}

export type ApiLeaveBalance = {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  year: number;
  earned: number;
  used: number;
  remaining: number;
};

export async function fetchAllLeaveBalances(year?: number): Promise<ApiLeaveBalance[]> {
  const params = year ? `?year=${year}` : "";
  const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/balances${params}`, {
    headers: getManagerAuthHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to fetch leave balances (${response.status}): ${text}`);
  }

  const result = await response.json();
  return (result.data || []) as ApiLeaveBalance[];
}

export async function createLeaveBalance(data: {
  employee_id: string;
  employee_name?: string;
  department?: string;
  year?: number;
  earned?: number;
  used?: number;
  remaining?: number;
}): Promise<ApiLeaveBalance> {
  const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/balances`, {
    method: "POST",
    headers: getManagerAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to create leave balance (${response.status}): ${text}`);
  }

  return response.json();
}

export async function updateLeaveBalance(
  employeeId: string,
  data: { earned?: number; used?: number; remaining?: number },
  year?: number
): Promise<ApiLeaveBalance> {
  const params = year ? `?year=${year}` : "";
  const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/balances/${employeeId}${params}`, {
    method: "PATCH",
    headers: getManagerAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to update leave balance (${response.status}): ${text}`);
  }

  return response.json();
}

export async function resetYearBalances(year?: number, earned: number = 18): Promise<{ message: string }> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  params.set("earned", String(earned));

  const response = await fetch(`${FASTAPI_BASE_URL}/api/leaves/balances/reset-year?${params.toString()}`, {
    method: "POST",
    headers: getManagerAuthHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to reset year balances (${response.status}): ${text}`);
  }

  return response.json();
}
