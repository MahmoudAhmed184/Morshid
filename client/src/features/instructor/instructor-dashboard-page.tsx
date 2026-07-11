import { BookOpen, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthCourseSummary } from '@/features/auth/types/auth.types'

function getPrimaryInstructorCourse(courses: AuthCourseSummary[]) {
  return courses.length > 0 ? courses[0] : null
}

function MetricTile({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-[8px] border border-border bg-background/70 px-4 py-3">
      <p className="text-[0.68rem] font-medium text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

function CourseHero({ course }: { course: AuthCourseSummary }) {
  return (
    <Card className="rounded-[8px] border-border bg-card py-0 text-card-foreground ring-0">
      <CardContent className="overflow-hidden px-0">
        <div className="relative min-h-56 p-5 sm:p-6">
          <div aria-hidden className="absolute inset-0 bg-card" />
          <div
            aria-hidden
            className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:40px_40px]"
          />
          <div className="relative flex min-h-44 flex-col justify-between gap-8">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{course.code}</Badge>
                {course.membershipRole ? (
                  <Badge variant="outline">{course.membershipRole}</Badge>
                ) : null}
              </div>
              <div className="max-w-2xl space-y-2">
                <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
                  {course.title}
                </h2>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  Sprint 1 instructor shell for course materials and flagged
                  guidance review.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Course" value="Active" />
              <MetricTile label="Materials" value="Placeholder" />
              <MetricTile label="Review Queue" value="0 Pending" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function NoCourseState() {
  return (
    <EmptyState
      icon={<BookOpen />}
      title="No assigned courses"
      description="This instructor account does not have a course assignment in the current auth session."
      className="min-h-56 rounded-[8px] border-border bg-card text-card-foreground [&_h2]:text-foreground [&_p]:text-muted-foreground"
    />
  )
}

export function InstructorDashboardPage() {
  const user = useAuthStore((state) => state.user)
  const course = user ? getPrimaryInstructorCourse(user.courses) : null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Instructor Workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Instructor Dashboard
        </h1>
      </div>

      {course ? <CourseHero course={course} /> : <NoCourseState />}
    </div>
  )
}
