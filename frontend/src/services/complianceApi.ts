import { getApiBaseUrl } from "../config/apiConfig";

const COMPLIANCE_BASE = `${getApiBaseUrl()}/api/compliance`;

export type CompliancePayload = {
  employeeId: string;
  type: string;
  registrationNumber: string;
  amount: string;
  period: string;
};

async function handleResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.message || response.statusText || "API request failed");
  }
  return payload;
}

export async function fetchComplianceRecords() {
  const response = await fetch(COMPLIANCE_BASE);
  return handleResponse(response);
}

export async function fetchComplianceRecord(recordId: number | string) {
  const response = await fetch(`${COMPLIANCE_BASE}/${recordId}`);
  return handleResponse(response);
}

export async function createComplianceRecord(payload: CompliancePayload) {
  const response = await fetch(COMPLIANCE_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateComplianceRecord(
  recordId: number | string,
  payload: CompliancePayload,
) {
  const response = await fetch(`${COMPLIANCE_BASE}/${recordId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteComplianceRecord(recordId: number | string) {
  const response = await fetch(`${COMPLIANCE_BASE}/${recordId}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}
