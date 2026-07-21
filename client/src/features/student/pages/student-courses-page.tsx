import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { StudentPageHeader } from '@/features/student/components/student-page-header'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import { cn } from '@/lib/utils'

export function StudentCoursesPage() {
  const { data: assignedCourses } = useStudentCourses()

  return (
    <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
      <StudentPageHeader
        title="Courses"
        description="Your assigned courses. Open the AI Tutor to study any of them with a private, guided conversation."
      />

      {assignedCourses.length > 0 ? (
        <section
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Assigned courses"
        >
          {assignedCourses.map((course) => (
            <Card
              key={course.id}
              className="group/course justify-between transition-shadow hover:shadow-md"
            >
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary"
                    aria-hidden
                  >
                    <BookOpen className="size-5" />
                  </span>
                  <Badge variant="success">Assigned</Badge>
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-card-foreground">
                    {course.title}
                  </h2>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {course.code}
                  </p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Course workspace placeholder. Materials and sessions will be
                  connected in later sprint work.
                </p>
              </CardContent>
              <CardFooter className="bg-transparent">
                <Link
                  to="/student/ai-tutor"
                  search={{ courseId: course.id }}
                  className={cn(
                    buttonVariants({ size: 'sm', variant: 'outline' }),
                    'w-full justify-center gap-2 bg-transparent',
                  )}
                >
                  Open AI Tutor
                  <ArrowRight
                    className="size-4 transition-transform group-hover/course:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={<BookOpen className="size-5" aria-hidden />}
          title="No courses assigned yet."
          description="When an instructor enrolls you in a course, it will appear here ready to study."
        />
      )}
    </div>
  )
}
