import { Link } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { InstructorCourse } from '@/features/instructor/schemas/instructor-course.schema'
import type { InstructorDashboardState } from '@/features/instructor/types/instructor-dashboard-state'

type DashboardCourseSectionProps = {
  state: InstructorDashboardState
}

function CoursePanelFrame({
  children,
  ariaLabel,
  role,
}: {
  children: React.ReactNode
  ariaLabel?: string
  role?: string
}) {
  return (
    <section
      aria-label={ariaLabel}
      role={role}
      className="relative overflow-hidden rounded-3xl border border-foreground/8 bg-card p-8 shadow-sm"
    >
      <span
        className="absolute inset-y-8 left-0 w-0.5 rounded-full bg-rubric"
        aria-hidden
      />
      {children}
    </section>
  )
}

export function DashboardCourseSection({ state }: DashboardCourseSectionProps) {
  if (state.status === 'loading') {
    return <CourseSkeleton />
  }

  if (state.status === 'empty') {
    return (
      <CoursePanelFrame>
        <EmptyState
          icon={<BookOpen aria-hidden />}
          title="No assigned course"
          description="Ask an administrator to assign you to a course before managing materials or reviews."
          className="min-h-52 border-none bg-transparent"
        />
      </CoursePanelFrame>
    )
  }

  if (state.status === 'error') {
    return (
      <CoursePanelFrame>
        <ErrorState
          title="Unable to load course"
          description="The assigned course could not be loaded. Try again."
          onRetry={state.onRetry}
          isRetrying={state.isRetrying}
          className="min-h-52 border-none bg-transparent"
        />
      </CoursePanelFrame>
    )
  }

  return <CoursePanel course={state.course} />
}

function CoursePanel({ course }: { course: InstructorCourse }) {
  return (
    <CoursePanelFrame>
      <div className="flex h-full flex-col gap-6">
        <div className="space-y-3">
          <div className="smallcaps-label">Assigned course</div>
          <h2 id="course-heading" className="display-3 text-foreground">
            {course.title}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="font-mono">
              {course.code}
            </Badge>
            <span className="footnote">
              Your protected Sprint 1 course workspace
            </span>
          </div>
        </div>
        <div>
          <Button
            nativeButton={false}
            render={<Link to="/instructor/materials" />}
          >
            Open materials →
          </Button>
        </div>
      </div>
    </CoursePanelFrame>
  )
}

function CourseSkeleton() {
  return (
    <CoursePanelFrame ariaLabel="Loading assigned course" role="status">
      <div className="flex flex-col gap-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-3/4 max-w-md" />
          <Skeleton className="h-5 w-56" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
    </CoursePanelFrame>
  )
}
