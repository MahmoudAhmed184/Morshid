import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatCardProps = {
  label: React.ReactNode
  value: React.ReactNode
  icon?: React.ReactNode
  description?: React.ReactNode
  trend?: React.ReactNode
  className?: string
}

/*
Usage:
<StatCard
  label="Active students"
  value={128}
  trend="+12%"
  icon={<UsersIcon />}
/>
*/
export function StatCard({
  label,
  value,
  icon,
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
          <div className="text-muted-foreground [&_svg]:size-4">{icon}</div>
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
