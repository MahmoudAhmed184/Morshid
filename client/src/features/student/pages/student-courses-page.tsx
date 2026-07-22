import { Link } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'

function courseInitials(course: StudentCourse) {
  return (
    course.title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || course.code.slice(0, 2).toUpperCase()
  )
}

export function StudentCoursesPage() {
  const { data: assignedCourses } = useStudentCourses()

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-8">
      <PageHeader
        eyebrow="THE SHELF"
        title="Your courses."
        description="Each course is a private notebook. Open one to study it with a guided, source-grounded conversation."
      />

      {assignedCourses.length > 0 ? (
        <section
          className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Assigned courses"
        >
          {assignedCourses.map((course) => (
            <article
              key={course.id}
              className="hover-float flex flex-col rounded-3xl border border-foreground/8 bg-card p-8 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-medium text-primary"
                  aria-hidden
                >
                  {courseInitials(course)}
                </span>
                <Badge variant="success">Assigned</Badge>
              </div>
              <div className="mt-5 min-w-0">
                <h2 className="display-3 truncate text-foreground">
                  {course.title}
                </h2>
                <p className="footnote mt-1.5 truncate">{course.code}</p>
              </div>
              <p className="footnote mt-3">Private notebook · guided tutor</p>
              <div className="mt-6 flex-1" />
              <Button
                render={
                  <Link
                    to="/student/ai-tutor"
                    search={{ courseId: course.id }}
                  />
                }
              >
                Open notebook →
              </Button>
            </article>
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
  )
}
