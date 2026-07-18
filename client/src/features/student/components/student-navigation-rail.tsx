import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'

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

type StudentNavigationRailProps = {
  pathname: string
  navigation: readonly AppSidebarNavItem[]
  settings: AppSidebarNavItem
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

export function StudentNavigationRail({
  pathname,
  navigation,
  settings,
}: StudentNavigationRailProps) {
  const isSettingsActive = isRailItemActive(pathname, settings.to)
  const SettingsIcon = settings.icon

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
          {navigation.map((item) => {
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
                to={settings.to}
                aria-label={settings.label}
                aria-current={isSettingsActive ? 'page' : undefined}
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:outline-none',
                  isSettingsActive && 'bg-blue-50 text-blue-600',
                )}
              />
            }
          >
            <SettingsIcon className="size-5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="right">{settings.label}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
