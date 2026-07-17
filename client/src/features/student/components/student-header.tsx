import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useState } from 'react'

import { DashboardHeader } from '@/components/layout/dashboard-header'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { StudentSidebar } from '@/features/student/components/student-sidebar'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import { useStudentSessions } from '@/features/student/hooks/use-student-sessions'

type StudentHeaderProps = {
  pathname: string
  courseId?: string
  sessionId?: string
}

type StudentTutorBreadcrumbProps = {
  courseId?: string
  sessionId?: string
}

function StudentTutorBreadcrumb({
  courseId,
  sessionId,
}: StudentTutorBreadcrumbProps) {
  const { data: courses } = useStudentCourses()
  const selectedCourse = courses.find((course) => course.id === courseId)
  const { data } = useStudentSessions({ courseId: selectedCourse?.id })
  const sessions = data?.pages.flatMap((page) => page.sessions) ?? []
  const selectedSession = sessions.find((session) => session.id === sessionId)
  const currentLabel = selectedCourse
    ? `${selectedCourse.code} · ${selectedSession?.title ?? selectedCourse.title}`
    : 'AI Tutor'

  return (
    <nav
      aria-label="Tutor breadcrumb"
      className="flex min-w-0 items-center gap-3 text-sm"
    >
      <Link
        to="/student/courses"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        Courses
      </Link>
      <span className="text-border" aria-hidden>
        /
      </span>
      <span className="truncate font-medium text-foreground">
        {currentLabel}
      </span>
    </nav>
  )
}

export function StudentHeader({
  pathname,
  courseId,
  sessionId,
}: StudentHeaderProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const isAiTutorWorkspace = pathname === '/student/ai-tutor'

  return (
    <DashboardHeader
      displayName={user?.displayName}
      email={user?.email}
      searchLabel="Search student workspace"
      searchPlaceholder="Search courses or learning resources..."
      content={
        isAiTutorWorkspace ? (
          <StudentTutorBreadcrumb courseId={courseId} sessionId={sessionId} />
        ) : undefined
      }
      leading={
        !isAiTutorWorkspace ? (
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-transparent md:hidden"
                  aria-label="Open student navigation"
                />
              }
            >
              <Menu className="size-5" aria-hidden />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 max-w-[85vw] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-xs"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Student navigation</SheetTitle>
              </SheetHeader>
              <StudentSidebar
                pathname={pathname}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </SheetContent>
          </Sheet>
        ) : undefined
      }
    />
  )
}
