export type AuthRole = 'admin' | 'instructor' | 'student'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: AuthRole
}

export type LoginApiResponse = {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

export type AuthSession = LoginApiResponse

export type AuthApiErrorCode = 'account_disabled' | 'invalid_credentials'

export type AuthApiError = Error & {
  code: AuthApiErrorCode
}
