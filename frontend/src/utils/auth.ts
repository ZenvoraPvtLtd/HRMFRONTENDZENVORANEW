export type UserRole = "hr" | "employee" | "candidate" | "manager" | "admin";

// Bump this whenever JWT secret changes or you need to force all users to re-login.
const AUTH_VERSION = "v2";

(function enforceAuthVersion() {
  if (localStorage.getItem("auth_version") !== AUTH_VERSION) {
    const keys = Object.keys(localStorage).filter(
      (k) => k.includes("Token") || k.includes("token") || k.includes("Role") || k.includes("role")
    );
    keys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("auth_version", AUTH_VERSION);
  }
})();

// Clear all auth tokens on fresh browser open (not on page refresh).
// sessionStorage survives page refreshes but is wiped when browser/tab is closed.
(function clearOnFreshOpen() {
  if (!sessionStorage.getItem("app_session_active")) {
    const keys = Object.keys(localStorage).filter(
      (k) => k.includes("Token") || k.includes("token")
    );
    keys.forEach((k) => localStorage.removeItem(k));
    sessionStorage.setItem("app_session_active", "1");
  }
})();

type StoredUser = {
  id?: string;
  _id?: string;
  name?: string;
  fullName?: string;
  employeeId?: string;
  email?: string;
  role?: UserRole;
  phoneNumber?: string;
  createdAt?: string;
};

const HR_ROLES: UserRole[] = ["hr"];

export const getDashboardPath = (role?: string | null) => {
  if (role === "candidate") return "/candidatedashboard";
  if (role === "employee") return "/dashboard";
  if (role === "manager") return "/manager/dashboard";
  if (role === "admin") return "/admin";
  if (role === "hr") return "/";
  return "/";
};

export const isHrRole = (role?: string | null) => {
  return HR_ROLES.includes(role as UserRole);
};

export const isCandidateRole = (role?: string | null) => {
  return role === "candidate";
};

export const getStoredUserRole = () => {
  const storedRole = localStorage.getItem("userRole") as UserRole | null;

  if (storedRole) {
    return storedRole;
  }

  const token = localStorage.getItem("accessToken");
  const tokenRole = token ? getRoleFromToken(token) : undefined;

  if (tokenRole) {
    localStorage.setItem("userRole", tokenRole);
  }

  return tokenRole ?? null;
};

export const storeAuthUser = (user?: StoredUser) => {
  if (!user) return;

  const id = user.id || user._id;
  if (id) {
    const idStr = String(id);
    localStorage.setItem("userId", idStr);
  }

  if (user.employeeId) {
    localStorage.setItem("employeeId", String(user.employeeId).trim());
  }

  const displayName = user.name || user.fullName;
  if (displayName) {
    localStorage.setItem("userName", displayName);
  }

  if (user.email) {
    localStorage.setItem("userEmail", user.email);
  }

  if (user.role) {
    localStorage.setItem("userRole", user.role.toLowerCase());
  }

  if (user.phoneNumber) {
    localStorage.setItem("userPhone", user.phoneNumber);
  }

  if (user.createdAt) {
    localStorage.setItem("userJoinDate", user.createdAt);
  }

  // Also write role-specific keys so Layout can read them
  const role = user.role?.toLowerCase();
  if (role === "hr" || role === "admin" || role === "manager") {
    if (displayName) localStorage.setItem("hr_userName", displayName);
    if (user.email) localStorage.setItem("hr_userEmail", user.email);
    if (role) localStorage.setItem("hr_userRole", role);
  }
  if (role === "candidate") {
    if (displayName) localStorage.setItem("candidate_userName", displayName);
    if (user.email) localStorage.setItem("candidate_userEmail", user.email);
    if (role) localStorage.setItem("candidate_userRole", role);
  }
};

export const clearAuthStorage = () => {
  // general keys
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userName");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userPhone");
  localStorage.removeItem("userLocation");
  localStorage.removeItem("userJoinDate");
  localStorage.removeItem("employeeId");
  // admin keys
  localStorage.removeItem("admin_accessToken");
  localStorage.removeItem("admin_refreshToken");
  localStorage.removeItem("admin_userRole");
  localStorage.removeItem("admin_userName");
  localStorage.removeItem("admin_userEmail");
  // hr keys
  localStorage.removeItem("hr_accessToken");
  localStorage.removeItem("hr_refreshToken");
  localStorage.removeItem("hr_userRole");
  localStorage.removeItem("hr_userName");
  localStorage.removeItem("hr_userEmail");
  // candidate keys
  localStorage.removeItem("candidate_accessToken");
  localStorage.removeItem("candidate_refreshToken");
  localStorage.removeItem("candidate_userRole");
  localStorage.removeItem("candidate_userName");
  localStorage.removeItem("candidate_userEmail");
};

export const getTokenPayload = (token: string | null) => {
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );

    return JSON.parse(atob(padded)) as { exp?: number; role?: UserRole };
  } catch {
    return null;
  }
};

export const isTokenValid = (token: string | null): boolean => {
  const payload = getTokenPayload(token);
  return Boolean(payload?.exp && payload.exp * 1000 > Date.now());
};

export const getRoleFromToken = (token: string) => {
  return getTokenPayload(token)?.role;
};
