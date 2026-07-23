import { Outlet, useRouterState } from '@tanstack/react-router'
import {
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Settings2,
} from 'lucide-react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import type { AppSidebarNavItem } from '@/components/layout/app-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { InstructorShellContentFallback } from '@/features/instructor/components/instructor-shell-content-fallback'

const instructorLayoutRouteId = '/instructor'

const navItems: readonly AppSidebarNavItem[] = [
  { icon: LayoutDashboard, to: '/instructor', label: 'Dashboard', exact: true },
  {
    icon: ClipboardCheck,
    to: '/instructor/review-queue',
    label: 'Review Queue',
  },
  { icon: FileText, to: '/instructor/materials', label: 'Materials' },
  { icon: Settings2, to: '/instructor/settings', label: 'Settings' },
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

function InstructorBreadcrumb({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="smallcaps-label flex min-w-0 items-center gap-2"
    >
      <span>Instructor</span>
      <span aria-hidden>·</span>
      <span className="truncate text-foreground">
        {activeSectionLabel(pathname)}
      </span>
    </nav>
  )
}

function InstructorOutlet() {
  const hasChildMatch = useRouterState({
    select: (state) =>
      state.matches.some((match) => match.routeId !== instructorLayoutRouteId),
  })

  if (!hasChildMatch) {
    return <InstructorShellContentFallback />
  }

  return <Outlet />
}

export function InstructorLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar
        role="instructor"
        navigation={navItems}
        ariaLabel="Instructor navigation"
      />
      <SidebarInset className="scrollbar-themed min-h-0 overflow-y-auto">
        <DashboardHeader
          className="sticky top-3 z-40 mx-3 mt-3"
          leading={<SidebarTrigger className="md:hidden" />}
          breadcrumb={<InstructorBreadcrumb pathname={pathname} />}
        />

        <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-8">
          <InstructorOutlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
