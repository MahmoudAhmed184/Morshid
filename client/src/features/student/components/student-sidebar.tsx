import { Bell, BookOpen, Home, Settings } from 'lucide-react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import type { AppSidebarNavItem } from '@/components/layout/app-sidebar'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { StudentNavigationRail } from '@/features/student/components/student-navigation-rail'

const primaryNavItems: readonly AppSidebarNavItem[] = [
  { label: 'Dashboard', icon: Home, to: '/student/dashboard' },
  { label: 'Courses', icon: BookOpen, to: '/student/courses' },
] as const

const secondaryNavItems = [{ label: 'Notifications', icon: Bell }] as const

const settingsNavItem: AppSidebarNavItem = {
  label: 'Settings',
  icon: Settings,
  to: '/student/settings',
}

type StudentSidebarProps = {
  pathname: string
  onNavigate?: () => void
  compact?: boolean
}

export function StudentSidebar({
  pathname,
  onNavigate,
  compact = false,
}: StudentSidebarProps) {
  if (compact) {
    return (
      <StudentNavigationRail
        pathname={pathname}
        navigation={primaryNavItems}
        settings={settingsNavItem}
      />
    )
  }

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
    />
  )
}
