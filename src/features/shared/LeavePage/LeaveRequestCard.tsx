import { CalendarDays } from 'lucide-react';
import type { LeaveRequest } from '../../../types/leave';

interface LeaveRequestCardProps {
  request: LeaveRequest;
}

function getStatusInfo(ist?: string): { label: string; style: React.CSSProperties } {
  switch (ist) {
    case 'approved':
      return { label: 'Approved', style: { background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' } };
    case 'rejected':
    case 'manager_rejected':
      return { label: 'Rejected', style: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' } };
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

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAppliedDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function LeaveRequestCard({ request }: LeaveRequestCardProps) {
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
            <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {request.reason}
            </p>
          )}
        </div>

        <StatusBadge internalStatus={request.internal_status} />
      </div>
    </div>
  );
}
