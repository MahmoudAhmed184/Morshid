import { Outlet, useHydrated } from '@tanstack/react-router'

import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AuthLoader } from '@/features/auth/components/auth-loader'

export function StudentLayout() {
  const isHydrated = useHydrated()

  if (!isHydrated) {
    return <AuthLoader />
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar role="student" />
      <SidebarInset className="min-h-0 overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
