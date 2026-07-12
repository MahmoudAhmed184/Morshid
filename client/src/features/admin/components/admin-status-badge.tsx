import { Badge } from '@/components/ui/badge'

type AdminStatusBadgeProps = {
  status: 'ACTIVE' | 'DISABLED' | 'PROCESSING' | 'READY' | 'WARNING' | 'FAILED'
  label?: string
}

const statusClasses: Record<AdminStatusBadgeProps['status'], string> = {
  ACTIVE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  READY: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  DISABLED: 'border-destructive/30 bg-destructive/10 text-destructive',
  FAILED: 'border-destructive/30 bg-destructive/10 text-destructive',
  WARNING: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
  PROCESSING: 'border-sky-500/30 bg-sky-500/10 text-sky-500',
}

export function AdminStatusBadge({ status, label }: AdminStatusBadgeProps) {
  return (
    <Badge variant="outline" className={`capitalize ${statusClasses[status]}`}>
      {label ?? status.toLowerCase()}
    </Badge>
  )
}
