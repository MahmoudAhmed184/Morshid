import { BookOpen, MessageSquareText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { StudentPageHeader } from '@/features/student/components/student-page-header'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'

export function StudentDashboardPage() {
  const { data: assignedCourses } = useStudentCourses()
  const assignedCourseCount = assignedCourses.length

  return (
    <div className="flex flex-1 flex-col px-4 py-5 sm:px-6">
      <StudentPageHeader title="Dashboard" />

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
