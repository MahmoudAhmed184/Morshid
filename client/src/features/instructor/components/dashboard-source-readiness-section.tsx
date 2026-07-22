import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { InstructorDashboardState } from '@/features/instructor/types/instructor-dashboard-state'

type DashboardSourceReadinessSectionProps = {
  state: InstructorDashboardState
}

export function DashboardSourceReadinessSection({
  state,
}: DashboardSourceReadinessSectionProps) {
  return (
    <section aria-labelledby="sources-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="sources-heading" className="text-base font-semibold">
          Source readiness
        </h2>
        <p className="text-sm text-muted-foreground">
          Processing status stays scoped to the selected course.
        </p>
      </div>
      <SourceReadinessContent state={state} />
    </section>
  )
}

function SourceReadinessContent({
  state,
}: DashboardSourceReadinessSectionProps) {
  if (state.status === 'loading') {
    return (
      <Card aria-label="Loading source readiness" role="status">
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {['Processing', 'Ready', 'Needs attention'].map((label) => (
            <div
              key={label}
              className="space-y-2 rounded-xl bg-secondary/30 p-4"
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <EmptyState
          title={
            state.status === 'ready'
              ? 'Source readiness is course-specific'
              : 'Source readiness unavailable'
          }
          description={
            state.status === 'ready'
              ? 'Open Materials to see live processing, ready, warning, and failed states for the selected course.'
              : 'Assigned course materials are required before readiness can be reported.'
          }
          className="min-h-40 border-none bg-transparent"
        />
      </CardContent>
    </Card>
  )
}
