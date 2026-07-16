import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/custom/page-header'
import { DashboardCourseSection } from '@/features/instructor/components/dashboard-course-section'
import { DashboardMetricsSection } from '@/features/instructor/components/dashboard-metrics-section'
import { DashboardPanelsSection } from '@/features/instructor/components/dashboard-panels-section'
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
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Badge variant="secondary">Instructor workspace</Badge>}
        title="Instructor dashboard"
        description="Manage course sources and review activity for your assigned course."
        actions={actions}
      />

      <div
        className="flex flex-col gap-8"
        {...(isLoading
          ? {
              role: 'status' as const,
              'aria-label': 'Loading instructor dashboard',
            }
          : {})}
      >
        <DashboardCourseSection state={state} />
        <DashboardMetricsSection state={state} />
        <DashboardPanelsSection state={state} />
        <DashboardSourceReadinessSection isLoading={isLoading} />
      </div>
    </div>
  )
}
