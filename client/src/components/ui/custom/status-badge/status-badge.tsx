import { Badge } from '@/components/ui/badge'

type StatusTone = 'default' | 'secondary' | 'destructive' | 'outline'

const statusToneMap: Partial<Record<string, StatusTone>> = {
  active: 'default',
  approved: 'default',
  complete: 'default',
  completed: 'default',
  degraded: 'secondary',
  draft: 'secondary',
  inactive: 'secondary',
  offline: 'destructive',
  pending: 'secondary',
  ready: 'default',
  rejected: 'destructive',
  failed: 'destructive',
  archived: 'outline',
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
    <Badge
      variant={tone ?? statusToneMap[normalizedStatus] ?? 'outline'}
      className={className}
    >
      {label ?? normalizedStatus}
    </Badge>
  )
}
