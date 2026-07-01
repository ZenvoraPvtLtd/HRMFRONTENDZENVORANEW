import { CalendarDays, CheckCircle2, Circle, Info, XCircle } from 'lucide-react';
import type { LeaveRequest } from '../../../types/leave';

interface LeaveRequestCardProps {
  request: LeaveRequest;
}

function getStatusInfo(ist?: string): { label: string; style: React.CSSProperties } {
  switch (ist) {
    case 'manager_approved':
      return { label: 'Mgr Approved', style: { background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' } };
    case 'manager_rejected':
      return { label: 'Mgr Rejected', style: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' } };
    case 'manager_pending':
      return { label: 'Mgr Pending', style: { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' } };
    case 'approved':
      return { label: 'Approved', style: { background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' } };
    case 'rejected':
      return { label: 'HR Rejected', style: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' } };
    default:
      return { label: 'Pending', style: { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' } };
  }
}

function StatusBadge({ internalStatus }: { internalStatus?: string }) {
  const { label, style } = getStatusInfo(internalStatus);
  return (
    <span className="text-xs font-semibold px-3 py-1 rounded-full shrink-0" style={style}>
      {label}
    </span>
  );
}

function DurationBadge({ duration }: { duration: string }) {
  if (duration === 'Full Day') return null;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full ml-1.5" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
      {duration}
    </span>
  );
}

function ApprovalStep({ label, done, rejected }: { label: string; done: boolean; rejected?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {done ? (
        rejected ? (
          <XCircle size={14} style={{ color: '#ef4444' }} />
        ) : (
          <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />
        )
      ) : (
        <Circle size={14} style={{ color: 'var(--text-secondary)' }} />
      )}
      <span className="text-xs" style={{ color: done ? (rejected ? '#ef4444' : 'var(--text-secondary)') : 'var(--text-secondary)' }}>
        {label}
      </span>
    </div>
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAppliedDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function LeaveRequestCard({ request }: LeaveRequestCardProps) {
  const ist = request.internal_status;
  const managerStatus =
    ist === 'manager_approved' || ist === 'hr_pending' || ist === 'admin_pending' || ist === 'approved' || ist === 'rejected'
      ? 'Approved'
      : ist === 'manager_rejected'
      ? 'Rejected'
      : 'Pending';
  const hrStatus =
    ist === 'manager_approved' || ist === 'hr_pending' || ist === 'admin_pending' || ist === 'approved' ? 'Approved' : ist === 'rejected' || ist === 'manager_rejected' ? 'Rejected' : 'Pending';
  const managerDone = managerStatus !== 'Pending';
  const managerRejected = managerStatus === 'Rejected';
  const hrDone = hrStatus !== 'Pending';
  const hrRejected = hrStatus === 'Rejected';

  const isNonEmployee = ['manager', 'hr', 'admin'].includes(request.employee_role || '');

  return (
    <div className="rounded-2xl p-4 border shadow-sm hover:shadow-md transition-shadow" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{request.leave_type}</span>
            <DurationBadge duration={request.duration_type} />
          </div>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs mb-2.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <CalendarDays size={12} />
              {formatDate(request.leave_date)}
            </span>
            <span className="text-[var(--text-secondary)] hidden sm:inline">•</span>
            <span className="font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{request.days} {request.days === 1 ? 'day' : 'days'}</span>
            <span className="text-[var(--text-secondary)] hidden sm:inline">•</span>
            <span className="whitespace-nowrap">Applied {formatAppliedDate(request.applied_date)}</span>
          </div>

          {request.reason && (
            <p className="text-xs line-clamp-2 mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {request.reason}
            </p>
          )}

          <div className="flex items-center flex-wrap gap-y-2 gap-x-2 sm:gap-x-3">
            <ApprovalStep label="Submitted" done={true} />
            {isNonEmployee ? (
              <>
                <div className="w-3 sm:w-4 h-px hidden sm:block flex-shrink-0" style={{ background: 'var(--border)' }} />
                <ApprovalStep label="Admin" done={ist === 'approved' || ist === 'rejected'} rejected={ist === 'rejected'} />
              </>
            ) : (
              <>
                <div className="w-3 sm:w-4 h-px hidden sm:block flex-shrink-0" style={{ background: 'var(--border)' }} />
                <ApprovalStep label="Manager" done={managerDone} rejected={managerRejected} />
                <div className="w-3 sm:w-4 h-px hidden sm:block flex-shrink-0" style={{ background: 'var(--border)' }} />
                <ApprovalStep label="HR" done={hrDone} rejected={hrRejected} />
              </>
            )}
            {(ist === 'approved' || managerRejected || hrRejected) && (
              <>
                <div className="w-3 sm:w-4 h-px hidden sm:block flex-shrink-0" style={{ background: 'var(--border)' }} />
                <Info size={13} style={{ color: 'var(--text-secondary)' }} className="hidden sm:block" />
              </>
            )}
          </div>
        </div>

        <StatusBadge internalStatus={request.internal_status} />
      </div>
    </div>
  );
}
