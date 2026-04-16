interface StatusPillProps {
  status: 'scheduled' | 'ready' | 'opened' | 'cancelled'
}

export function StatusPill({ status }: StatusPillProps) {
  return <span className={`status-pill status-${status}`}>{status}</span>
}
