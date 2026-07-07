export const AUTH_MODULE_NAME = 'auth'
export const AUTH_REFRESH_COOKIE_NAME = 'morshid_refresh'

export const AUTH_TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const

export type AuthTokenType =
  (typeof AUTH_TOKEN_TYPES)[keyof typeof AUTH_TOKEN_TYPES]
