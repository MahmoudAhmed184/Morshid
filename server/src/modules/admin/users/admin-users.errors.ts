import {
  BadRequestException,
  ConflictException,
  type HttpException,
} from '@nestjs/common'

export const ADMIN_USERS_ERROR_CODES = {
  DUPLICATE_EMAIL: 'ADMIN_USERS_DUPLICATE_EMAIL',
  INVALID_CREATE_REQUEST: 'ADMIN_USERS_INVALID_CREATE_REQUEST',
  UNSUPPORTED_ROLE: 'ADMIN_USERS_UNSUPPORTED_ROLE',
} as const

export type AdminUsersErrorCode =
  (typeof ADMIN_USERS_ERROR_CODES)[keyof typeof ADMIN_USERS_ERROR_CODES]

export class AdminUserEmailAlreadyExistsError extends Error {
  constructor(readonly email: string) {
    super(`User email already exists: ${email}`)
  }
}

export function duplicateAdminUserEmailException(email: string): HttpException {
  return new ConflictException({
    code: ADMIN_USERS_ERROR_CODES.DUPLICATE_EMAIL,
    message: 'A user with this email already exists',
    email,
  })
}

export function invalidAdminCreateUserRequestException(): HttpException {
  return new BadRequestException({
    code: ADMIN_USERS_ERROR_CODES.INVALID_CREATE_REQUEST,
    message: 'Invalid admin user create request',
  })
}

export function unsupportedAdminCreateUserRoleException(): HttpException {
  return new BadRequestException({
    code: ADMIN_USERS_ERROR_CODES.UNSUPPORTED_ROLE,
    message: 'Admin users can only create STUDENT or INSTRUCTOR accounts',
  })
}
