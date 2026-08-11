import { useHydrated } from '@tanstack/react-router'

import { SidebarProvider } from '@/components/ui/sidebar'
import { AuthLoader } from '@/features/auth/routing/auth-loader'
import { StudentChromeProvider } from '@/workspaces/student/navigation/student-chrome-context'
import { StudentCourseProvider } from '@/workspaces/student/navigation/student-course-context'
import { StudentSidebar } from '@/workspaces/student/navigation/student-sidebar'
import { StudentSearchPalette } from '@/workspaces/student/navigation/student-search-palette'
import { StudentShell } from '@/workspaces/student/components/student-shell'

export function StudentLayout() {
  const isHydrated = useHydrated()

  if (!isHydrated) {
    return <AuthLoader />
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <StudentChromeProvider>
        <StudentCourseProvider>
          <StudentSidebar />
          <StudentShell />
          <StudentSearchPalette />
        </StudentCourseProvider>
      </StudentChromeProvider>
    </SidebarProvider>
  )
}
