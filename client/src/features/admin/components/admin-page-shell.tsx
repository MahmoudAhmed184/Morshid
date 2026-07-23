import { Outlet } from '@tanstack/react-router'
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
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

const navItems: readonly AppSidebarNavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboardIcon, exact: true },
  { label: 'Assignments', to: '/admin/assignments', icon: ClipboardCheckIcon },
  { label: 'Users', to: '/admin/users', icon: UsersIcon },
  { label: 'Courses', to: '/admin/courses', icon: BookOpenIcon },
  { label: 'Materials', to: '/admin/materials', icon: FileTextIcon },
  { label: 'Audit Logs', to: '/admin/audit', icon: ScrollTextIcon },
  { label: 'Settings', to: '/admin/settings', icon: SettingsIcon },
]

export function AdminPageShell() {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar
        role="admin"
        navigation={navItems}
        ariaLabel="Admin navigation"
      />
      <SidebarInset className="scrollbar-themed min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
