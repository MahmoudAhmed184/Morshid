import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { instructorCourseMetrics } from '@/features/instructor/constants/instructor-dashboard.constants'
import type { AuthCourseSummary } from '@/features/auth/types/auth.types'

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

export function CourseHeroSkeleton() {
  return (
    <Card
      aria-label="Loading course"
      className="rounded-[8px] border-border bg-card py-0 text-card-foreground ring-0"
      role="status"
    >
      <CardContent className="overflow-hidden px-0">
        <div className="relative min-h-56 p-5 sm:p-6">
          <div className="relative flex min-h-44 flex-col justify-between gap-8">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-6 w-24" />
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
                  className="rounded-[8px] border border-border bg-background/70 px-4 py-3"
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

export function CourseHero({ course }: { course: AuthCourseSummary }) {
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
              {instructorCourseMetrics.map((metric) => (
                <MetricTile
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
