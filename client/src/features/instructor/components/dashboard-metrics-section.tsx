import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { StatCard } from '@/components/ui/custom/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { instructorDashboardStats } from '@/features/instructor/constants/instructor-route-dashboard.constants'
import type { InstructorDashboardState } from '@/features/instructor/types/instructor-dashboard-state'

type DashboardMetricsSectionProps = {
  state: InstructorDashboardState
}

export function DashboardMetricsSection({
  state,
}: DashboardMetricsSectionProps) {
  return (
    <section
      aria-labelledby="metrics-heading"
      aria-busy={state.status === 'loading' || undefined}
      className="space-y-3"
    >
      <div className="space-y-1">
        <h2 id="metrics-heading" className="text-base font-semibold">
          Workspace metrics
        </h2>
        <p className="text-sm text-muted-foreground">
          Course source and review activity totals.
        </p>
      </div>

      <DashboardMetricsSectionContent state={state} />
    </section>
  )
}

function DashboardMetricsSectionContent({
  state,
}: DashboardMetricsSectionProps) {
  if (state.status === 'loading' || state.status === 'ready') {
    return <MetricsCards state={state} />
  }

  if (state.status === 'error') {
    return (
      <EmptyState
        title="Metrics unavailable"
        description="Course metrics will appear here once the assigned course loads successfully."
        className="min-h-40"
      />
    )
  }

  return (
    <EmptyState
      title="No metrics available"
      description="Assign a course before this workspace can show course-specific totals."
      className="min-h-40"
    />
  )
}

function MetricsCards({
  state,
}: {
  state: Extract<InstructorDashboardState, { status: 'loading' | 'ready' }>
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {instructorDashboardStats.map((stat) => {
        const Icon = stat.icon

        if (state.status === 'loading') {
          return <MetricCardSkeleton key={stat.key} label={stat.label} />
        }

        return (
          <StatCard
            key={stat.key}
            label={stat.label}
            value={
              {
                materials: state.materialCount,
                reviewQueue: state.reviewQueueCount,
              }[stat.key]
            }
            icon={<Icon aria-hidden />}
            description={stat.description}
          />
        )
      })}
    </div>
  )
}

function MetricCardSkeleton({ label }: { label: string }) {
  return (
    <Card aria-label={`Loading ${label} metric`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-12" />
        <Skeleton className="mt-2 h-4 w-3/4" />
      </CardContent>
    </Card>
  )
}
