import { Outlet, useRouterState } from '@tanstack/react-router'
import {
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Menu,
  Settings2,
} from 'lucide-react'
import { useState } from 'react'

import type { AppSidebarNavItem } from '@/components/layout/app-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { StudioSidebar } from '@/components/layout/studio-sidebar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/features/auth/stores/auth.store'
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
  const user = useAuthStore((state) => state.user)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const sidebarUser = {
    displayName: user?.displayName,
    roleLabel: 'Instructor',
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar — inset floating panel */}
      <aside className="hidden shrink-0 md:block">
        <div className="m-3 h-[calc(100svh-1.5rem)] w-64 overflow-hidden rounded-2xl border bg-sidebar text-sidebar-foreground shadow-sm">
          <StudioSidebar
            navigation={navItems}
            roleChip="INSTRUCTOR"
            ariaLabel="Instructor navigation"
            pathname={pathname}
            user={sidebarUser}
          />
        </div>
      </aside>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-72 max-w-[85vw] gap-0 rounded-r-3xl border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Instructor navigation</SheetTitle>
          </SheetHeader>
          <StudioSidebar
            navigation={navItems}
            roleChip="INSTRUCTOR"
            ariaLabel="Instructor navigation"
            pathname={pathname}
            user={sidebarUser}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto scrollbar-themed">
        <DashboardHeader
          className="sticky top-3 z-40 mx-3 mt-3"
          leading={
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="size-5" aria-hidden />
            </Button>
          }
          breadcrumb={<InstructorBreadcrumb pathname={pathname} />}
        />

        <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-8">
          <InstructorOutlet />
        </div>
      </div>
    </div>
  )
}
