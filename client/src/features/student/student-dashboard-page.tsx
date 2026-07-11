import { useSuspenseQuery } from '@tanstack/react-query'
import { BookOpen, MessageSquareText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { studentCoursesQueryOptions } from '@/features/student/queries/student-courses.query'

export function StudentDashboardPage() {
  const { data: assignedCourses } = useSuspenseQuery(studentCoursesQueryOptions)
  const assignedCourseCount = assignedCourses.length

  return (
    <div className="flex flex-1 flex-col px-4 py-5 sm:px-6">
      <div className="mb-5">
        <p className="text-sm text-muted-foreground">Student Workspace</p>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          Dashboard
        </h1>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-md border border-border bg-card p-4 text-card-foreground">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Assigned courses</p>
              <p className="mt-2 text-3xl font-semibold text-card-foreground">
                {assignedCourseCount}
              </p>
            </div>
            <BookOpen className="size-6 text-primary" aria-hidden />
          </div>
        </article>

        <article className="rounded-md border border-border bg-card p-4 text-card-foreground">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">AI Tutor</p>
              <Badge variant="outline" className="mt-3">
                Chat not connected
              </Badge>
            </div>
            <MessageSquareText className="size-6 text-primary" aria-hidden />
          </div>
        </article>
      </section>
    </div>
  )
}
