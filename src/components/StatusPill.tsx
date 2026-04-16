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
  scheduled: 'đã hẹn',
  ready: 'mở được',
  opened: 'đã mở',
  cancelled: 'đã huỷ',
  pending: 'chờ thanh toán',
  pending_review: 'cần soát',
  paid: 'đã trả',
  approved_manual: 'duyệt tay',
  expired: 'hết hạn',
}

export function StatusPill({ status }: StatusPillProps) {
  return <span className={`status-pill status-${status.replace(/_/g, '-')}`}>{STATUS_LABELS[status]}</span>
}
