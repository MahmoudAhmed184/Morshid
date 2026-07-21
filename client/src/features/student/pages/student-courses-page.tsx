import { Link } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
        description="Your assigned courses. Open the AI Tutor to study any of them with a private, guided conversation."
      />

      {assignedCourses.length > 0 ? (
        <section
          className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Assigned courses"
        >
          {assignedCourses.map((course) => (
            <article
              key={course.id}
              className="hover-float flex flex-col rounded-2xl border border-foreground/8 bg-card p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-medium text-primary"
                  aria-hidden
                >
                  {courseInitials(course)}
                </span>
                <Badge variant="success">Assigned</Badge>
              </div>
              <div className="mt-4 min-w-0">
                <h2 className="truncate text-lg font-medium text-foreground">
                  {course.title}
                </h2>
                <p className="footnote mt-1 truncate">{course.code}</p>
              </div>
              <div className="rule mt-5 pt-5">
                <Link
                  to="/student/ai-tutor"
                  search={{ courseId: course.id }}
                  className="link-editorial text-sm"
                >
                  Study with the tutor →
                </Link>
              </div>
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
