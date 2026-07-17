import { Link } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { StudentPageHeader } from '@/features/student/components/student-page-header'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import { useStudentSessions } from '@/features/student/hooks/use-student-sessions'
import { cn } from '@/lib/utils'

import { StudentDisabledComposer } from './student-disabled-composer'
import { StudentSessionNavigation } from './student-session-navigation'
import { StudentWorkspaceState } from './student-workspace-state'

interface StudentAiTutorPageProps {
  courseId?: string
  sessionId?: string
}

export function StudentAiTutorPage({
  courseId,
  sessionId,
}: StudentAiTutorPageProps) {
  const { data: assignedCourses } = useStudentCourses()
  const selectedCourse =
    (courseId
      ? assignedCourses.find((course) => course.id === courseId)
      : assignedCourses.length === 1
        ? assignedCourses[0]
        : undefined) ?? null
  const sessionsQuery = useStudentSessions({ courseId: selectedCourse?.id })
  const sessions = sessionsQuery.data?.sessions ?? []
  const selectedSession =
    sessions.find((session) => session.id === sessionId) ?? null

  return (
    <div className="flex flex-1 flex-col px-4 py-5 sm:px-6">
      <StudentPageHeader title="AI Tutor" />

      <section
        className="flex min-h-96 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground"
        aria-labelledby="student-chat-title"
      >
        <header className="flex min-h-16 flex-col justify-center gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Course Context
            </p>
            <h2
              id="student-chat-title"
              className="mt-1 truncate text-base font-semibold text-card-foreground"
            >
              {selectedCourse?.title ?? 'No course selected'}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {selectedCourse?.code ??
                courseSelectionDescription(assignedCourses)}
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            Private workspace
          </Badge>
        </header>

        {assignedCourses.length > 1 ? (
          <nav
            aria-label="Choose course context"
            className="flex flex-wrap gap-2 border-b border-border px-4 py-3"
          >
            {assignedCourses.map((course) => (
              <Link
                key={course.id}
                to="/student/ai-tutor"
                search={{ courseId: course.id }}
                aria-current={
                  selectedCourse?.id === course.id ? 'page' : undefined
                }
                className={cn(
                  buttonVariants({ size: 'sm', variant: 'outline' }),
                  selectedCourse?.id === course.id &&
                    'border-primary bg-primary/15 text-foreground',
                )}
              >
                {course.title}
              </Link>
            ))}
          </nav>
        ) : null}

        {selectedCourse ? (
          <div className="grid min-h-0 flex-1 md:grid-cols-[17rem_minmax(0,1fr)]">
            <StudentSessionNavigation
              courseId={selectedCourse.id}
              sessions={sessions}
              selectedSessionId={sessionId}
              isPending={sessionsQuery.isPending}
              isError={sessionsQuery.isError}
              isRefreshing={
                sessionsQuery.isFetching && !sessionsQuery.isPending
              }
              onRetry={() => void sessionsQuery.refetch()}
            />

            <div className="flex min-h-80 min-w-0 flex-col">
              <div className="flex flex-1 items-center justify-center px-4 py-10">
                <StudentWorkspaceState
                  sessionId={sessionId}
                  selectedSessionTitle={selectedSession?.title}
                  sessionsPending={sessionsQuery.isPending}
                  sessionsError={sessionsQuery.isError}
                  hasSessions={sessions.length > 0}
                />
              </div>
              <StudentDisabledComposer
                hasSelectedSession={selectedSession !== null}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-4 py-12">
            <EmptyState
              icon={<BookOpen className="size-6" aria-hidden />}
              title={
                assignedCourses.length === 0
                  ? 'No assigned course'
                  : 'Choose a course'
              }
              description={
                assignedCourses.length === 0
                  ? 'An active Student course membership is required before you can open a private workspace.'
                  : 'Select one of your assigned courses to load its private conversations.'
              }
              className="w-full max-w-md border-0 bg-transparent"
            />
          </div>
        )}
      </section>
    </div>
  )
}

function courseSelectionDescription(assignedCourses: { id: string }[]): string {
  if (assignedCourses.length === 0) {
    return 'No active Student course membership.'
  }

  return 'Choose an assigned course to continue.'
}
