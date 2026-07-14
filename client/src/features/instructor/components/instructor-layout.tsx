import { Outlet, useRouterState } from '@tanstack/react-router'
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
} from 'lucide-react'
import { useState } from 'react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import type { AppSidebarNavItem } from '@/components/layout/app-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/features/auth/stores/auth.store'

const navItems: readonly AppSidebarNavItem[] = [
  { icon: LayoutDashboard, to: '/instructor', label: 'Dashboard', exact: true },
  { icon: BookOpen, to: '/instructor/courses', label: 'My Courses' },
  {
    icon: ClipboardList,
    to: '/instructor/review-queue',
    label: 'Review Queue',
  },
  { icon: BookOpen, to: '/instructor/students', label: 'Students' },
  { icon: FileText, to: '/instructor/materials', label: 'Materials' },
  { icon: Bell, to: '/instructor/notifications', label: 'Notifications' },
  { icon: BarChart3, to: '/instructor/analytics', label: 'Analytics' },
]

const settingsNavItem: AppSidebarNavItem = {
  icon: Settings,
  to: '/instructor/settings',
  label: 'Settings',
}

function InstructorSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <AppSidebar
      navigation={navItems}
      settings={settingsNavItem}
      pathname={pathname}
      ariaLabel="Instructor navigation"
      onNavigate={onNavigate}
      className="bg-card text-card-foreground"
      header={
        <div className="flex min-h-16 items-center gap-3 border-b border-border px-4 md:min-h-20">
          <Logo
            className="size-8 rounded-[6px] bg-primary text-primary-foreground"
            iconClassName="size-4"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Morshid</p>
            <p className="truncate text-[0.68rem] text-muted-foreground">
              Instructor Portal
            </p>
          </div>
        </div>
      }
      navigationClassName="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3"
      itemClassName="flex h-9 w-full items-center gap-2 rounded-[6px] border-l-2 border-transparent px-3 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      activeItemClassName="border-primary bg-primary text-primary-foreground"
      settingsContainerClassName="border-t border-border px-3 py-4"
    />
  )
}

export function InstructorLayout() {
  const user = useAuthStore((state) => state.user)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <main className="h-svh overflow-hidden bg-background text-foreground">
      <div className="h-full md:grid md:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Mobile sidebar */}
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-4 top-4 z-40 md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="border-b border-border px-4 py-3">
                <SheetTitle className="text-sm font-semibold text-foreground">
                  Menu
                </SheetTitle>
              </SheetHeader>
              <InstructorSidebar onNavigate={() => setMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-svh border-r border-border md:block">
          <InstructorSidebar />
        </aside>

        <div className="min-w-0 overflow-y-auto bg-background">
          <div className="sticky top-0 z-20">
            <DashboardHeader
              displayName={user?.displayName}
              email={user?.email}
              searchLabel="Search course workspace"
              searchPlaceholder="Search course, materials, or reviews..."
            />
          </div>

          <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6">
            <Outlet />
          </div>
        </div>
      </div>
    </main>
  )
}
