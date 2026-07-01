import { getApiBaseUrl } from "../config/apiConfig";

const API_BASE_URL = getApiBaseUrl();
const EMPLOYEES_BASE = `${API_BASE_URL}/api/employees`;

async function handleResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || response.statusText || "API request failed");
  }
  return payload;
}

export async function fetchEmployeeList() {
  const response = await fetch(`${EMPLOYEES_BASE}`);
  return handleResponse(response);
}

export async function fetchEmployeeById(employeeId: string) {
  const response = await fetch(`${EMPLOYEES_BASE}/${employeeId}`);
  return handleResponse(response);
}

export async function fetchEmployeeOnboardingChecklist(employeeId: string) {
  const response = await fetch(`${EMPLOYEES_BASE}/${employeeId}/onboarding-checklist`);
  return handleResponse(response);
}

export async function updateEmployeeOnboardingTask(employeeId: string, taskId: string, status: string) {
  const response = await fetch(`${EMPLOYEES_BASE}/${employeeId}/onboarding-checklist/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return handleResponse(response);
}

export async function fetchEmployeeStats() {
  const response = await fetch(`${EMPLOYEES_BASE}/stats/summary`);
  return handleResponse(response);
}

export async function createEmployee(payload: {
  name: string;
  email: string;
  department: string;
  role: string;
  productivity: number;
  status: string;
}) {
  const response = await fetch(`${EMPLOYEES_BASE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateEmployee(
  employeeId: string,
  payload: Partial<{
    name: string;
    email: string;
    department: string;
    role: string;
    productivity: number;
    status: string;
    phoneNumber: string;
    joinDate: string;
    hireDate: string;
    manager: string;
    jobTitle: string;
    skills: string[];
    dateOfBirth: string;
    address: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    salary: string;
    uanNumber: string;
    simNumber: string;
    probationPeriodDays: number;
    noticePeriodDays: number;
    fnfDueDays: number;
    reportingTime: string;
    workingHoursPerDay: number;
    onboardingStatus: string;
  }>,
) {
  const response = await fetch(`${EMPLOYEES_BASE}/${employeeId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteEmployee(employeeId: string) {
  const response = await fetch(`${EMPLOYEES_BASE}/${employeeId}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}

export async function suspendEmployee(employeeId: string) {
  const response = await fetch(`${EMPLOYEES_BASE}/${employeeId}/suspend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return handleResponse(response);
}
