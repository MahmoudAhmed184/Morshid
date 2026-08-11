import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

import { logoutApi } from '@/features/auth/session/session.api'
import { useAuthStore } from '@/features/auth/session/session.store'

export function useLogout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const clearSession = useAuthStore((state) => state.clearSession)

  return async function logout() {
    try {
      await logoutApi()
    } catch {
      // Local logout must still complete if the revoke request is unavailable.
    } finally {
      // Clear session before navigating so /login beforeLoad does not bounce an
      // still-authenticated user back to their dashboard.
      clearSession()
      await navigate({ to: '/login', replace: true })
      // Drop cached user-scoped data after leaving protected UI so the next
      // session cannot read it, without thrashing in-flight student queries.
      queryClient.clear()
    }
  }
}
