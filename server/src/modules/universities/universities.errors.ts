import {
  BadRequestException,
  ConflictException,
  type HttpException,
  NotFoundException,
} from '@nestjs/common'

export const UNIVERSITIES_ERROR_CODES = {
  UNIVERSITY_NOT_FOUND: 'UNIVERSITY_NOT_FOUND',
  UNIVERSITY_CODE_ALREADY_EXISTS: 'UNIVERSITY_CODE_ALREADY_EXISTS',
  OWNER_EMAIL_ALREADY_EXISTS: 'UNIVERSITY_OWNER_EMAIL_ALREADY_EXISTS',
  INVALID_REQUEST: 'UNIVERSITY_INVALID_REQUEST',
} as const

export type UniversitiesErrorCode =
  (typeof UNIVERSITIES_ERROR_CODES)[keyof typeof UNIVERSITIES_ERROR_CODES]

export interface UniversitiesValidationIssue {
  field: string
  message: string
}

export class UniversityNotFoundError extends Error {
  constructor(readonly universityId: string) {
    super(`University was not found: ${universityId}`)
  }
}

export class UniversityCodeAlreadyExistsError extends Error {
  constructor(readonly code: string) {
    super(`University code already exists: ${code}`)
  }
}

export class UniversityOwnerEmailAlreadyExistsError extends Error {
  constructor(readonly email: string) {
    super(`User email already exists: ${email}`)
  }
}

export function universityNotFoundException(
  universityId: string,
): HttpException {
  return new NotFoundException({
    code: UNIVERSITIES_ERROR_CODES.UNIVERSITY_NOT_FOUND,
    message: 'University was not found',
    universityId,
  })
}

export function universityCodeAlreadyExistsException(
  code: string,
): HttpException {
  return new ConflictException({
    code: UNIVERSITIES_ERROR_CODES.UNIVERSITY_CODE_ALREADY_EXISTS,
    message: 'A university with this code already exists',
    universityCode: code,
  })
}

export function universityOwnerEmailAlreadyExistsException(
  email: string,
): HttpException {
  return new ConflictException({
    code: UNIVERSITIES_ERROR_CODES.OWNER_EMAIL_ALREADY_EXISTS,
    message: 'A user with this email already exists',
    email,
  })
}

export function invalidUniversitiesRequestException(
  errors: UniversitiesValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: UNIVERSITIES_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid university administration request',
    errors,
  })
}
