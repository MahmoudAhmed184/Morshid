import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  BookOpenIcon,
  ClipboardListIcon,
  FileTextIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import type { AppSidebarNavItem } from '@/components/layout/app-sidebar'
import { Logo } from '@/components/logo'
import { getUserInitials } from '@/components/layout/dashboard-header'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { useAuthStore } from '@/features/auth/stores/auth.store'

const navItems: readonly AppSidebarNavItem[] = [
  {
    label: 'Dashboard',
    to: '/admin',
    icon: LayoutDashboardIcon,
    exact: true,
  },
  {
    label: 'Assignments',
    to: '/admin/assignments',
    icon: ClipboardListIcon,
  },
  {
    label: 'Users',
    to: '/admin/users',
    icon: UsersIcon,
  },
  {
    label: 'Courses',
    to: '/admin/courses',
    icon: BookOpenIcon,
  },
  {
    label: 'Materials',
    to: '/admin/materials',
    icon: FileTextIcon,
  },
  {
    label: 'Audit Logs',
    to: '/admin/audit',
    icon: HistoryIcon,
  },
]

const settingsNavItem: AppSidebarNavItem = {
  label: 'Settings',
  to: '/admin/settings',
  icon: SettingsIcon,
}

export function AdminPageShell() {
  const currentUser = useAuthStore((state) => state.user)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <div className="h-svh overflow-hidden bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <AppSidebar
          navigation={navItems}
          settings={settingsNavItem}
          pathname={pathname}
          ariaLabel="Admin navigation"
          header={
            <div className="px-6 py-8">
              <div className="flex items-center gap-3">
                <Logo />
                <div>
                  <p className="font-display text-2xl font-semibold tracking-tight text-sidebar-foreground">
                    Morshid Admin
                  </p>
                  <p className="mt-0.5 text-[0.7rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    Higher Ed AI Portal
                  </p>
                </div>
              </div>
            </div>
          }
          navigationClassName="flex-1 space-y-2 px-6"
          itemClassName="flex h-12 w-full items-center gap-4 rounded-lg px-4 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeItemClassName="bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-ring/20"
          settingsContainerClassName="border-t border-sidebar-border px-6 py-4"
          footer={
            currentUser ? (
              <div className="border-t border-sidebar-border p-6">
                <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                    {getUserInitials(currentUser.displayName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-sidebar-foreground">
                      {currentUser.displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {currentUser.email}
                    </p>
                  </div>
                </div>
              </div>
            ) : null
          }
        />
      </aside>

      <div className="h-full overflow-y-auto lg:pl-72">
        <header className="surface-glass sticky top-0 z-30 border-b border-border">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10">
            <p className="text-sm font-medium text-muted-foreground">
              Administrator console
            </p>
            <ModeToggle />
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] px-4 pt-8 pb-32 sm:px-6 lg:px-10 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-sidebar-border bg-sidebar/95 p-2 backdrop-blur lg:hidden"
        aria-label="Admin mobile navigation"
      >
        {[...navItems, settingsNavItem].map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{
                className: 'bg-sidebar-accent text-sidebar-accent-foreground',
              }}
              className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[0.7rem] text-sidebar-foreground/70"
            >
              <Icon className="size-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
