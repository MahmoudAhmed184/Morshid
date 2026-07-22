import { Outlet, useHydrated, useRouterState } from '@tanstack/react-router'

import { AuthLoader } from '@/features/auth/components/auth-loader'
import { StudentTopBar } from '@/features/student/components/student-top-bar'

export function StudentShellPage() {
  const isHydrated = useHydrated()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isWorkspace = pathname.startsWith('/student/ai-tutor')

  if (!isHydrated) {
    return <AuthLoader />
  }

  // The workspace (ChatGPT model) paints its own rail, top bar, and sources
  // panel edge-to-edge — the shell simply hosts it.
  if (isWorkspace) {
    return (
      <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
        <Outlet />
      </main>
    )
  }

  // Secondary student pages (The Shelf, Settings) get a slim glass top bar.
  return (
    <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <StudentTopBar pathname={pathname} />
      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </main>
  )
}
