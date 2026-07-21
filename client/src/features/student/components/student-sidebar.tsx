import { Bell, BookOpen, Bot, Home, Settings } from 'lucide-react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import type { AppSidebarNavItem } from '@/components/layout/app-sidebar'
import { Logo } from '@/components/logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'

const primaryNavItems: readonly AppSidebarNavItem[] = [
  { label: 'Dashboard', icon: Home, to: '/student/dashboard' },
  { label: 'Courses', icon: BookOpen, to: '/student/courses' },
  { label: 'AI Tutor', icon: Bot, to: '/student/ai-tutor' },
] as const

const secondaryNavItems = [{ label: 'Notifications', icon: Bell }] as const

const settingsNavItem: AppSidebarNavItem = {
  label: 'Settings',
  icon: Settings,
  to: '/student/settings',
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
  return (
    <AppSidebar
      navigation={primaryNavItems}
      settings={settingsNavItem}
      pathname={pathname}
      ariaLabel="Student navigation"
      onNavigate={onNavigate}
      className="overflow-y-auto px-4 py-5"
      header={
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
      }
      navigationClassName="space-y-1"
      itemClassName="flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      activeItemClassName="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
      settingsContainerClassName="border-t border-sidebar-border pt-1"
      footer={
        <div className="mt-auto space-y-1 pt-6">
          {secondaryNavItems.map((item) => (
            <Button
              key={item.label}
              type="button"
              variant="ghost"
              className="h-9 w-full justify-start gap-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              disabled
              title="Coming soon"
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Button>
          ))}
        </div>
      }
    >
      <section className="mt-7 border-t border-sidebar-border pt-5">
        <h2 className="mb-3 text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
          Assigned Courses
        </h2>
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
    </AppSidebar>
  )
}
