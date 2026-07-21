import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { StatCard } from '@/components/ui/custom/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import { instructorCourseMetrics } from '@/features/instructor/constants/instructor-dashboard.constants'
import type { InstructorCourse } from '@/features/instructor/schemas/instructor-course.schema'

export function CourseHeroSkeleton() {
  return (
    <Card aria-label="Loading course" className="py-0" role="status">
      <CardContent className="overflow-hidden px-0">
        <div className="relative min-h-56 p-5 sm:p-6">
          <div className="relative flex min-h-44 flex-col justify-between gap-8">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-28" />
              </div>
              <div className="max-w-2xl space-y-2">
                <Skeleton className="h-10 w-3/4 max-w-md" />
                <Skeleton className="h-4 w-full max-w-xl" />
                <Skeleton className="h-4 w-4/5 max-w-lg" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {instructorCourseMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border border-border bg-background/70 px-4 py-3"
                >
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-2 h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CourseHero({ course }: { course: InstructorCourse }) {
  return (
    <Card className="py-0">
      <CardContent className="overflow-hidden px-0">
        <div className="relative min-h-56 p-5 sm:p-6">
          <div aria-hidden className="absolute inset-0 bg-card" />
          <div
            aria-hidden
            className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_75%)]"
          />
          <div className="relative flex min-h-44 flex-col justify-between gap-8">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="font-mono">{course.code}</Badge>
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
              {instructorCourseMetrics.map((metric) => (
                <StatCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  className="border-border bg-background/70 py-4 shadow-none"
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
