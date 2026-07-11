import type { AuthRole } from '@/features/auth/types/auth.types'
import { loadAuthenticatedUser } from '@/features/auth/utils/auth-loader'

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

// Client RBAC is UX gating only. Server APIs must still enforce authorization.
export async function requireAuth(): Promise<AuthRouteRedirectPath | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const user = await loadAuthenticatedUser()

  return user ? null : '/login'
}

// Client RBAC is UX gating only. Server APIs must still enforce authorization.
export async function requireRole(
  expectedRole: AuthRole,
): Promise<AuthRouteRedirectPath | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const user = await loadAuthenticatedUser()

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

  const user = await loadAuthenticatedUser()

  return user ? getDashboardPath(user.role) : null
}
