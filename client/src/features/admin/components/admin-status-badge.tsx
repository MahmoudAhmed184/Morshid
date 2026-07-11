import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type AdminStatusBadgeProps = {
  status: string
}

export function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  const normalizedStatus = status.toLowerCase()

  return (
    <Badge
      variant="outline"
      className={cn(
        'capitalize',
        normalizedStatus === 'active' &&
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
        normalizedStatus === 'published' &&
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
        normalizedStatus === 'disabled' &&
          'border-destructive/30 bg-destructive/10 text-destructive',
        normalizedStatus === 'critical' &&
          'border-destructive/30 bg-destructive/10 text-destructive',
        normalizedStatus === 'warning' &&
          'border-amber-500/30 bg-amber-500/10 text-amber-500',
        normalizedStatus === 'draft' &&
          'border-sky-500/30 bg-sky-500/10 text-sky-500',
        normalizedStatus === 'closed' &&
          'border-muted-foreground/30 bg-muted/60 text-muted-foreground',
        normalizedStatus === 'archived' &&
          'border-muted-foreground/30 bg-muted/60 text-muted-foreground',
      )}
    >
      {status}
    </Badge>
  )
}
