import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type HttpException,
  NotFoundException,
} from '@nestjs/common'

export const USER_ADMINISTRATION_ERROR_CODES = {
  DUPLICATE_EMAIL: 'USER_ADMINISTRATION_DUPLICATE_EMAIL',
  CANNOT_DISABLE_LAST_ACTIVE_ADMIN:
    'USER_ADMINISTRATION_CANNOT_DISABLE_LAST_ACTIVE_ADMIN',
  CANNOT_DISABLE_UNIVERSITY_OWNER:
    'USER_ADMINISTRATION_CANNOT_DISABLE_UNIVERSITY_OWNER',
  CANNOT_DISABLE_SELF: 'USER_ADMINISTRATION_CANNOT_DISABLE_SELF',
  CANNOT_CHANGE_ADMIN_ROLE: 'USER_ADMINISTRATION_CANNOT_CHANGE_ADMIN_ROLE',
  ROLE_CHANGE_HAS_MEMBERSHIPS:
    'USER_ADMINISTRATION_ROLE_CHANGE_HAS_ACTIVE_MEMBERSHIPS',
  INVALID_CREATE_REQUEST: 'USER_ADMINISTRATION_INVALID_CREATE_REQUEST',
  INVALID_LIST_REQUEST: 'USER_ADMINISTRATION_INVALID_LIST_REQUEST',
  INVALID_UPDATE_REQUEST: 'USER_ADMINISTRATION_INVALID_UPDATE_REQUEST',
  INVALID_RESET_PASSWORD_REQUEST:
    'USER_ADMINISTRATION_INVALID_RESET_PASSWORD_REQUEST',
  USER_NOT_FOUND: 'USER_ADMINISTRATION_USER_NOT_FOUND',
} as const

export type UserAdministrationErrorCode =
  (typeof USER_ADMINISTRATION_ERROR_CODES)[keyof typeof USER_ADMINISTRATION_ERROR_CODES]

export interface UserAdministrationValidationIssue {
  field: string
  message: string
}

export class ManagedUserEmailAlreadyExistsError extends Error {
  constructor(readonly email: string) {
    super(`User email already exists: ${email}`)
  }
}

export class CannotDisableLastActiveAdminError extends Error {}

export class CannotDisableUniversityOwnerError extends Error {}

export class ManagedUserNotFoundError extends Error {
  constructor(readonly userId: string) {
    super(`User not found: ${userId}`)
  }
}

export class ManagedUserRoleChangeHasMembershipsError extends Error {
  constructor(readonly userId: string) {
    super(`User ${userId} has active course memberships`)
  }
}

export function duplicateManagedUserEmailException(
  email: string,
): HttpException {
  return new ConflictException({
    code: USER_ADMINISTRATION_ERROR_CODES.DUPLICATE_EMAIL,
    message: 'A user with this email already exists',
    email,
  })
}

export function managedUserNotFoundException(userId: string): HttpException {
  return new NotFoundException({
    code: USER_ADMINISTRATION_ERROR_CODES.USER_NOT_FOUND,
    message: 'User target was not found',
    userId,
  })
}

export function cannotDisableSelfException(): HttpException {
  return new ForbiddenException({
    code: USER_ADMINISTRATION_ERROR_CODES.CANNOT_DISABLE_SELF,
    message: 'Administrators cannot disable their own account',
  })
}

export function cannotChangeAdminRoleException(): HttpException {
  return new ForbiddenException({
    code: USER_ADMINISTRATION_ERROR_CODES.CANNOT_CHANGE_ADMIN_ROLE,
    message: 'Administrator account roles cannot be changed',
  })
}

export function managedUserRoleChangeHasMembershipsException(
  userId: string,
): HttpException {
  return new ConflictException({
    code: USER_ADMINISTRATION_ERROR_CODES.ROLE_CHANGE_HAS_MEMBERSHIPS,
    message:
      'Remove active course memberships before changing the account role',
    userId,
  })
}

export function cannotDisableLastActiveAdminException(): HttpException {
  return new ConflictException({
    code: USER_ADMINISTRATION_ERROR_CODES.CANNOT_DISABLE_LAST_ACTIVE_ADMIN,
    message: 'Cannot disable the last active admin account',
  })
}

export function cannotDisableUniversityOwnerException(): HttpException {
  return new ConflictException({
    code: USER_ADMINISTRATION_ERROR_CODES.CANNOT_DISABLE_UNIVERSITY_OWNER,
    message:
      'Cannot disable the primary owner of a university. Transfer ownership first.',
  })
}

export function invalidCreateUserRequestException(
  errors: UserAdministrationValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: USER_ADMINISTRATION_ERROR_CODES.INVALID_CREATE_REQUEST,
    message: 'Invalid user create request',
    errors,
  })
}

export function invalidListUsersRequestException(
  errors: UserAdministrationValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: USER_ADMINISTRATION_ERROR_CODES.INVALID_LIST_REQUEST,
    message: 'Invalid user list request',
    errors,
  })
}

export function invalidUpdateUserRequestException(
  errors: UserAdministrationValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: USER_ADMINISTRATION_ERROR_CODES.INVALID_UPDATE_REQUEST,
    message: 'Invalid user update request',
    errors,
  })
}

export function invalidResetUserPasswordRequestException(
  errors: UserAdministrationValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: USER_ADMINISTRATION_ERROR_CODES.INVALID_RESET_PASSWORD_REQUEST,
    message: 'Invalid user password reset request',
    errors,
  })
}
