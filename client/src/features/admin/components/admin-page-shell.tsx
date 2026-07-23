import { Outlet, useRouterState } from '@tanstack/react-router'
import {
  BookOpenIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import type { AppSidebarNavItem } from '@/components/layout/app-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

const navItems: readonly AppSidebarNavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboardIcon, exact: true },
  { label: 'Assignments', to: '/admin/assignments', icon: ClipboardCheckIcon },
  { label: 'Users', to: '/admin/users', icon: UsersIcon },
  { label: 'Courses', to: '/admin/courses', icon: BookOpenIcon },
  { label: 'Materials', to: '/admin/materials', icon: FileTextIcon },
  { label: 'Audit Logs', to: '/admin/audit', icon: ScrollTextIcon },
  { label: 'Settings', to: '/admin/settings', icon: SettingsIcon },
]

function activeSectionLabel(pathname: string) {
  const match = [...navItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) =>
      item.exact
        ? pathname === item.to || pathname === `${item.to}/`
        : pathname === item.to || pathname.startsWith(`${item.to}/`),
    )

  return match?.label ?? 'Dashboard'
}

function AdminBreadcrumb({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="smallcaps-label flex min-w-0 items-center gap-2"
    >
      <span>Admin</span>
      <span aria-hidden>·</span>
      <span className="truncate text-foreground">
        {activeSectionLabel(pathname)}
      </span>
    </nav>
  )
}

export function AdminPageShell() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar
        role="admin"
        navigation={navItems}
        ariaLabel="Admin navigation"
      />
      <SidebarInset className="scrollbar-themed min-h-0 overflow-y-auto">
        <DashboardHeader
          className="sticky top-3 z-40 mx-3 mt-3"
          leading={<SidebarTrigger className="md:hidden" />}
          breadcrumb={<AdminBreadcrumb pathname={pathname} />}
        />

        <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
