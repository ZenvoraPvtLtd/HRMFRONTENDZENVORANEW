import { getApiBaseUrl } from "../config/apiConfig";

const API_BASE_URL = getApiBaseUrl();
const HOLIDAYS_BASE = `${API_BASE_URL}/api/holidays`;

async function handleResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || response.statusText || "API request failed");
  }
  return payload;
}

export async function fetchHolidays() {
  const response = await fetch(`${HOLIDAYS_BASE}`);
  return handleResponse(response);
}

export async function createHoliday(payload: {
  title: string;
  date: string;
  type: string;
}) {
  const response = await fetch(`${HOLIDAYS_BASE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function updateHoliday(
  holidayId: number | string,
  payload: {
    title: string;
    date: string;
    type: string;
  }
) {
  const response = await fetch(`${HOLIDAYS_BASE}/${holidayId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function deleteHoliday(holidayId: number | string) {
  const response = await fetch(`${HOLIDAYS_BASE}/${holidayId}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}
