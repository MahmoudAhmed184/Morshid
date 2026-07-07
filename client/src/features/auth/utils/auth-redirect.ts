import type { AuthRole } from '@/features/auth/types/auth.types'

const authRedirectByRole = {
  admin: '/admin',
  instructor: '/instructor',
  student: '/student',
} as const satisfies Record<AuthRole, string>

export type AuthRedirectPath = (typeof authRedirectByRole)[AuthRole]

export function getAuthRedirectPath(role: AuthRole): AuthRedirectPath {
  return authRedirectByRole[role]
}
