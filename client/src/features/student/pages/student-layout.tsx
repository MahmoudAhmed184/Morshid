import { useHydrated } from '@tanstack/react-router'

import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AuthLoader } from '@/features/auth/components/auth-loader'
import { StudentChromeProvider } from '@/features/student/components/student-chrome-context'
import { StudentShell } from '@/features/student/components/student-shell'

export function StudentLayout() {
  const isHydrated = useHydrated()

  if (!isHydrated) {
    return <AuthLoader />
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <StudentChromeProvider>
        <AppSidebar role="student" />
        <StudentShell />
      </StudentChromeProvider>
    </SidebarProvider>
  )
}
