import { Link } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import {
  firstNameFromDisplayName,
  timeAwareGreeting,
} from '@/features/student/utils/greeting'

export function StudentCoursesPage() {
  const { data: assignedCourses } = useStudentCourses()
  const displayName = useAuthStore((state) => state.user?.displayName)
  const greeting = timeAwareGreeting(firstNameFromDisplayName(displayName))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-6 pt-16 pb-12 md:px-8">
        <header>
          <h1 className="display-2 text-foreground">{greeting}</h1>
          <p className="mt-2 text-muted-foreground">
            Choose a course to continue.
          </p>
        </header>

        {assignedCourses.length > 0 ? (
          <section
            className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            aria-label="Assigned courses"
          >
            {assignedCourses.map((course) => (
              <Link
                key={course.id}
                to="/chat"
                search={{ courseId: course.id }}
                className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Card className="hover-float h-full gap-0 rounded-2xl p-6 [--card-spacing:--spacing(0)]">
                  <h2 className="truncate text-lg font-medium text-foreground">
                    {course.title}
                  </h2>
                  <p className="footnote mt-2">Open →</p>
                </Card>
              </Link>
            ))}
          </section>
        ) : (
          <EmptyState
            icon={<BookOpen className="size-5" aria-hidden />}
            title="No courses assigned yet."
            description="When an instructor enrolls you in a course, it will appear here ready to study."
            className="mt-8"
          />
        )}
      </div>
    </div>
  )
}
