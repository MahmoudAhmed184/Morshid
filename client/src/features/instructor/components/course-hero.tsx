import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { InstructorCourse } from '@/features/instructor/schemas/instructor-course.schema'

export function CourseHeroSkeleton() {
  return (
    <Card
      aria-hidden
      className="min-h-72 rounded-[8px] border-border bg-card py-0 text-card-foreground ring-0"
    >
      <CardContent className="overflow-hidden px-0">
        <div className="relative min-h-72 p-5">
          <Skeleton className="mb-5 h-24 w-full rounded-[6px]" />
          <div className="relative flex min-h-36 flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-28" />
              </div>
              <div className="max-w-2xl space-y-2">
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-9 w-44" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CourseHero({ course }: { course: InstructorCourse }) {
  return (
    <Card className="min-h-72 rounded-[8px] border-border bg-card py-0 text-card-foreground ring-0 transition-colors hover:border-primary/40">
      <CardContent className="overflow-hidden px-0">
        <div className="relative min-h-72 p-5">
          <div aria-hidden className="absolute inset-0 bg-card" />
          <div
            aria-hidden
            className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:40px_40px]"
          />
          <div
            aria-hidden
            className="relative mb-5 h-24 overflow-hidden rounded-[6px] border border-border bg-primary/5"
          >
            <div className="absolute -top-12 right-4 size-32 rounded-full border border-primary/20" />
            <div className="absolute top-7 right-14 size-20 rounded-full border border-primary/15" />
          </div>
          <div className="relative flex min-h-36 flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{course.code}</Badge>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  {course.title}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Manage materials and learning resources for this assigned
                  course.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">Instructor access</Badge>
              <Badge variant="secondary">Assigned course</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
