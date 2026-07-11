import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  BellIcon,
  BookOpenIcon,
  FileTextIcon,
  GraduationCapIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  SearchIcon,
  UsersIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'Dashboard',
    to: '/admin',
    icon: LayoutDashboardIcon,
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
] as const

export function AdminPageShell() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <div className="px-8 py-10">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <GraduationCapIcon className="size-5" />
            </div>
            <div>
              <p className="font-serif text-3xl font-semibold tracking-normal text-sidebar-foreground">
                Morshid Admin
              </p>
              <p className="mt-1 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Higher Ed AI Portal
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-6" aria-label="Admin navigation">
          {navItems.map((item) => {
            const isActive =
              item.to === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.to)
            const Icon = item.icon

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex h-12 items-center gap-4 rounded-lg px-4 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive &&
                    'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-ring/20',
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-6">
          <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
              <UsersIcon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-sidebar-foreground">
                Admin User
              </p>
              <p className="text-xs text-muted-foreground">Global Registrar</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-10">
            <div className="relative min-w-0 flex-1 lg:max-w-xl">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search academic data"
                placeholder="Search academic data..."
                className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/15"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Notifications"
            >
              <BellIcon />
            </Button>
            <ModeToggle />
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-10">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-sidebar-border bg-sidebar/95 p-2 backdrop-blur lg:hidden"
        aria-label="Admin mobile navigation"
      >
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon
          const isActive =
            item.to === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.to)

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[0.7rem] text-sidebar-foreground/70',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
              )}
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
