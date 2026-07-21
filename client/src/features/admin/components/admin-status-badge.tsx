import { Badge } from '@/components/ui/badge'
import { resolveStatusTone } from '@/components/ui/custom/status-badge'
import type { StatusTone } from '@/components/ui/custom/status-badge'
import { cn } from '@/lib/utils'

type AdminStatus =
  'ACTIVE' | 'DISABLED' | 'PROCESSING' | 'READY' | 'WARNING' | 'FAILED'

type AdminStatusBadgeProps = {
  status: AdminStatus
  label?: string
}

const toneDotClass: Record<StatusTone, string> = {
  default: 'bg-primary',
  secondary: 'bg-muted-foreground',
  outline: 'bg-muted-foreground',
  destructive: 'bg-destructive',
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
}

export function AdminStatusBadge({ status, label }: AdminStatusBadgeProps) {
  const tone = resolveStatusTone(status)
  const isProcessing = status === 'PROCESSING'

  return (
    <Badge variant={tone} className="capitalize">
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          toneDotClass[tone],
          isProcessing && 'motion-safe:animate-pulse',
        )}
        aria-hidden
      />
      {label ?? status.toLowerCase()}
    </Badge>
  )
}
