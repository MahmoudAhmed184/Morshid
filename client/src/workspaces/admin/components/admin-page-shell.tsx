import { Outlet } from '@tanstack/react-router'
import {
  BookOpenIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  SettingsIcon,
  GraduationCapIcon,
  StethoscopeIcon,
} from 'lucide-react'

import { AuthenticatedSidebar } from '@/workspaces/_shared/authenticated-sidebar/authenticated-sidebar'
import type { AuthenticatedSidebarNavItem } from '@/workspaces/_shared/authenticated-sidebar/authenticated-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

const navItems: readonly AuthenticatedSidebarNavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboardIcon, exact: true },
  { label: 'Assignments', to: '/admin/assignments', icon: ClipboardCheckIcon },
  { label: 'Students', to: '/admin/users/students', icon: GraduationCapIcon },
  { label: 'Doctors', to: '/admin/users/doctors', icon: StethoscopeIcon },
  { label: 'Courses', to: '/admin/courses', icon: BookOpenIcon },
  { label: 'Materials', to: '/admin/materials', icon: FileTextIcon },
  { label: 'Audit Logs', to: '/admin/audit', icon: ScrollTextIcon },
  { label: 'Settings', to: '/admin/settings', icon: SettingsIcon },
]

export function AdminPageShell() {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AuthenticatedSidebar
        role="admin"
        navigation={navItems}
        ariaLabel="Admin navigation"
      />
      <SidebarInset className="scrollbar-themed min-h-0 overflow-y-auto">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold text-foreground">
            Morshid Admin
          </span>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 md:px-8 sm:py-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
