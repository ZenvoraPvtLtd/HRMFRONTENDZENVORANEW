import type { ReactNode } from "react";

/**
 * Base profile interface
 */
export interface BaseProfile {
  _id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: "admin" | "hr" | "manager" | "employee";
  provider?: string;
  avatar?: string;
  profileCompletion?: number;
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bankAccountDetails?: string;
  uanNumber?: string;
  skills?: string[];
  reportingTime?: string;
  workingHoursPerDay?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Role-specific profiles
 */
export interface AdminProfile extends BaseProfile {
  role: "admin";
  department?: string;
  designation?: string;
}

export interface HRProfile extends BaseProfile {
  role: "hr";
  employeeId?: string;
  department?: string;
  designation?: string;
  joiningDate?: string;
}

export interface ManagerProfile extends BaseProfile {
  role: "manager";
  employeeId?: string;
  department?: string;
  designation?: string;
  teamSize?: number;
  joiningDate?: string;
}

export interface EmployeeProfile extends BaseProfile {
  role: "employee";
  employeeId?: string;
  department?: string;
  designation?: string;
  managerName?: string;
  joiningDate?: string;
}

export type UserProfile =
  | AdminProfile
  | HRProfile
  | ManagerProfile
  | EmployeeProfile;

/**
 * FIXED: Proper key type (no duplicate)
 */
export type ProfileFieldKey =
  | keyof BaseProfile
  | "department"
  | "designation"
  | "employeeId"
  | "joiningDate"
  | "teamSize"
  | "managerName";

/**
 * Profile update request
 */
export interface ProfileUpdateRequest {
  name?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bankAccountDetails?: string;
  uanNumber?: string;
  skills?: string[];
  reportingTime?: string;
  workingHoursPerDay?: number;
  email?: string;
  role?: string;
  provider?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  joiningDate?: string;
  managerName?: string;
  teamSize?: number;
}

/**
 * FIXED FieldConfig (NO duplicate key)
 */
export interface FieldConfig {
  key: ProfileFieldKey;
  label: string;
  editable: boolean;
  icon?: ReactNode;
}

/**
 * Role-based field config
 */
export const PROFILE_FIELDS: Record<
  "common" | UserProfile["role"],
  FieldConfig[]
> = {
  common: [
    { key: "name", label: "Full Name", editable: true },
    { key: "email", label: "Email Address", editable: true },
    { key: "phoneNumber", label: "Phone Number", editable: true },
    { key: "role", label: "Role", editable: true },
    { key: "provider", label: "Login Provider", editable: true },
  ],

  admin: [
    { key: "department", label: "Department", editable: true },
    { key: "designation", label: "Designation", editable: true },
  ],

  hr: [
    { key: "employeeId", label: "Employee ID", editable: true },
    { key: "department", label: "Department", editable: true },
    { key: "designation", label: "Designation", editable: true },
    { key: "joiningDate", label: "Joining Date", editable: true },
  ],

  manager: [
    { key: "employeeId", label: "Employee ID", editable: true },
    { key: "department", label: "Department", editable: true },
    { key: "designation", label: "Designation", editable: true },
    { key: "teamSize", label: "Team Size", editable: true },
    { key: "joiningDate", label: "Joining Date", editable: true },
  ],

  employee: [
    { key: "employeeId", label: "Employee ID", editable: true },
    { key: "department", label: "Department", editable: true },
    { key: "designation", label: "Designation", editable: true },
    { key: "managerName", label: "Manager Name", editable: true },
    { key: "joiningDate", label: "Joining Date", editable: true },
  ],
};

/**
 * Get profile fields by role
 */
export function getProfileFields(
  role: UserProfile["role"]
): FieldConfig[] {
  return [...PROFILE_FIELDS.common, ...PROFILE_FIELDS[role]];
}