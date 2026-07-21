import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, Bot, MessageSquareText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StudentPageHeader } from '@/features/student/components/student-page-header'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import { cn } from '@/lib/utils'

function greetingFor(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function StudentDashboardPage() {
  const { data: assignedCourses } = useStudentCourses()
  const assignedCourseCount = assignedCourses.length
  const displayName = useAuthStore((state) => state.user?.displayName)
  const firstName = displayName?.split(/\s+/)[0]
  const continueCourse =
    assignedCourseCount > 0 ? assignedCourses[0] : undefined

  return (
    <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
      <StudentPageHeader
        title="Dashboard"
        eyebrow={greetingFor()}
        description={
          firstName
            ? `Welcome back, ${firstName}. Here's where your learning stands today.`
            : 'Welcome back. Here is where your learning stands today.'
        }
      />

      {/* Continue-learning hero */}
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm ring-1 ring-foreground/8 sm:p-8">
        <div
          className="bg-star-field pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]"
          aria-hidden
        />
        <div
          className="bg-radial-spot pointer-events-none absolute inset-0"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
              <Bot className="size-3.5" aria-hidden />
              AI Tutor
            </span>
            <h2 className="mt-3 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
              {continueCourse
                ? 'Pick up where you left off'
                : 'Your guide is ready'}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {continueCourse
                ? `Open a focused, Socratic conversation grounded in ${continueCourse.title}.`
                : 'Once a course is assigned, your private AI tutor will help you learn it, one question at a time.'}
            </p>
          </div>
          {continueCourse ? (
            <Link
              to="/student/ai-tutor"
              search={{ courseId: continueCourse.id }}
              className={cn(
                buttonVariants({ size: 'lg' }),
                'shrink-0 gap-2 shadow-glow-primary',
              )}
            >
              Open AI Tutor
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="justify-between">
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Assigned courses</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-card-foreground tabular-nums">
                {assignedCourseCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {assignedCourseCount === 1
                  ? 'Active enrollment'
                  : 'Active enrollments'}
              </p>
            </div>
            <span
              className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
              aria-hidden
            >
              <BookOpen className="size-5" />
            </span>
          </CardContent>
        </Card>

        <Card className="justify-between">
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">AI Tutor</p>
              <Badge variant="warning" className="mt-3">
                Chat not connected
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">
                Live tutoring is coming soon.
              </p>
            </div>
            <span
              className="flex size-11 items-center justify-center rounded-xl bg-gold/15 text-gold ring-1 ring-inset ring-gold/25"
              aria-hidden
            >
              <MessageSquareText className="size-5" />
            </span>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
