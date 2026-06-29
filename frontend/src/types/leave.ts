export type LeaveStatus = 'Submitted' | 'Approved' | 'Rejected' | 'Pending' | 'Under HR Review' | 'manager_pending' | 'manager_approved' | 'manager_rejected';
export type DurationType = 'Full Day' | 'Half Day';
export type LeaveType = 'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Maternity Leave';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  duration_type: DurationType;
  leave_date: string;
  days: number;
  applied_date: string;
  reason: string;
  status: LeaveStatus;
  internal_status?: string;
  submitted_at: string;
  manager_reviewed_at: string | null;
  hr_reviewed_at: string | null;
  manager_comment?: string | null;
  hr_comment?: string | null;
  employee_role?: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  earned: number;
  used: number;
  remaining: number;
}

export interface Employee {
  id: string;
  user_id: string;
  name: string;
  role: string;
  manager_name: string;
  avatar_url: string;
}
