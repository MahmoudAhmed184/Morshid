import { Link } from '@tanstack/react-router'
import { Bell, BookOpen, Home, Settings } from 'lucide-react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import type { AppSidebarNavItem } from '@/components/layout/app-sidebar'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

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

function isRailItemActive(pathname: string, to: string) {
  if (to === '/student/courses') {
    return (
      pathname.startsWith('/student/courses') ||
      pathname.startsWith('/student/ai-tutor')
    )
  }

  return pathname === to || pathname.startsWith(`${to}/`)
}

function StudentNavigationRail({ pathname }: { pathname: string }) {
  return (
    <TooltipProvider>
      <div className="flex h-full flex-col items-center bg-white py-3">
        <Logo
          className="size-10 rounded-xl bg-blue-600 text-white shadow-sm"
          iconClassName="size-4"
        />

        <nav
          aria-label="Student navigation"
          className="flex flex-1 flex-col items-center justify-center gap-4"
        >
          {primaryNavItems.map((item) => {
            const active = isRailItemActive(pathname, item.to)

            return (
              <Tooltip key={item.to}>
                <TooltipTrigger
                  render={
                    <Link
                      to={item.to}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex size-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:outline-none',
                        active && 'bg-blue-50 text-blue-600',
                      )}
                    />
                  }
                >
                  <item.icon className="size-5" aria-hidden />
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          })}

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled
                  aria-label="Notifications"
                  title="Coming soon"
                  className="size-10 rounded-xl text-slate-500"
                />
              }
            >
              <Bell className="size-5" aria-hidden />
            </TooltipTrigger>
            <TooltipContent side="right">Notifications</TooltipContent>
          </Tooltip>
        </nav>

        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                to={settingsNavItem.to}
                aria-label={settingsNavItem.label}
                aria-current={
                  isRailItemActive(pathname, settingsNavItem.to)
                    ? 'page'
                    : undefined
                }
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:outline-none',
                  isRailItemActive(pathname, settingsNavItem.to) &&
                    'bg-blue-50 text-blue-600',
                )}
              />
            }
          >
            <Settings className="size-5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

export function StudentSidebar({
  pathname,
  onNavigate,
  compact = false,
}: StudentSidebarProps) {
  if (compact) {
    return <StudentNavigationRail pathname={pathname} />
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
