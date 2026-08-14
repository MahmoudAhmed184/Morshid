import { PageHeader } from '@/components/ui/custom/page-header'
import { DashboardCourseSection } from '@/workspaces/instructor/dashboard/dashboard-course-section'
import { DashboardMetricsSection } from '@/workspaces/instructor/dashboard/dashboard-metrics-section'
import { DashboardReviewQueuePanel } from '@/workspaces/instructor/dashboard/dashboard-panels-section'
import { DashboardSourceReadinessSection } from '@/workspaces/instructor/dashboard/dashboard-source-readiness-section'
import type { InstructorDashboardState } from '@/workspaces/instructor/dashboard/instructor-dashboard-state'

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
        eyebrow="THE REGISTER"
        title="Today's teaching desk."
        description="Manage course sources and review activity for your assigned course."
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
        <DashboardMetricsSection state={state} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DashboardCourseSection state={state} />
          </div>
          <DashboardReviewQueuePanel state={state} />
        </div>

        <DashboardSourceReadinessSection state={state} />
      </div>
    </div>
  )
}
