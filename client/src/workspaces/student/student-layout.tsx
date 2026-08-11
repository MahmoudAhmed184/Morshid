import { useHydrated } from '@tanstack/react-router'

import { SidebarProvider } from '@/components/ui/sidebar'
import { AuthLoader } from '@/features/auth/routing/auth-loader'
import { StudentChromeProvider } from '@/features/student/components/student-chrome-context'
import { StudentCourseProvider } from '@/features/student/components/student-course-context'
import { StudentAppSidebar } from '@/features/student/components/student-app-sidebar'
import { StudentSearchPalette } from '@/features/student/components/student-search-palette'
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
          <StudentAppSidebar />
          <StudentShell />
          <StudentSearchPalette />
        </StudentCourseProvider>
      </StudentChromeProvider>
    </SidebarProvider>
  )
}
