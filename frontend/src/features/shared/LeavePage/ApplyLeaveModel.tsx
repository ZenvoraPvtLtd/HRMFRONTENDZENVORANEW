import { X } from 'lucide-react';
import { useState } from 'react';
import ConstrainedDropdown from '../../../components/ConstrainedDropdown';
import { createPortal } from 'react-dom';
import type { LeaveType, DurationType } from '../../../types/leave';

interface ApplyLeaveModalProps {
  onClose: () => void;
  onSubmit: (data: {
    leave_type: LeaveType;
    duration_type: DurationType;
    leave_date: string;
    days: number;
    reason: string;
  }) => Promise<void>;
  initialData?: {
    leave_type: LeaveType;
    duration_type: DurationType;
    leave_date: string;
    days: number;
    reason: string;
  };
  mode?: 'create' | 'edit';
}

const leaveTypes: LeaveType[] = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity Leave'];

function calcDays(from: string, to: string, duration: DurationType) {
  if (!from || !to) return duration === 'Half Day' ? 0.5 : 1;
  const start = new Date(from);
  const end = new Date(to);
  if (end < start) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return duration === 'Half Day' ? 0.5 : diff;
}

export default function ApplyLeaveModal({ onClose, onSubmit, initialData, mode = 'create' }: ApplyLeaveModalProps) {
  const [leaveType, setLeaveType] = useState<LeaveType>(initialData?.leave_type ?? 'Casual Leave');
  const [durationType, setDurationType] = useState<DurationType>(initialData?.duration_type ?? 'Full Day');
  const [fromDate, setFromDate] = useState(initialData?.leave_date ?? '');
  const [toDate, setToDate] = useState(initialData?.leave_date ?? '');
  const [reason, setReason] = useState(initialData?.reason ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const days = calcDays(fromDate, toDate, durationType);
  const today = new Date().toISOString().split('T')[0];

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fromDate) { setError('Please select a From Date.'); return; }
    if (!toDate) { setError('Please select a To Date.'); return; }
    if (new Date(toDate) < new Date(fromDate)) { setError('To Date cannot be before From Date.'); return; }
    if (!reason.trim()) { setError('Please provide a reason.'); return; }
    setError('');
    setLoading(true);
    try {
      await onSubmit({ leave_type: leaveType, duration_type: durationType, leave_date: fromDate, days, reason });
      onClose();
    } catch {
      setError('');
    } finally {
      setLoading(false);
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {mode === 'edit' ? 'Edit Leave Request' : 'Leave Application'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Fill in the details to apply for leave
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Leave Type</label>
            <ConstrainedDropdown
              value={leaveType}
              onChange={(value) => setLeaveType(value as LeaveType)}
              options={leaveTypes}
              buttonStyle={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)', padding: '0.625rem 0.75rem', fontSize: '1rem' }}
            />
          </div>

          {/* Leave Duration toggle */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Leave Duration
            </label>
            <div className="flex gap-2">
              {(['Full Day', 'Half Day'] as DurationType[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationType(d)}
                  className="flex-1 py-2 text-sm rounded-lg border transition-colors font-medium"
                  style={
                    durationType === d
                      ? { background: 'var(--accent)', color: 'var(--accent-text)', borderColor: 'var(--accent)' }
                      : { background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }
                  }
                >
                  {d === 'Full Day' ? 'Full Day (1.0 day)' : 'Half Day (0.5 day)'}
                </button>
              ))}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              ✓ {durationType === 'Half Day' ? '0.5' : days} day{days !== 1 ? 's' : ''} will be deducted from your leave balance
            </p>
          </div>

          {/* From Date & To Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (toDate && e.target.value > toDate) setToDate(e.target.value);
                }}
                min={today}
                className="w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={fromDate || today}
                className="w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Reason / Description
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Provide a detailed reason for leave"
              className="w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none resize-none"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            <p className="text-xs mt-0.5 text-right" style={{ color: 'var(--text-secondary)' }}>
              {reason.length}/2000 characters
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm border rounded-lg font-medium transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm rounded-lg font-semibold transition-colors disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none' }}
            >
              {loading ? 'Submitting...' : mode === 'edit' ? 'Update Request' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
