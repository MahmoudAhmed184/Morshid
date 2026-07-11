import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  Bell,
  BookOpen,
  Bot,
  Home,
  LogOut,
  Menu,
  Search,
  Settings,
} from 'lucide-react'
import { useState } from 'react'

import { Logo } from '@/components/logo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { logoutApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { StudentCourse } from '@/features/student/api/student-courses.api'
import { studentCoursesQueryOptions } from '@/features/student/queries/student-courses.query'
import { cn } from '@/lib/utils'

const primaryNavItems = [
  { label: 'Dashboard', icon: Home, to: '/student/dashboard' },
  { label: 'Courses', icon: BookOpen, to: '/student/courses' },
  { label: 'AI Tutor', icon: Bot, to: '/student/ai-tutor' },
] as const

const secondaryNavItems = [
  { label: 'Notifications', icon: Bell },
  { label: 'Settings', icon: Settings },
] as const

function getInitials(name: string | undefined) {
  if (!name) {
    return 'S'
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

type StudentSidebarContentProps = {
  assignedCourses: StudentCourse[]
  pathname: string
  onNavigate?: () => void
}

function StudentSidebarContent({
  assignedCourses,
  pathname,
  onNavigate,
}: StudentSidebarContentProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto px-4 py-5">
      <div className="mb-8 flex items-center gap-3">
        <Logo
          className="size-9 rounded-md bg-sidebar-primary text-sidebar-primary-foreground"
          iconClassName="size-4"
        />
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground">
            Morshid
          </p>
          <p className="text-xs text-muted-foreground">Student Portal</p>
        </div>
      </div>

      <nav className="space-y-1" aria-label="Student navigation">
        {primaryNavItems.map((item) => {
          const isActive = pathname === item.to
          const navClassName = cn(
            buttonVariants({
              variant: 'ghost',
              className:
                'h-9 w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            }),
            isActive &&
              'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
          )

          return (
            <Link
              key={item.label}
              to={item.to}
              className={navClassName}
              aria-current={isActive ? 'page' : undefined}
              onClick={onNavigate}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <section className="mt-7 border-t border-sidebar-border pt-5">
        <div className="mb-3">
          <h2 className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Assigned Courses
          </h2>
        </div>
        {assignedCourses.length > 0 ? (
          <ul className="space-y-2" aria-label="Assigned courses">
            {assignedCourses.map((course) => (
              <li
                key={course.id}
                className="rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-sidebar-foreground">
                      {course.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {course.code}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-primary/30">
                    Assigned
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No courses assigned yet."
            className="min-h-0 rounded-md px-3 py-4"
          />
        )}
      </section>

      <div className="mt-auto space-y-1 pt-6">
        {secondaryNavItems.map((item) => (
          <Button
            key={item.label}
            type="button"
            variant="ghost"
            className="h-9 w-full justify-start gap-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function StudentShellPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const { data: assignedCourses } = useSuspenseQuery(studentCoursesQueryOptions)
  const displayName = user?.displayName ?? 'Student'
  const initials = getInitials(displayName)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const handleLogout = async () => {
    const refreshToken = useAuthStore.getState().refreshToken

    try {
      if (refreshToken) {
        await logoutApi(refreshToken)
      }
    } catch {
      // Local logout must still complete if the revoke request is unavailable.
    } finally {
      clearSession()
      await navigate({ to: '/login' })
    }
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="flex min-h-svh w-full overflow-hidden">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
          <StudentSidebarContent
            assignedCourses={assignedCourses}
            pathname={pathname}
          />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-background">
          <header className="flex min-h-16 items-center gap-3 border-b border-border px-4 sm:px-6">
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
                <StudentSidebarContent
                  assignedCourses={assignedCourses}
                  pathname={pathname}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <div className="md:hidden">
              <Logo
                className="size-8 rounded-md bg-primary text-primary-foreground"
                iconClassName="size-4"
              />
            </div>

            <div className="relative hidden min-w-0 flex-1 sm:block">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="Search"
                placeholder="Search"
                className="h-9 bg-background pl-9"
              />
            </div>

            <Badge variant="secondary" className="hidden sm:inline-flex">
              Student
            </Badge>

            <Avatar
              className="bg-muted text-foreground"
              aria-label={displayName}
            >
              <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>

            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              className="bg-transparent"
            >
              <LogOut className="size-4" aria-hidden />
              Log out
            </Button>
          </header>

          <Outlet />
        </section>
      </div>
    </main>
  )
}
