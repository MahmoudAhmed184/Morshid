import { Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { InstructorListSkeleton } from '@/features/instructor/components/instructor-list-skeleton'
import { instructorDashboardPanels } from '@/features/instructor/constants/instructor-route-dashboard.constants'
import type { InstructorDashboardState } from '@/features/instructor/types/instructor-dashboard-state'

type DashboardPanelsSectionProps = {
  state: InstructorDashboardState
}

export function DashboardPanelsSection({ state }: DashboardPanelsSectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {instructorDashboardPanels.map((panel) => {
        const PanelIcon = panel.icon

        return (
          <section
            key={panel.id}
            aria-labelledby={panel.headingId}
            aria-busy={state.status === 'loading' || undefined}
            id={panel.id}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <h2 id={panel.headingId}>{panel.title}</h2>
                </CardTitle>
                <CardDescription>{panel.description}</CardDescription>
                <CardAction>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
                    <PanelIcon aria-hidden />
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent>
                <DashboardPanelContent state={state} panel={panel} />
              </CardContent>
            </Card>
          </section>
        )
      })}
    </div>
  )
}

function DashboardPanelContent({
  state,
  panel,
}: {
  state: InstructorDashboardState
  panel: (typeof instructorDashboardPanels)[number]
}) {
  const Icon = panel.icon

  if (state.status === 'loading') {
    return <InstructorListSkeleton aria-label={`Loading ${panel.id} rows`} />
  }

  if (state.status === 'empty' || state.status === 'error') {
    return (
      <EmptyState
        icon={<Icon aria-hidden />}
        title="Unavailable without a course"
        description="Assign a course before this workspace can show course-specific activity."
      />
    )
  }

  return (
    <EmptyState
      icon={<Icon aria-hidden />}
      title={panel.emptyTitle}
      description={panel.emptyDescription}
      action={
        panel.action === 'upload' ? (
          <Button disabled type="button">
            <Upload aria-hidden />
            Upload material
          </Button>
        ) : undefined
      }
    />
  )
}
