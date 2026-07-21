import { Badge } from '@/components/ui/badge'
import type { badgeVariants } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { VariantProps } from 'class-variance-authority'

type AdminStatus =
  'ACTIVE' | 'DISABLED' | 'PROCESSING' | 'READY' | 'WARNING' | 'FAILED'

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

type AdminStatusBadgeProps = {
  status: AdminStatus
  label?: string
}

const statusVariant: Record<AdminStatus, BadgeVariant> = {
  ACTIVE: 'success',
  READY: 'success',
  DISABLED: 'destructive',
  FAILED: 'destructive',
  WARNING: 'warning',
  PROCESSING: 'info',
}

const dotClass: Record<AdminStatus, string> = {
  ACTIVE: 'bg-success',
  READY: 'bg-success',
  DISABLED: 'bg-destructive',
  FAILED: 'bg-destructive',
  WARNING: 'bg-warning',
  PROCESSING: 'bg-info',
}

export function AdminStatusBadge({ status, label }: AdminStatusBadgeProps) {
  const isProcessing = status === 'PROCESSING'

  return (
    <Badge variant={statusVariant[status]} className="capitalize">
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          dotClass[status],
          isProcessing && 'motion-safe:animate-pulse',
        )}
        aria-hidden
      />
      {label ?? status.toLowerCase()}
    </Badge>
  )
}
