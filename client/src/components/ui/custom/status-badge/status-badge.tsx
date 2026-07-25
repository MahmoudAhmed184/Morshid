import { Badge } from '@/components/ui/badge'

export type StatusTone =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'

const statusToneMap: Partial<Record<string, StatusTone>> = {
  active: 'success',
  approved: 'success',
  complete: 'success',
  completed: 'success',
  online: 'success',
  ready: 'success',
  draft: 'warning',
  degraded: 'warning',
  pending: 'warning',
  warning: 'warning',
  processing: 'info',
  uploading: 'info',
  disabled: 'destructive',
  error: 'destructive',
  failed: 'destructive',
  offline: 'destructive',
  rejected: 'destructive',
  inactive: 'secondary',
  archived: 'outline',
}

/** Resolve a status string to its semantic Badge tone (falls back to `outline`). */
export function resolveStatusTone(status: string): StatusTone {
  return statusToneMap[status.toLowerCase()] ?? 'outline'
}

type StatusBadgeProps = {
  status: string
  label?: React.ReactNode
  tone?: StatusTone
  className?: string
}

/*
Usage:
<StatusBadge status={course.status} />
<StatusBadge status="offline" label="API offline" />
*/
export function StatusBadge({
  status,
  label,
  tone,
  className,
}: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase()

  return (
    <Badge variant={tone ?? resolveStatusTone(status)} className={className}>
      {label ?? normalizedStatus}
    </Badge>
  )
}
