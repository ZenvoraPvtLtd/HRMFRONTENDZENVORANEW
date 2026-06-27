import { getFastApiBaseUrl } from "../config/fastApiConfig";

const FASTAPI_BASE_URL = getFastApiBaseUrl();

export type ProductivityMember = {
  id: string;
  name: string;
};

export type ProductivityEntry = {
  employee_id: string;
  employee_name: string;
  team_name: string;
  activity_date: string;
  tasks_assigned: number;
  tasks_completed: number;
  idle_minutes: number;
  overtime_minutes: number;
  productivity_score: number;
  status: string;
};

export type ProductivitySummary = {
  total_entries: number;
  total_members: number;
  avg_productivity: number;
  completion_rate: number;
  total_tasks_assigned: number;
  total_tasks_completed: number;
  total_idle_minutes: number;
  total_overtime_minutes: number;
};

export type ProductivityPrediction = {
  employee_id: string;
  employee_name: string;
  team_name: string;
  burnout_risk: number;
  burnout_level: string;
  resignation_probability: number;
  resignation_level: string;
  performance_drop: number;
  performance_drop_level: string;
};

export type ManagerProductivityResponse = {
  filters: {
    start_date: string;
    end_date: string;
    employee_id?: string | null;
    team_name?: string | null;
  };
  members: ProductivityMember[];
  teams: string[];
  summary: ProductivitySummary;
  entries: ProductivityEntry[];
};

export type ProductivityPredictionResponse = {
  filters: ManagerProductivityResponse["filters"];
  predictions: ProductivityPrediction[];
};

function getManagerHeaders() {
  const token =
    localStorage.getItem("manager_accessToken") ||
    localStorage.getItem("hr_accessToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token");
  const storedRole = localStorage.getItem("manager_userRole") || localStorage.getItem("hr_userRole") || localStorage.getItem("userRole") || "manager";
  const normalizedRole = storedRole.trim().toLowerCase();
  const userRole = ["manager", "hr", "admin"].includes(normalizedRole) ? normalizedRole : "manager";

  return {
    "Content-Type": "application/json",
    "X-User-Role": userRole,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchManagerProductivity(params: {
  startDate: string;
  endDate: string;
  employeeId?: string;
  teamName?: string;
}) {
  const query = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  });

  if (params.employeeId) {
    query.set("employee_id", params.employeeId);
  }
  if (params.teamName) {
    query.set("team_name", params.teamName);
  }

  const response = await fetch(`${FASTAPI_BASE_URL}/manager/productivity?${query.toString()}`, {
    headers: getManagerHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to fetch manager productivity");
  }

  return (await response.json()) as ManagerProductivityResponse;
}

export async function fetchProductivityPredictions(params: {
  startDate: string;
  endDate: string;
  employeeId?: string;
  teamName?: string;
}) {
  const query = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  });

  if (params.employeeId) {
    query.set("employee_id", params.employeeId);
  }
  if (params.teamName) {
    query.set("team_name", params.teamName);
  }

  const response = await fetch(`${FASTAPI_BASE_URL}/manager/productivity/predictions?${query.toString()}`, {
    headers: getManagerHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to fetch productivity predictions");
  }

  return (await response.json()) as ProductivityPredictionResponse;
}
