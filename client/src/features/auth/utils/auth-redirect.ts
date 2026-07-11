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

export function getDashboardPath(role: AuthRole): AuthRedirectPath {
  return authRedirectByRole[role]
}

export const getAuthRedirectPath = getDashboardPath

async function validateCurrentUser() {
  if (typeof window === 'undefined') {
    return null
  }

  const { clearSession, isAuthenticated, setUser, user } =
    useAuthStore.getState()

  if (!isAuthenticated || !user) {
    return null
  }

  try {
    const response = await getCurrentUser()
    setUser(response.user)

    return response.user
  } catch {
    clearSession()
    return null
  }
}

// Client RBAC is UX gating only. Server APIs must still enforce authorization.
export async function requireAuth(): Promise<AuthRouteRedirectPath | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const user = await validateCurrentUser()

  return user ? null : '/login'
}

// Client RBAC is UX gating only. Server APIs must still enforce authorization.
export async function requireRole(
  expectedRole: AuthRole,
): Promise<AuthRouteRedirectPath | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const user = await validateCurrentUser()

  if (!user) {
    return '/login'
  }

  if (user.role !== expectedRole) {
    return getDashboardPath(user.role)
  }

  return null
}

export async function redirectAuthenticatedToDashboard(): Promise<AuthRedirectPath | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const user = await validateCurrentUser()

  return user ? getDashboardPath(user.role) : null
}

export const getProtectedRoleRedirectPath = requireRole
