import { logoutApi } from '@/features/auth/session/session.api'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { replaceDocument } from '@/lib/browser/document-navigation'

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession)

  return async function logout() {
    try {
      await logoutApi()
    } catch {
      // Local logout must still complete if the revoke request is unavailable.
    } finally {
      // Treat logout as a session boundary so the next account receives a new
      // router and query cache instead of cancelling loaders during SPA teardown.
      clearSession()
      replaceDocument('/login')
    }
  }
}
