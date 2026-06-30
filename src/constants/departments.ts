/**
 * Zenvora HRM — Department options (single source of truth)
 * Used across Employee invite, profile page, filters, etc.
 */
export const DEPARTMENT_OPTIONS = ["IT", "BPO", "Manager", "Admin", "HR"] as const;

export type Department = typeof DEPARTMENT_OPTIONS[number];
