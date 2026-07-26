import { AuthLoader } from '@/features/auth/components/auth-loader'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { InstructorLayout } from '@/features/instructor/components/instructor-layout'

/**
 * Initial auth/session resolution → full-page AuthLoader.
 * In-dashboard navigations with an existing instructor session → keep AppShell.
 */
export function InstructorRoutePending() {
  const hasInstructorSession = useAuthStore(
    (state) => state.isAuthenticated && state.user?.role === 'INSTRUCTOR',
  )

  if (!hasInstructorSession) {
    return <AuthLoader />
  }

  return <InstructorLayout />
}
