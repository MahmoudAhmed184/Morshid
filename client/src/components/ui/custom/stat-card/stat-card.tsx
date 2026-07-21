import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatCardTone =
  'default' | 'primary' | 'success' | 'warning' | 'info' | 'gold'

type StatCardProps = {
  label: React.ReactNode
  value: React.ReactNode
  icon?: React.ReactNode
  /**
   * Semantic accent for the icon chip. When set, `icon` is rendered inside a
   * `size-9 rounded-lg` tinted chip (the pattern staff dashboards hand-roll).
   * Omit it to keep the legacy behavior where `icon` renders as-is.
   */
  tone?: StatCardTone
  description?: React.ReactNode
  trend?: React.ReactNode
  className?: string
}

const toneChipClass: Record<StatCardTone, string> = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning-foreground dark:text-warning',
  info: 'bg-info/12 text-info',
  gold: 'bg-gold/15 text-gold',
}

/*
Usage:
<StatCard
  label="Active students"
  value={128}
  trend="+12%"
  tone="primary"
  icon={<UsersIcon />}
/>
*/
export function StatCard({
  label,
  value,
  icon,
  tone,
  description,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {icon ? (
          tone ? (
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4',
                toneChipClass[tone],
              )}
            >
              {icon}
            </span>
          ) : (
            <div className="text-muted-foreground [&_svg]:size-4">{icon}</div>
          )
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-semibold text-foreground">{value}</div>
          {trend ? (
            <div className="text-sm font-medium text-primary">{trend}</div>
          ) : null}
        </div>
        {description ? (
          <p className={cn('mt-2 text-sm text-muted-foreground')}>
            {description}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
