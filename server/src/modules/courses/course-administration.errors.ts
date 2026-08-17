import {
  BadRequestException,
  ConflictException,
  type HttpException,
  NotFoundException,
} from '@nestjs/common'

export const COURSE_ADMINISTRATION_ERROR_CODES = {
  COURSE_NOT_FOUND: 'COURSE_NOT_FOUND',
  COURSE_CODE_ALREADY_EXISTS: 'COURSE_CODE_ALREADY_EXISTS',
  USER_NOT_FOUND: 'COURSE_USER_NOT_FOUND',
  MEMBER_ALREADY_EXISTS: 'COURSE_MEMBER_ALREADY_EXISTS',
  MEMBER_NOT_FOUND: 'COURSE_MEMBER_NOT_FOUND',
  INVALID_REQUEST: 'COURSE_INVALID_REQUEST',
} as const

export type CourseAdministrationErrorCode =
  (typeof COURSE_ADMINISTRATION_ERROR_CODES)[keyof typeof COURSE_ADMINISTRATION_ERROR_CODES]

export interface CourseAdministrationValidationIssue {
  field: string
  message: string
}

export class CourseCodeAlreadyExistsError extends Error {
  constructor(readonly code: string) {
    super(`Course code already exists: ${code}`)
  }
}

export class CourseMemberAlreadyExistsError extends Error {
  constructor(
    readonly courseId: string,
    readonly userId: string,
  ) {
    super(`Membership already exists for user ${userId} in course ${courseId}`)
  }
}

export function courseNotFoundException(courseId: string): HttpException {
  return new NotFoundException({
    code: COURSE_ADMINISTRATION_ERROR_CODES.COURSE_NOT_FOUND,
    message: 'Course was not found',
    courseId,
  })
}

export function courseCodeAlreadyExistsException(code: string): HttpException {
  return new ConflictException({
    code: COURSE_ADMINISTRATION_ERROR_CODES.COURSE_CODE_ALREADY_EXISTS,
    message: 'A course with this code already exists',
    courseCode: code,
  })
}

export function courseUserNotFoundException(userId: string): HttpException {
  return new NotFoundException({
    code: COURSE_ADMINISTRATION_ERROR_CODES.USER_NOT_FOUND,
    message: 'User was not found',
    userId,
  })
}

export function courseMemberAlreadyExistsException(
  courseId: string,
  userId: string,
): HttpException {
  return new ConflictException({
    code: COURSE_ADMINISTRATION_ERROR_CODES.MEMBER_ALREADY_EXISTS,
    message: 'User is already a member of this course',
    courseId,
    userId,
  })
}

export function courseMemberNotFoundException(
  courseId: string,
  userId: string,
): HttpException {
  return new NotFoundException({
    code: COURSE_ADMINISTRATION_ERROR_CODES.MEMBER_NOT_FOUND,
    message: 'Course membership was not found',
    courseId,
    userId,
  })
}

export function invalidCourseAdministrationRequestException(
  errors: CourseAdministrationValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: COURSE_ADMINISTRATION_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid course administration request',
    errors,
  })
}
