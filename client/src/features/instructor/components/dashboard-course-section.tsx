import { BookOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { InstructorCourse } from '@/features/instructor/schemas/instructor-course.schema'
import type { InstructorDashboardState } from '@/features/instructor/types/instructor-dashboard-state'

type DashboardCourseSectionProps = {
  state: InstructorDashboardState
}

export function DashboardCourseSection({ state }: DashboardCourseSectionProps) {
  return (
    <section
      aria-labelledby="course-heading"
      aria-busy={state.status === 'loading' || undefined}
      className="space-y-3"
    >
      <div className="space-y-1">
        <h2 id="course-heading" className="text-base font-semibold">
          Assigned courses
        </h2>
        <p className="text-sm text-muted-foreground">
          Course workspaces currently assigned to your Instructor account.
        </p>
      </div>

      <DashboardCourseSectionContent state={state} />
    </section>
  )
}

function DashboardCourseSectionContent({ state }: DashboardCourseSectionProps) {
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

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {state.courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  )
}

function CourseCard({ course }: { course: InstructorCourse }) {
  return (
    <Card className="rounded-[8px] py-0 ring-1 ring-foreground/10">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>
              <h3>{course.title}</h3>
            </CardTitle>
            <CardDescription>Assigned Instructor workspace</CardDescription>
          </div>
          <Badge variant="outline">{course.code}</Badge>
        </div>
      </CardHeader>
    </Card>
  )
}

function CourseSkeleton() {
  return (
    <Card
      aria-label="Loading assigned course"
      className="rounded-[8px] py-0 ring-1 ring-foreground/10"
    >
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
      description="Ask an administrator to assign you to a course before managing course materials."
    />
  )
}
