import { Outlet, useRouterState } from '@tanstack/react-router'

import { StudentHeader } from '@/features/student/components/student-header'
import { StudentSidebar } from '@/features/student/components/student-sidebar'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'

export function StudentShellPage() {
  const { data: assignedCourses } = useStudentCourses()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="flex min-h-svh w-full overflow-hidden">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
          <StudentSidebar
            assignedCourses={assignedCourses}
            pathname={pathname}
          />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-background">
          <StudentHeader
            assignedCourses={assignedCourses}
            pathname={pathname}
          />
          <Outlet />
        </section>
      </div>
    </main>
  )
}
