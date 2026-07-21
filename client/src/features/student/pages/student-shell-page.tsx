import { Outlet, useHydrated, useRouterState } from '@tanstack/react-router'

import { AuthLoader } from '@/features/auth/components/auth-loader'
import { StudentHeader } from '@/features/student/components/student-header'
import { StudentSidebar } from '@/features/student/components/student-sidebar'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'

export function StudentShellPage() {
  const isHydrated = useHydrated()
  const { data: assignedCourses } = useStudentCourses()
  const location = useRouterState({
    select: (state) => state.location,
  })
  const pathname = location.pathname
  const isAiTutorWorkspace = pathname === '/student/ai-tutor'
  const courseId =
    typeof location.search.courseId === 'string'
      ? location.search.courseId
      : undefined
  const sessionId =
    typeof location.search.sessionId === 'string'
      ? location.search.sessionId
      : undefined

  if (!isHydrated) {
    return <AuthLoader />
  }

  return (
    <main className="h-svh overflow-hidden bg-background text-foreground">
      <div className="flex h-full w-full overflow-hidden">
        {!isAiTutorWorkspace ? (
          <aside className="m-3 hidden h-[calc(100svh-1.5rem)] w-64 shrink-0 overflow-hidden rounded-2xl border bg-sidebar text-sidebar-foreground shadow-sm md:block">
            <StudentSidebar
              assignedCourses={assignedCourses}
              pathname={pathname}
            />
          </aside>
        ) : null}

        <section
          className={
            isAiTutorWorkspace
              ? 'flex min-w-0 flex-1 flex-col overflow-hidden bg-background'
              : 'flex min-w-0 flex-1 flex-col overflow-y-auto bg-background'
          }
        >
          <StudentHeader
            assignedCourses={assignedCourses}
            pathname={pathname}
            courseId={courseId}
            sessionId={sessionId}
          />
          <Outlet />
        </section>
      </div>
    </main>
  )
}
