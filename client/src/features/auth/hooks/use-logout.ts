import { useNavigate } from '@tanstack/react-router'

import { logoutApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/stores/auth.store'

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
      clearSession()
      await navigate({ to: '/login' })
    }
  }
}
