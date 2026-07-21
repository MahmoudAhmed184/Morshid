import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/custom/page-header'
import { DashboardCourseSection } from '@/features/instructor/components/dashboard-course-section'
import { DashboardMetricsSection } from '@/features/instructor/components/dashboard-metrics-section'
import { DashboardSourceReadinessSection } from '@/features/instructor/components/dashboard-source-readiness-section'
import type { InstructorDashboardState } from '@/features/instructor/types/instructor-dashboard-state'

type InstructorDashboardPageProps = {
  state: InstructorDashboardState
  actions?: React.ReactNode
}

export function InstructorDashboardPage({
  state,
  actions,
}: InstructorDashboardPageProps) {
  const isLoading = state.status === 'loading'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<Badge variant="secondary">Instructor workspace</Badge>}
        title="Instructor dashboard"
        description="Monitor your assigned courses and course-source readiness."
        actions={actions}
      />

      <div
        className="flex flex-col gap-6"
        {...(isLoading
          ? {
              role: 'status' as const,
              'aria-label': 'Loading instructor dashboard',
            }
          : {})}
      >
        <DashboardCourseSection state={state} />
        <DashboardMetricsSection state={state} />
        <DashboardSourceReadinessSection state={state} />
      </div>
    </div>
  )
}
