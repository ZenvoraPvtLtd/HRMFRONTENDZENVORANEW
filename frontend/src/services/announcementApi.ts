import { getFastApiBaseUrl } from "../config/fastApiConfig";
import { getStoredUserRole } from "../utils/auth";

const FASTAPI_BASE_URL = getFastApiBaseUrl();
// Backend routes are mounted under `/api/announcements`
const ANNOUNCEMENTS_API_BASE = `${FASTAPI_BASE_URL}/api/announcements`;

export type Announcement = {
  id: string;
  title: string;
  // backend historically used `content`; newer API uses `message`
  content?: string;
  message?: string;
  priority?: "High" | "Medium" | "Low" | string;
  status?: "Draft" | "Published" | string;
  // backend uses targetType/targetValue
  target_audience?: string;
  targetType?: string;
  targetValue?: string | null;
  is_pinned?: boolean;
  // both casing possibilities
  expires_at?: string | null;
  expiresAt?: string | null;
  created_at?: string;
  createdAt?: string;
};

export type CreateAnnouncementPayload = Record<string, any>;

/**
 * Get common headers for API requests including role
 */
function getHeaders(): Record<string, string> {
  const role = getStoredUserRole() || "employee";
  return {
    "Content-Type": "application/json",
    Role: role,
  };
}

/**
 * Fetch all announcements
 * HR/Admin see both draft and published; Employees see only published
 */
export async function fetchAnnouncements(): Promise<Announcement[]> {
  try {
    const response = await fetch(ANNOUNCEMENTS_API_BASE, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch announcements: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Announcements API Error:", error);
    throw error;
  }
}

/**
 * Fetch single announcement by ID
 * HR/Admin can view drafts; Employees cannot
 */
export async function fetchAnnouncement(id: string): Promise<Announcement> {
  try {
    const response = await fetch(`${ANNOUNCEMENTS_API_BASE}/${id}`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to fetch announcement (${response.status})`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Announcement Fetch Error:", error);
    throw error;
  }
}

/**
 * Create a new announcement (HR/Admin only)
 */
export async function createAnnouncement(
  payload: CreateAnnouncementPayload
): Promise<{ message: string; announcement: Announcement }> {
  try {
    const response = await fetch(ANNOUNCEMENTS_API_BASE, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to create announcement (${response.status})`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Create Announcement Error:", error);
    throw error;
  }
}

/**
 * Update an announcement (HR/Admin only)
 */
export async function updateAnnouncement(
  id: string,
  payload: CreateAnnouncementPayload
): Promise<{ message: string; announcement: Announcement }> {
  try {
    const response = await fetch(`${ANNOUNCEMENTS_API_BASE}/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to update announcement (${response.status})`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Update Announcement Error:", error);
    throw error;
  }
}

/**
 * Publish a draft announcement (HR/Admin only)
 */
export async function publishAnnouncement(
  id: string
): Promise<{ message: string; announcement: Announcement }> {
  try {
    const response = await fetch(`${ANNOUNCEMENTS_API_BASE}/${id}/publish`, {
      method: "PATCH",
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to publish announcement (${response.status})`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Publish Announcement Error:", error);
    throw error;
  }
}

/**
 * Delete an announcement (HR/Admin only)
 */
export async function deleteAnnouncement(
  id: string
): Promise<{ message: string }> {
  try {
    const response = await fetch(`${ANNOUNCEMENTS_API_BASE}/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to delete announcement (${response.status})`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Delete Announcement Error:", error);
    throw error;
  }
}

export const announcementApi = {
  fetchAnnouncements,
  fetchAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  deleteAnnouncement,
};

/**
 * Map frontend announcement format to API format
 */
export function mapFrontendToApi(announcement: any) {
  const target = announcement.target || announcement.target_audience || "All Employees";
  const isAll = /all/i.test(target);
  return {
    title: announcement.title,
    // backend expects `message`
    message: announcement.message || announcement.content,
    // normalize to backend expected lowercase values
    priority: (announcement.priority || "Medium").toString().toLowerCase(),
    status: (announcement.status || "Published").toString().toLowerCase(),
    targetType: isAll ? "all" : "custom",
    targetValue: isAll ? null : target,
    expiresAt: announcement.expires || announcement.expires_at || null,
    is_pinned: announcement.is_pinned || false,
  };
}

/**
 * Map API announcement format to frontend format
 */
export function mapApiToFrontend(announcement: Announcement) {
  return {
    id: announcement.id,
    title: announcement.title,
    message: // backend uses `message`
      // fall back to `content` for older records
      (announcement as any).message || (announcement as any).content || "",
    priority: ((announcement as any).priority || "").toString().replace(/^(.)/, (m: string) => m.toUpperCase()),
    status: ((announcement as any).status || "").toString().replace(/^(.)/, (m: string) => m.toUpperCase()),
    target: (announcement as any).targetType === "all" ? "All Employees" : (announcement as any).targetValue || "",
    expires: (announcement as any).expiresAt || (announcement as any).expires_at || "",
    published: (announcement as any).createdAt || (announcement as any).created_at || "",
  };
}
