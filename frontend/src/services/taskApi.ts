import { getApiBaseUrl } from "../config/apiConfig";
import { getAuthToken } from "../utils/auth";

const BASE = () => `${getApiBaseUrl()}/api`;

function authHeaders(extra: Record<string, string> = {}) {
  const token = getAuthToken();
  const userName =
    localStorage.getItem("hr_userName") ||
    localStorage.getItem("employee_userName") ||
    localStorage.getItem("userName") ||
    "";
  return {
    "Content-Type": "application/json",
    ...(userName ? { "X-User-Name": userName } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export type ApiTask = {
  _id?: string;
  id?: string;
  title: string;
  workType?: string;
  description?: string;
  priority?: string;
  dueDate?: string | null;
  estimatedHours?: string | number;
  estimatedMinutes?: string | number;
  assignee?: string;
  reporter?: string;
  labels?: string | string[];
  status?: string;
  sprintId?: string;
};

export async function fetchTasks(sprintId?: string) {
  const query = sprintId ? `?sprintId=${encodeURIComponent(sprintId)}` : "";
  const res = await fetch(`${BASE()}/tasks${query}`, { headers: authHeaders() });
  return res.json();
}

export async function fetchMyTasks(assignee?: string) {
  const userName =
    assignee ||
    localStorage.getItem("hr_userName") ||
    localStorage.getItem("employee_userName") ||
    localStorage.getItem("userName") ||
    "";
  const query = userName ? `?assignee=${encodeURIComponent(userName)}` : "";
  const res = await fetch(`${BASE()}/tasks/my${query}`, { headers: authHeaders() });
  return res.json();
}

export async function fetchTaskById(taskId: string) {
  const res = await fetch(`${BASE()}/tasks/${taskId}`, { headers: authHeaders() });
  return res.json();
}

export async function createTask(body: Record<string, unknown>, sprintId?: string) {
  const res = await fetch(`${BASE()}/tasks`, {
    method: "POST",
    headers: authHeaders(sprintId ? { "X-Sprint-Id": sprintId } : {}),
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function updateTask(taskId: string, updates: Record<string, unknown>) {
  const res = await fetch(`${BASE()}/tasks/${taskId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function updateTaskStatus(taskId: string, status: string) {
  const res = await fetch(`${BASE()}/tasks/${taskId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function deleteTask(taskId: string) {
  const res = await fetch(`${BASE()}/tasks/${taskId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.json();
}

export async function fetchTeamUsers() {
  const res = await fetch(`${BASE()}/auth/team-users`, { headers: authHeaders() });
  return res.json();
}
