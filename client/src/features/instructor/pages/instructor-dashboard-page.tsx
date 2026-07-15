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
import { ErrorState } from '@/components/ui/custom/error-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { StatCard } from '@/components/ui/custom/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { InstructorListSkeleton } from '@/features/instructor/components/instructor-list-skeleton'
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
      status: 'error'
      onRetry?: () => void
      isRetrying?: boolean
    }
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
        <CourseSection state={state} />
        <MetricsSection state={state} />
        <DashboardPanels state={state} />
        <SourceReadinessSection isLoading={isLoading} />
      </div>
    </div>
  )
}

function CourseSection({ state }: { state: InstructorDashboardState }) {
  return (
    <section
      aria-labelledby="course-heading"
      aria-busy={state.status === 'loading' || undefined}
      className="space-y-3"
    >
      <div className="space-y-1">
        <h2 id="course-heading" className="text-base font-semibold">
          Assigned course
        </h2>
        <p className="text-sm text-muted-foreground">
          Your protected Sprint 1 course workspace.
        </p>
      </div>

      <CourseSectionContent state={state} />
    </section>
  )
}

function CourseSectionContent({ state }: { state: InstructorDashboardState }) {
  if (state.status === 'loading') {
    return <CourseSkeleton />
  }

  if (state.status === 'empty') {
    return <InstructorDashboardEmptyState />
  }

  if (state.status === 'error') {
    return (
      <ErrorState
        title="Unable to load course"
        description="The assigned course could not be loaded. Try again."
        onRetry={state.onRetry}
        isRetrying={state.isRetrying}
        className="min-h-40"
      />
    )
  }

  return <CourseCard course={state.course} />
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

      <MetricsSectionContent state={state} />
    </section>
  )
}

function MetricsSectionContent({ state }: { state: InstructorDashboardState }) {
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

function DashboardPanels({ state }: { state: InstructorDashboardState }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {instructorDashboardPanels.map((panel) => (
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
            </CardHeader>
            <CardContent>
              <DashboardPanelContent state={state} panel={panel} />
            </CardContent>
          </Card>
        </section>
      ))}
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

function SourceReadinessSection({ isLoading }: { isLoading: boolean }) {
  return (
    <section
      aria-labelledby="sources-heading"
      aria-busy={isLoading || undefined}
    >
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
        <CardContent>
          {isLoading ? (
            <InstructorListSkeleton aria-label="Loading source readiness" />
          ) : (
            <EmptyState
              title="No source status yet"
              description="Source processing statuses will appear here after ingestion is connected."
              className="min-h-40"
            />
          )}
        </CardContent>
      </Card>
    </section>
  )
}
