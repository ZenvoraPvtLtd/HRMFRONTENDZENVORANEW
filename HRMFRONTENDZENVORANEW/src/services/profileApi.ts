/**
 * Profile API service for frontend
 * Handles all API calls to the profile endpoints
 * 
 * Base URL: /api/profile
 * Endpoints:
 * - GET /me - Get current user's profile
 * - PUT /me - Update current user's profile
 */

import type { UserProfile, ProfileUpdateRequest } from "../types/profile";
import API_BASE_URL from "../config/apiConfig";

// Base URL for profile API
const PROFILE_API_BASE_URL = `${API_BASE_URL}/api/profile`;

/**
 * Get authentication token based on current route
 * Handles multiple token storage locations for different user types
 * 
 * @returns {string} Authentication token from localStorage
 */
function getAuthToken(): string {
  const path = typeof window !== "undefined" ? window.location.pathname : "";

  // Check for candidate-specific token
  if (path.startsWith("/candidatedashboard")) {
    return (
      localStorage.getItem("candidate_accessToken") ||
      getTokenForRole("candidate") ||
      ""
    );
  }

  if (path.startsWith("/dashboard")) {
    return getTokenForRole("employee") || localStorage.getItem("accessToken") || "";
  }

  if (path.startsWith("/manager")) {
    return (
      localStorage.getItem("manager_accessToken") ||
      getTokenForRole("manager") ||
      localStorage.getItem("hr_accessToken") ||
      localStorage.getItem("accessToken") ||
      ""
    );
  }

  // Admin path
  if (path.startsWith("/admin")) {
    return (
      localStorage.getItem("hr_accessToken") ||
      localStorage.getItem("admin_accessToken") ||
      localStorage.getItem("accessToken") ||
      ""
    );
  }

  if (path === "/profile" || path.startsWith("/profile/")) {
    return (
      localStorage.getItem("hr_accessToken") ||
      getTokenForRole("hr") ||
      localStorage.getItem("accessToken") ||
      ""
    );
  }

  // Check for HR-specific token
  if (path.startsWith("/hr") || path.startsWith("/employees")) {
    return (
      localStorage.getItem("hr_accessToken") ||
      localStorage.getItem("accessToken") ||
      ""
    );
  }

  // Default fallback
  return (
    getTokenForStoredRole() ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("hr_accessToken") ||
    localStorage.getItem("manager_accessToken") ||
    localStorage.getItem("candidate_accessToken") ||
    ""
  );
}

function getTokenForStoredRole(): string {
  const role =
    localStorage.getItem("userRole") ||
    localStorage.getItem("hr_userRole") ||
    localStorage.getItem("manager_userRole") ||
    localStorage.getItem("candidate_userRole") ||
    "";

  return getTokenForRole(role);
}

function getTokenForRole(role: string | null): string {
  if (role === "employee") return localStorage.getItem("accessToken") || "";
  if (role === "admin") {
    return (
      localStorage.getItem("hr_accessToken") ||
      localStorage.getItem("admin_accessToken") ||
      localStorage.getItem("accessToken") ||
      ""
    );
  }
  if (role === "manager") {
    return (
      localStorage.getItem("manager_accessToken") ||
      localStorage.getItem("hr_accessToken") ||
      localStorage.getItem("accessToken") ||
      ""
    );
  }
  if (role === "hr") {
    return localStorage.getItem("hr_accessToken") || localStorage.getItem("accessToken") || "";
  }
  if (role === "candidate") {
    return localStorage.getItem("candidate_accessToken") || localStorage.getItem("accessToken") || "";
  }
  return "";
}

/**
 * Get common headers for API requests
 * Includes Content-Type and Authorization headers
 * 
 * @returns {HeadersInit} Request headers object
 */
// function getHeaders(): HeadersInit {
//   const token = getAuthToken();
//   return {
//     "Content-Type": "application/json",
//     ...(token && { Authorization: `Bearer ${token}` }),
//   };
// }

function getHeaders(): HeadersInit {
  const token = getAuthToken();

  console.log("PROFILE TOKEN:", token);

  return {
    "Content-Type": "application/json",
    ...(token && {
      Authorization: `Bearer ${token}`,
    }),
  };
}




/**
 * Fetch current user's profile
 * 
 * API Endpoint: GET /api/profile/me
 * 
 * @returns {Promise<UserProfile>} User profile data including role-specific fields
 * @throws {Error} If request fails or user is not authenticated
 * 
 * @example
 * const profile = await profileApi.fetchProfile();
 * console.log(profile.name, profile.role);
 */
export async function fetchProfile(): Promise<UserProfile> {
  try {
    const response = await fetch(`${PROFILE_API_BASE_URL}/me`, {
      method: "GET",
      headers: getHeaders(),
    });

    // Handle authentication errors
    if (response.status === 401) {
      throw new Error("Unauthorized. Please log in again.");
    }

    // Handle not found errors
    if (response.status === 404) {
      throw new Error("Profile not found.");
    }

    // Handle other HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to fetch profile (${response.status})`
      );
    }

    // Parse and return response
    const data = await response.json();

    // Return the user profile from the response
    return data.user as UserProfile;
  } catch (error) {
    console.error("Profile API Error:", error);
    throw error;
  }
}

/**
 * Update user's profile
 * 
 * API Endpoint: PUT /api/profile/me
 * 
 * Only allows updating these fields:
 * - name: User's full name
 * - phoneNumber: User's phone number
 * 
 * Read-only fields (ignored if provided):
 * - role, employeeId, department, designation, joiningDate, provider, etc.
 * 
 * @param {ProfileUpdateRequest} updateData - Data to update (partial update)
 * @returns {Promise<UserProfile>} Updated user profile
 * @throws {Error} If request fails or validation fails
 * 
 * @example
 * const updated = await profileApi.updateProfile({
 *   name: "Jane Doe",
 *   phoneNumber: "+1-800-555-0000"
 * });
 */
export async function updateProfile(
  updateData: ProfileUpdateRequest
): Promise<UserProfile> {
  try {
    // Filter out undefined values
    const payload = Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    );

    const response = await fetch(`${PROFILE_API_BASE_URL}/me`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    // Handle authentication errors
    if (response.status === 401) {
      throw new Error("Unauthorized. Please log in again.");
    }

    // Handle validation errors
    if (response.status === 422) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || "Invalid profile data provided."
      );
    }

    // Handle not found errors
    if (response.status === 404) {
      throw new Error("Profile not found.");
    }

    // Handle other HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to update profile (${response.status})`
      );
    }

    // Parse and return response
    const data = await response.json();

    // Return the updated user profile
    return data.user as UserProfile;
  } catch (error) {
    console.error("Profile Update Error:", error);
    throw error;
  }
}

/**
 * API service object with all profile operations
 * Exported for convenient usage
 * 
 * @example
 * import { profileApi } from "../services/profileApi";
 * 
 * const profile = await profileApi.fetchProfile();
 * const updated = await profileApi.updateProfile({ name: "New Name" });
 */
export const profileApi = {
  fetchProfile,
  updateProfile,
};

export default profileApi;
