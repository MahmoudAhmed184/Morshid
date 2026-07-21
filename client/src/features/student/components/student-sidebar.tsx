import { Link } from '@tanstack/react-router'
import { BookOpen, Bot, Home, LogOut, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { getUserInitials } from '@/components/layout/dashboard-header'
import { Logo } from '@/components/logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { useLogout } from '@/features/auth/hooks/use-logout'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import { cn } from '@/lib/utils'

type StudentNavItem = {
  label: string
  icon: LucideIcon
  to: string
}

const primaryNavItems: readonly StudentNavItem[] = [
  { label: 'Dashboard', icon: Home, to: '/student/dashboard' },
  { label: 'Courses', icon: BookOpen, to: '/student/courses' },
  { label: 'AI Tutor', icon: Bot, to: '/student/ai-tutor' },
] as const

const settingsNavItem: StudentNavItem = {
  label: 'Settings',
  icon: Settings,
  to: '/student/settings',
}

function isActivePath(to: string, pathname: string) {
  return (
    pathname === to || pathname === `${to}/` || pathname.startsWith(`${to}/`)
  )
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

type StudentSidebarNavLinkProps = {
  item: StudentNavItem
  pathname: string
  onNavigate?: () => void
}

function StudentSidebarNavLink({
  item,
  pathname,
  onNavigate,
}: StudentSidebarNavLinkProps) {
  const Icon = item.icon
  const isActive = isActivePath(item.to, pathname)

  return (
    <Link
      to={item.to}
      aria-current={isActive ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-secondary/60',
      )}
    >
      {isActive ? (
        <span
          className="absolute left-0 h-5 w-0.5 rounded-full bg-rubric"
          aria-hidden
        />
      ) : null}
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

type StudentSidebarProps = {
  assignedCourses: StudentCourse[]
  pathname: string
  onNavigate?: () => void
}

export function StudentSidebar({
  assignedCourses,
  pathname,
  onNavigate,
}: StudentSidebarProps) {
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()
  const displayName = user?.displayName ?? 'Student'
  const roleLabel = user?.role
    ? `${user.role.charAt(0)}${user.role.slice(1).toLowerCase()}`
    : 'Student'

  return (
    <div className="flex h-full min-h-0 flex-col text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <Logo className="size-8 text-foreground" iconClassName="size-5" />
        <span className="font-display text-[1.125rem] leading-none text-foreground">
          Morshid
        </span>
        <Badge variant="secondary" className="ml-auto">
          Student
        </Badge>
      </div>

      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-3 pt-6">
        <nav aria-label="Student navigation" className="space-y-1">
          <p className="smallcaps-label px-2 pb-2">Workspace</p>
          {primaryNavItems.map((item) => (
            <StudentSidebarNavLink
              key={item.to}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </nav>

        <section className="pt-6">
          <h2 className="smallcaps-label px-2 pb-2">Assigned courses</h2>
          {assignedCourses.length > 0 ? (
            <ul className="space-y-1" aria-label="Assigned courses">
              {assignedCourses.map((course) => (
                <li
                  key={course.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-medium text-primary"
                    aria-hidden
                  >
                    {courseInitials(course)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-sidebar-foreground">
                      {course.title}
                    </p>
                    <p className="footnote truncate">{course.code}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No courses assigned yet."
              className="min-h-0 rounded-xl px-3 py-4"
            />
          )}
        </section>

        <nav className="pt-6" aria-label="Student settings">
          <StudentSidebarNavLink
            item={settingsNavItem}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        </nav>
      </div>

      <div className="m-3 flex items-center gap-3 rounded-xl border bg-card p-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground"
          aria-hidden
        >
          {getUserInitials(user?.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {displayName}
          </p>
          <p className="footnote truncate">{roleLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Sign out"
          onClick={() => void logout()}
        >
          <LogOut className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
