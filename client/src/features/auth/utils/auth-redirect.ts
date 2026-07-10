import type { AuthRole } from '@/features/auth/types/auth.types'
import { useAuthStore } from '@/features/auth/stores/auth.store'

const authRedirectByRole = {
  admin: '/admin',
  instructor: '/instructor',
  student: '/student',
} as const satisfies Record<AuthRole, string>

export type AuthRedirectPath = (typeof authRedirectByRole)[AuthRole]
export type AuthRouteRedirectPath = AuthRedirectPath | '/login'

export function getAuthRedirectPath(role: AuthRole): AuthRedirectPath {
  return authRedirectByRole[role]
}

export function getProtectedRoleRedirectPath(
  expectedRole: AuthRole,
): AuthRouteRedirectPath | null {
  if (typeof window === 'undefined') {
    return null
  }

  const { isAuthenticated, user } = useAuthStore.getState()

  if (!isAuthenticated || !user) {
    return '/login'
  }

  if (user.role !== expectedRole) {
    return getAuthRedirectPath(user.role)
  }

  return null
}
