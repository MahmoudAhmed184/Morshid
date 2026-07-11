import type { AuthRole } from '@/features/auth/types/auth.types'
import { getCurrentUser } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/stores/auth.store'

const authRedirectByRole = {
  ADMIN: '/admin',
  INSTRUCTOR: '/instructor',
  STUDENT: '/student',
} as const satisfies Record<AuthRole, string>

export type AuthRedirectPath = (typeof authRedirectByRole)[AuthRole]
export type AuthRouteRedirectPath = AuthRedirectPath | '/login'

export function getAuthRedirectPath(role: AuthRole): AuthRedirectPath {
  return authRedirectByRole[role]
}

export async function getProtectedRoleRedirectPath(
  expectedRole: AuthRole,
): Promise<AuthRouteRedirectPath | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const { clearSession, isAuthenticated, setUser, user } =
    useAuthStore.getState()

  if (!isAuthenticated || !user) {
    return '/login'
  }

  try {
    const response = await getCurrentUser()
    setUser(response.user)

    if (response.user.role !== expectedRole) {
      return getAuthRedirectPath(response.user.role)
    }
  } catch {
    clearSession()
    return '/login'
  }

  return null
}
