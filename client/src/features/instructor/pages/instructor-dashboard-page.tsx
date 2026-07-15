import { BookOpen, Upload } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { StatCard } from '@/components/ui/custom/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  instructorDashboardPanels,
  instructorDashboardStats,
} from '@/features/instructor/constants/instructor-route-dashboard.constants'

type InstructorCourse = {
  code: string
  title: string
}

type InstructorDashboardState =
  | { status: 'loading' }
  | { status: 'empty' }
  | {
      status: 'ready'
      course: InstructorCourse
      materialCount: number
      reviewQueueCount: number
    }

type InstructorDashboardPageProps = {
  state: InstructorDashboardState
  actions?: React.ReactNode
}

const skeletonRows = [0, 1, 2] as const

export function InstructorDashboardPage({
  state,
  actions,
}: InstructorDashboardPageProps) {
  const isLoading = state.status === 'loading'

  return (
    <main className="min-h-[calc(100svh-8rem)] bg-background">
      <div
        className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8"
        {...(isLoading
          ? {
              role: 'status' as const,
              'aria-label': 'Loading instructor dashboard',
            }
          : {})}
      >
        <PageHeader
          eyebrow={<Badge variant="secondary">Instructor workspace</Badge>}
          title="Instructor dashboard"
          description="Manage course sources and review activity for your assigned course."
          actions={actions}
        />

        <CourseSection state={state} />
        <MetricsSection state={state} />
        <DashboardPanels state={state} />
        <SourceReadinessSection isLoading={isLoading} />
      </div>
    </main>
  )
}

function CourseSection({ state }: { state: InstructorDashboardState }) {
  return (
    <section aria-labelledby="course-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="course-heading" className="text-base font-semibold">
          Assigned course
        </h2>
        <p className="text-sm text-muted-foreground">
          Your protected Sprint 1 course workspace.
        </p>
      </div>

      {state.status === 'loading' ? <CourseSkeleton /> : null}
      {state.status === 'empty' ? <InstructorDashboardEmptyState /> : null}
      {state.status === 'ready' ? <CourseCard course={state.course} /> : null}
    </section>
  )
}

function CourseCard({ course }: { course: InstructorCourse }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>
              <h3>{course.title}</h3>
            </CardTitle>
            <CardDescription>
              Your protected Sprint 1 course workspace
            </CardDescription>
          </div>
          <Badge variant="outline">{course.code}</Badge>
        </div>
      </CardHeader>
    </Card>
  )
}

function CourseSkeleton() {
  return (
    <Card aria-label="Loading assigned course">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-6 w-28" />
        </div>
      </CardHeader>
    </Card>
  )
}

function InstructorDashboardEmptyState() {
  return (
    <EmptyState
      icon={<BookOpen aria-hidden />}
      title="No assigned course"
      description="Ask an administrator to assign you to a course before managing materials or reviews."
    />
  )
}

function MetricsSection({ state }: { state: InstructorDashboardState }) {
  return (
    <section aria-labelledby="metrics-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="metrics-heading" className="text-base font-semibold">
          Workspace metrics
        </h2>
        <p className="text-sm text-muted-foreground">
          Course source and review activity totals.
        </p>
      </div>

      {state.status === 'empty' ? (
        <EmptyState
          title="No metrics available"
          description="Assign a course before this workspace can show course-specific totals."
          className="min-h-40"
        />
      ) : (
        <MetricsCards state={state} />
      )}
    </section>
  )
}

function MetricsCards({
  state,
}: {
  state: Exclude<InstructorDashboardState, { status: 'empty' }>
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {instructorDashboardStats.map((stat) => {
        const Icon = stat.icon
        const value =
          state.status === 'loading' ? (
            <Skeleton className="h-8 w-12" />
          ) : (
            {
              materials: state.materialCount,
              reviewQueue: state.reviewQueueCount,
            }[stat.key]
          )

        return (
          <StatCard
            key={stat.key}
            label={stat.label}
            value={value}
            icon={<Icon aria-hidden />}
            description={stat.description}
          />
        )
      })}
    </div>
  )
}

function DashboardPanels({ state }: { state: InstructorDashboardState }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {instructorDashboardPanels.map((panel) => {
        const Icon = panel.icon

        return (
          <section
            key={panel.id}
            aria-labelledby={panel.headingId}
            id={panel.id}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <h2 id={panel.headingId}>{panel.title}</h2>
                </CardTitle>
                <CardDescription>{panel.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {state.status === 'loading' ? <PanelRowsSkeleton /> : null}
                {state.status === 'empty' ? (
                  <EmptyState
                    icon={<Icon aria-hidden />}
                    title="Unavailable without a course"
                    description="Assign a course before this workspace can show course-specific activity."
                  />
                ) : null}
                {state.status === 'ready' ? (
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
                ) : null}
              </CardContent>
            </Card>
          </section>
        )
      })}
    </div>
  )
}

function PanelRowsSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading section rows">
      {skeletonRows.map((row) => (
        <div
          key={row}
          className="flex items-center gap-3 rounded-[8px] border border-border px-4 py-3"
        >
          <Skeleton className="size-9 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  )
}

function SourceReadinessSection({ isLoading }: { isLoading: boolean }) {
  return (
    <section aria-labelledby="sources-heading">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="sources-heading">Source readiness</h2>
          </CardTitle>
          <CardDescription>
            Processing, ready, warning, and failed source statuses will be
            reported here after ingestion integration.
          </CardDescription>
        </CardHeader>
        {isLoading ? (
          <CardContent>
            <PanelRowsSkeleton />
          </CardContent>
        ) : null}
      </Card>
    </section>
  )
}
