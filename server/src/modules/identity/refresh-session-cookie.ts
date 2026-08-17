import type { Request, Response } from 'express'

import { invalidRefreshTokenException } from './identity.errors'

export const REFRESH_TOKEN_COOKIE_NAME = 'morshid_refresh'

export function setRefreshTokenCookie(
  response: Response,
  refreshToken: string,
  expiresAt: string,
) {
  response.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    expires: new Date(expiresAt),
    httpOnly: true,
    path: '/api/v1/auth',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

export function clearRefreshTokenCookie(response: Response) {
  response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    path: '/api/v1/auth',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

export function getRefreshToken(request: Request) {
  const cookieHeader = request.get('cookie')
  const refreshCookiePrefix = `${REFRESH_TOKEN_COOKIE_NAME}=`
  const refreshCookie = cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(refreshCookiePrefix))
  const encodedRefreshToken = refreshCookie?.slice(refreshCookiePrefix.length)

  if (encodedRefreshToken === undefined || encodedRefreshToken === '') {
    throw invalidRefreshTokenException()
  }

  try {
    return decodeURIComponent(encodedRefreshToken)
  } catch {
    throw invalidRefreshTokenException()
  }
}

export function tryGetRefreshToken(request: Request): string | null {
  try {
    return getRefreshToken(request)
  } catch {
    return null
  }
}
