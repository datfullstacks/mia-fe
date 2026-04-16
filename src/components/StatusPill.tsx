type StatusPillStatus =
  | 'scheduled'
  | 'ready'
  | 'opened'
  | 'cancelled'
  | 'pending'
  | 'pending_review'
  | 'paid'
  | 'approved_manual'
  | 'expired'

interface StatusPillProps {
  status: StatusPillStatus
}

const STATUS_LABELS: Record<StatusPillStatus, string> = {
  scheduled: 'scheduled',
  ready: 'ready',
  opened: 'opened',
  cancelled: 'cancelled',
  pending: 'pending',
  pending_review: 'review',
  paid: 'paid',
  approved_manual: 'manual',
  expired: 'expired',
}

export function StatusPill({ status }: StatusPillProps) {
  return <span className={`status-pill status-${status.replace(/_/g, '-')}`}>{STATUS_LABELS[status]}</span>
}
