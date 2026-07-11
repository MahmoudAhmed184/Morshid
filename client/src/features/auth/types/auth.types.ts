export type AuthRole = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT'

export type AuthStatus = 'ACTIVE' | 'DISABLED'

export type AuthCourseMembershipRole = 'INSTRUCTOR' | 'STUDENT'

export type AuthCourseSummary = {
  id: string
  code: string
  title: string
  membershipRole: AuthCourseMembershipRole | null
}

export type AuthUser = {
  id: string
  email: string
  displayName: string
  role: AuthRole
  status: AuthStatus
  courses: AuthCourseSummary[]
}

export type LoginApiResponse = {
  tokenType: 'Bearer'
  user: AuthUser
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
}

export type AuthSession = LoginApiResponse

export type MeResponse = {
  user: AuthUser
}

export type AuthApiErrorCode =
  | 'ACCOUNT_DISABLED'
  | 'INSUFFICIENT_ROLE'
  | 'INVALID_ACCESS_TOKEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
  | 'INVALID_REQUEST'

export type AuthApiError = Error & {
  code: AuthApiErrorCode
}
