import { Link, Outlet, linkOptions } from '@tanstack/react-router'
import {
  BookOpenIcon,
  ClipboardListIcon,
  FileTextIcon,
  GraduationCapIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  UsersIcon,
} from 'lucide-react'

import { ModeToggle } from '@/components/ui/mode-toggle'

const navItems = linkOptions([
  {
    label: 'Dashboard',
    to: '/admin',
    icon: LayoutDashboardIcon,
    activeOptions: { exact: true },
  },
  {
    label: 'Assignments',
    to: '/admin/assignments',
    icon: ClipboardListIcon,
    activeOptions: { exact: false },
  },
  {
    label: 'Users',
    to: '/admin/users',
    icon: UsersIcon,
    activeOptions: { exact: false },
  },
  {
    label: 'Courses',
    to: '/admin/courses',
    icon: BookOpenIcon,
    activeOptions: { exact: false },
  },
  {
    label: 'Materials',
    to: '/admin/materials',
    icon: FileTextIcon,
    activeOptions: { exact: false },
  },
  {
    label: 'Audit Logs',
    to: '/admin/audit',
    icon: HistoryIcon,
    activeOptions: { exact: false },
  },
] as const)

export function AdminPageShell() {
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
            const Icon = item.icon

            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={item.activeOptions}
                activeProps={{
                  className:
                    'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-ring/20',
                }}
                className="flex h-12 items-center gap-4 rounded-lg px-4 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
          <div className="flex h-16 items-center justify-end px-4 sm:px-6 lg:px-10">
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
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={item.activeOptions}
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
