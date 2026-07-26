import { useNavigate } from '@tanstack/react-router'

import { logoutApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { getAppQueryClient } from '@/lib/query/query-client'

export function useLogout() {
  const navigate = useNavigate()
  const clearSession = useAuthStore((state) => state.clearSession)

  return async function logout() {
    const refreshToken = useAuthStore.getState().refreshToken

    try {
      if (refreshToken) {
        await logoutApi(refreshToken)
      }
    } catch {
      // Local logout must still complete if the revoke request is unavailable.
    } finally {
      // Clear session before navigating so /login beforeLoad does not bounce an
      // still-authenticated user back to their dashboard.
      clearSession()
      await navigate({ to: '/login', replace: true })
      // Drop cached user-scoped data after leaving protected UI so the next
      // session cannot read it, without thrashing in-flight student queries.
      getAppQueryClient().clear()
    }
  }
}
