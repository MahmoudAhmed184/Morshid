import { Link } from '@tanstack/react-router'
import { BookOpen, MessageSquareText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/custom/page-header'
import { StatCard } from '@/components/ui/custom/stat-card'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import { cn } from '@/lib/utils'

function greetingFor(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

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

export function StudentDashboardPage() {
  const { data: assignedCourses } = useStudentCourses()
  const assignedCourseCount = assignedCourses.length
  const displayName = useAuthStore((state) => state.user?.displayName)
  const firstName = displayName?.split(/\s+/)[0]
  const greeting = greetingFor()
  const title = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`
  const continueCourse =
    assignedCourseCount > 0 ? assignedCourses[0] : undefined
  const shelfCourses = assignedCourses.slice(0, 4)
  const hasMoreCourses = assignedCourseCount > shelfCourses.length

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-8">
      <PageHeader
        eyebrow="YOUR DESK"
        title={title}
        description="Pick up where the last question left off."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Resume panel */}
        <section className="relative overflow-hidden rounded-3xl border bg-card p-8 shadow-sm lg:col-span-2">
          <div
            className="atmosphere pointer-events-none absolute inset-0"
            aria-hidden
          />
          <span
            className="absolute inset-y-8 left-0 w-0.5 rounded-full bg-rubric"
            aria-hidden
          />
          <div className="relative">
            <p className="smallcaps-label">CONTINUE</p>
            <p className="display-3 mt-3 text-foreground">
              Ask your first question.
            </p>
            {continueCourse ? (
              <p className="footnote mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{continueCourse.title}</span>
                <span aria-hidden>·</span>
                <span className="font-mono">{continueCourse.code}</span>
              </p>
            ) : null}
            <Link
              to="/student/ai-tutor"
              search={
                continueCourse ? { courseId: continueCourse.id } : undefined
              }
              className={cn(buttonVariants(), 'mt-6')}
            >
              Open the tutor →
            </Link>
          </div>
        </section>

        {/* The Shelf */}
        <section className="rounded-2xl border border-foreground/8 bg-card p-6 shadow-sm">
          <p className="smallcaps-label">YOUR COURSES</p>
          {shelfCourses.length > 0 ? (
            <ul className="mt-4 space-y-3" aria-label="Your courses">
              {shelfCourses.map((course) => (
                <li key={course.id} className="flex items-center gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-medium text-primary"
                    aria-hidden
                  >
                    {courseInitials(course)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {course.title}
                    </p>
                    <p className="footnote truncate">{course.code}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              No courses assigned yet. When an instructor enrolls you, your
              courses will appear here.
            </p>
          )}
          {hasMoreCourses ? (
            <Link
              to="/student/courses"
              className="link-editorial mt-4 inline-block text-sm"
            >
              All courses →
            </Link>
          ) : null}
        </section>
      </div>

      {/* Stat row */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <StatCard
          label="Assigned courses"
          value={assignedCourseCount}
          tone="primary"
          icon={<BookOpen />}
          description={
            assignedCourseCount === 1
              ? 'Active enrollment'
              : 'Active enrollments'
          }
        />
        <StatCard
          label="AI Tutor"
          value={<Badge variant="warning">Chat not connected</Badge>}
          tone="gold"
          icon={<MessageSquareText />}
          description="Live tutoring is coming soon."
        />
      </div>
    </div>
  )
}
