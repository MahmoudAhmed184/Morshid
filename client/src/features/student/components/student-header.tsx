import { Link } from '@tanstack/react-router'
import { ChevronRight, Menu } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ui/mode-toggle'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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

const segmentLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  courses: 'Courses',
  'ai-tutor': 'AI Tutor',
  settings: 'Settings',
}

function StudentBreadcrumb({ pathname }: { pathname: string }) {
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'dashboard'
  const label = segmentLabels[segment] ?? segment

  return (
    <nav
      aria-label="Breadcrumb"
      className="smallcaps-label flex min-w-0 items-center gap-1.5"
    >
      <span className="hidden sm:inline">Student</span>
      <span className="hidden sm:inline" aria-hidden>
        ·
      </span>
      <span className="truncate text-foreground">{label}</span>
    </nav>
  )
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
  const isAiTutorWorkspace = pathname === '/student/ai-tutor'

  return (
    <header className="glass-paper sticky top-3 z-40 mx-3 mt-3 flex h-14 shrink-0 items-center justify-between gap-3 rounded-2xl px-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className={isAiTutorWorkspace ? '' : 'md:hidden'}
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

        {isAiTutorWorkspace ? (
          <StudentTutorBreadcrumb courseId={courseId} sessionId={sessionId} />
        ) : (
          <StudentBreadcrumb pathname={pathname} />
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <ModeToggle />
      </div>
    </header>
  )
}
