import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common'

import { AUTH_ERROR_CODES } from './auth.dto'

export function invalidCredentialsException() {
  return new UnauthorizedException({
    code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    message: 'Invalid email or password',
  })
}

export function invalidAccessTokenException() {
  return new UnauthorizedException({
    code: AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN,
    message: 'Invalid access token',
  })
}

export function invalidRefreshTokenException() {
  return new UnauthorizedException({
    code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
    message: 'Invalid refresh token',
  })
}

export function accountDisabledException() {
  return new ForbiddenException({
    code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
    message: 'Account is disabled',
  })
}

export function invalidAuthRequestException() {
  return new BadRequestException({
    code: AUTH_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid auth request',
  })
}

export function insufficientRoleException() {
  return new ForbiddenException({
    code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
    message: 'Insufficient role',
  })
}
