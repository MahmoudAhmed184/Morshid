import { BookOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthCourseSummary } from '@/features/auth/types/auth.types'

function CourseHero({ course }: { course: AuthCourseSummary }) {
  return (
    <Card className="rounded-[8px] border-[#26374a] bg-[#101c2b] py-0 text-white ring-0">
      <CardContent className="overflow-hidden px-0">
        <div className="relative min-h-56 p-5 sm:p-6">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(135deg,#16243a_0%,#07131f_48%,#162844_100%)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-35 [background-image:linear-gradient(#7fa7ff24_1px,transparent_1px),linear-gradient(90deg,#7fa7ff24_1px,transparent_1px)] [background-size:40px_40px]"
          />
          <div className="relative flex min-h-44 flex-col justify-between gap-8">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-[#dbe8ff] text-[#07111f]">
                  {course.code}
                </Badge>
                {course.membershipRole ? (
                  <Badge
                    variant="outline"
                    className="border-[#6f84a3] text-[#dbe8ff]"
                  >
                    {course.membershipRole}
                  </Badge>
                ) : null}
              </div>
              <div className="max-w-2xl space-y-2">
                <h2 className="text-3xl font-semibold text-white sm:text-4xl">
                  {course.title}
                </h2>
                <p className="max-w-xl text-sm leading-6 text-[#b0bfd2]">
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

function MetricTile({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-[8px] border border-[#26374a] bg-[#0b1624]/80 px-4 py-3">
      <p className="text-[0.68rem] font-medium text-[#7f8da3] uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

function NoCourseState() {
  return (
    <EmptyState
      icon={<BookOpen />}
      title="No assigned courses"
      description="This instructor account does not have a course assignment in the current auth session."
      className="min-h-56 rounded-[8px] border-[#33445a] bg-[#101821] text-[#d7dfec] [&_h2]:text-white [&_p]:text-[#7f8da3]"
    />
  )
}

export function MyCoursesPage() {
  const user = useAuthStore((state) => state.user)
  const courses = user?.courses ?? []

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="flex items-center gap-2 text-xs font-medium text-[#7f8da3]">
          <BookOpen className="size-4 text-[#a9c7ff]" aria-hidden />
          Instructor Workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">My Courses</h1>
      </div>

      {courses.length === 0 ? (
        <NoCourseState />
      ) : (
        <div className="flex flex-col gap-5">
          {courses.map((course) => (
            <CourseHero key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  )
}
