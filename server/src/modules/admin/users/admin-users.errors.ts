import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type HttpException,
  NotFoundException,
} from '@nestjs/common'

export const ADMIN_USERS_ERROR_CODES = {
  DUPLICATE_EMAIL: 'ADMIN_USERS_DUPLICATE_EMAIL',
  CANNOT_DISABLE_LAST_ACTIVE_ADMIN:
    'ADMIN_USERS_CANNOT_DISABLE_LAST_ACTIVE_ADMIN',
  CANNOT_DISABLE_SELF: 'ADMIN_USERS_CANNOT_DISABLE_SELF',
  INVALID_CREATE_REQUEST: 'ADMIN_USERS_INVALID_CREATE_REQUEST',
  INVALID_RESET_PASSWORD_REQUEST: 'ADMIN_USERS_INVALID_RESET_PASSWORD_REQUEST',
  USER_NOT_FOUND: 'ADMIN_USERS_USER_NOT_FOUND',
} as const

export type AdminUsersErrorCode =
  (typeof ADMIN_USERS_ERROR_CODES)[keyof typeof ADMIN_USERS_ERROR_CODES]

export interface AdminUsersValidationIssue {
  field: string
  message: string
}

export class AdminUserEmailAlreadyExistsError extends Error {
  constructor(readonly email: string) {
    super(`User email already exists: ${email}`)
  }
}

export class CannotDisableLastActiveAdminError extends Error {}

export function duplicateAdminUserEmailException(email: string): HttpException {
  return new ConflictException({
    code: ADMIN_USERS_ERROR_CODES.DUPLICATE_EMAIL,
    message: 'A user with this email already exists',
    email,
  })
}

export function adminUserNotFoundException(userId: string): HttpException {
  return new NotFoundException({
    code: ADMIN_USERS_ERROR_CODES.USER_NOT_FOUND,
    message: 'Admin user target was not found',
    userId,
  })
}

export function cannotDisableSelfException(): HttpException {
  return new ForbiddenException({
    code: ADMIN_USERS_ERROR_CODES.CANNOT_DISABLE_SELF,
    message: 'Administrators cannot disable their own account',
  })
}

export function cannotDisableLastActiveAdminException(): HttpException {
  return new ConflictException({
    code: ADMIN_USERS_ERROR_CODES.CANNOT_DISABLE_LAST_ACTIVE_ADMIN,
    message: 'Cannot disable the last active admin account',
  })
}

export function invalidAdminCreateUserRequestException(
  errors: AdminUsersValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: ADMIN_USERS_ERROR_CODES.INVALID_CREATE_REQUEST,
    message: 'Invalid admin user create request',
    errors,
  })
}

export function invalidAdminResetUserPasswordRequestException(
  errors: AdminUsersValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: ADMIN_USERS_ERROR_CODES.INVALID_RESET_PASSWORD_REQUEST,
    message: 'Invalid admin user password reset request',
    errors,
  })
}
