import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { StatCard } from '@/components/ui/custom/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { InstructorDashboardState } from '@/features/instructor/types/instructor-dashboard-state'

type DashboardSourceReadinessSectionProps = {
  state: InstructorDashboardState
}

export function DashboardSourceReadinessSection({
  state,
}: DashboardSourceReadinessSectionProps) {
  return (
    <section
      aria-labelledby="sources-heading"
      aria-busy={state.status === 'loading' || undefined}
      className="space-y-3"
    >
      <div className="space-y-1">
        <h2 id="sources-heading" className="text-base font-semibold">
          Source readiness
        </h2>
        <p className="text-sm text-muted-foreground">
          Current processing state across all assigned courses.
        </p>
      </div>
      <DashboardSourceReadinessContent state={state} />
    </section>
  )
}

function DashboardSourceReadinessContent({
  state,
}: DashboardSourceReadinessSectionProps) {
  if (state.status === 'loading') {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {['Processing', 'Ready', 'Needs attention'].map((label) => (
          <Card
            key={label}
            aria-label={`Loading ${label} sources`}
            className="rounded-[8px] [--card-spacing:--spacing(3)]"
          >
            <CardHeader>
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (state.status !== 'ready') {
    return (
      <EmptyState
        title="Source readiness unavailable"
        description="Assigned course materials are required before readiness can be reported."
        className="min-h-40"
      />
    )
  }

  const readinessItems = [
    {
      label: 'Processing',
      value: state.processingMaterialCount,
      description: 'Sources currently being prepared',
    },
    {
      label: 'Ready',
      value: state.readyMaterialCount,
      description: 'Sources available for retrieval',
    },
    {
      label: 'Needs attention',
      value: state.attentionMaterialCount,
      description: 'Sources with warnings or failures',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {readinessItems.map((item) => (
        <StatCard
          key={item.label}
          {...item}
          className="rounded-[8px] [--card-spacing:--spacing(3)]"
        />
      ))}
    </div>
  )
}
