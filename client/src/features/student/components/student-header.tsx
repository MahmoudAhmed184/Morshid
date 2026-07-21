import { Link } from '@tanstack/react-router'
import { ChevronRight, Menu } from 'lucide-react'
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
import { useStudentSession } from '@/features/student/hooks/use-student-sessions'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'

type StudentHeaderProps = {
  assignedCourses: StudentCourse[]
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
  const { data: routedSession } = useStudentSession({
    courseId: selectedCourse?.id,
    sessionId,
  })
  const selectedSession = routedSession
  return (
    <nav
      aria-label="Tutor breadcrumb"
      className="flex min-w-0 items-center gap-2 text-sm"
    >
      <span className="hidden min-w-0 items-center gap-2 md:flex">
        <Link
          to="/student/courses"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          Courses
        </Link>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground/50"
          aria-hidden
        />
        {selectedCourse ? (
          <>
            <Link
              to="/student/ai-tutor"
              search={{ courseId: selectedCourse.id }}
              className="max-w-48 truncate text-muted-foreground hover:text-foreground"
            >
              {selectedCourse.title}
            </Link>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground/50"
              aria-hidden
            />
          </>
        ) : null}
      </span>
      <span className="truncate font-medium text-foreground">
        {selectedSession?.title ?? 'AI Tutor'}
      </span>
    </nav>
  )
}

export function StudentHeader({
  assignedCourses,
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
      searchPlaceholder="Search courses or learning resources…"
      content={
        isAiTutorWorkspace ? (
          <StudentTutorBreadcrumb courseId={courseId} sessionId={sessionId} />
        ) : undefined
      }
      showHelp={!isAiTutorWorkspace}
      className={isAiTutorWorkspace ? 'border-border bg-card' : undefined}
      leading={
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className={
                  isAiTutorWorkspace
                    ? 'bg-transparent'
                    : 'bg-transparent md:hidden'
                }
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
              assignedCourses={assignedCourses}
              pathname={pathname}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </SheetContent>
        </Sheet>
      }
    />
  )
}
