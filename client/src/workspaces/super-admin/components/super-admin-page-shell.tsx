import { Outlet } from '@tanstack/react-router'
import { LayoutDashboard, Landmark, Settings } from 'lucide-react'

import { AuthenticatedSidebar } from '@/workspaces/_shared/authenticated-sidebar/authenticated-sidebar'
import type { AuthenticatedSidebarNavItem } from '@/workspaces/_shared/authenticated-sidebar/authenticated-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

const navItems: readonly AuthenticatedSidebarNavItem[] = [
  {
    label: 'Overview',
    to: '/super-admin',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: 'Universities',
    to: '/super-admin/universities',
    icon: Landmark,
  },
  {
    label: 'Settings',
    to: '/super-admin/settings',
    icon: Settings,
  },
]

export function SuperAdminPageShell() {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AuthenticatedSidebar
        role="super-admin"
        navigation={navItems}
        ariaLabel="Super Admin navigation"
      />
      <SidebarInset className="scrollbar-themed min-h-0 overflow-y-auto">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold text-foreground">
            Morshid Super Admin
          </span>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 md:px-8 sm:py-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
