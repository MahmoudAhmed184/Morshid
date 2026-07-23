import { Outlet, useRouterState } from '@tanstack/react-router'
import {
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Settings2,
} from 'lucide-react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import type { AppSidebarNavItem } from '@/components/layout/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
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
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar
        role="instructor"
        navigation={navItems}
        ariaLabel="Instructor navigation"
      />
      <SidebarInset className="scrollbar-themed min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-8">
          <InstructorOutlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
