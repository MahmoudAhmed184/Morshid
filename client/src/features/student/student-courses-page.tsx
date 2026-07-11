import { useSuspenseQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { studentCoursesQueryOptions } from '@/features/student/queries/student-courses.query'

export function StudentCoursesPage() {
  const { data: assignedCourses } = useSuspenseQuery(studentCoursesQueryOptions)

  return (
    <div className="flex flex-1 flex-col px-4 py-5 sm:px-6">
      <div className="mb-5">
        <p className="text-sm text-muted-foreground">Student Workspace</p>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          Courses
        </h1>
      </div>

      {assignedCourses.length > 0 ? (
        <section
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Assigned courses"
        >
          {assignedCourses.map((course) => (
            <article
              key={course.id}
              className="rounded-md border border-border bg-card p-4 text-card-foreground"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-card-foreground">
                    {course.title}
                  </h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {course.code}
                  </p>
                </div>
                <Badge variant="outline" className="border-primary/30">
                  Assigned
                </Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Course workspace placeholder. Materials and sessions will be
                connected in later sprint work.
              </p>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState title="No courses assigned yet." />
      )}
    </div>
  )
}
