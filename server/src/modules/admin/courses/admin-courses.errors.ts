import {
  BadRequestException,
  ConflictException,
  type HttpException,
  NotFoundException,
} from '@nestjs/common'

export const ADMIN_COURSES_ERROR_CODES = {
  COURSE_NOT_FOUND: 'ADMIN_COURSES_COURSE_NOT_FOUND',
  USER_NOT_FOUND: 'ADMIN_COURSES_USER_NOT_FOUND',
  MEMBER_ALREADY_EXISTS: 'ADMIN_COURSES_MEMBER_ALREADY_EXISTS',
  MEMBER_NOT_FOUND: 'ADMIN_COURSES_MEMBER_NOT_FOUND',
  MATERIAL_NOT_FOUND: 'ADMIN_COURSES_MATERIAL_NOT_FOUND',
  INVALID_REQUEST: 'ADMIN_COURSES_INVALID_REQUEST',
} as const

export type AdminCoursesErrorCode =
  (typeof ADMIN_COURSES_ERROR_CODES)[keyof typeof ADMIN_COURSES_ERROR_CODES]

export interface AdminCoursesValidationIssue {
  field: string
  message: string
}

export class AdminCourseMemberAlreadyExistsError extends Error {
  constructor(
    readonly courseId: string,
    readonly userId: string,
  ) {
    super(`Membership already exists for user ${userId} in course ${courseId}`)
  }
}

export function adminCourseNotFoundException(courseId: string): HttpException {
  return new NotFoundException({
    code: ADMIN_COURSES_ERROR_CODES.COURSE_NOT_FOUND,
    message: 'Course was not found',
    courseId,
  })
}

export function adminCourseUserNotFoundException(
  userId: string,
): HttpException {
  return new NotFoundException({
    code: ADMIN_COURSES_ERROR_CODES.USER_NOT_FOUND,
    message: 'User was not found',
    userId,
  })
}

export function adminCourseMemberAlreadyExistsException(
  courseId: string,
  userId: string,
): HttpException {
  return new ConflictException({
    code: ADMIN_COURSES_ERROR_CODES.MEMBER_ALREADY_EXISTS,
    message: 'User is already a member of this course',
    courseId,
    userId,
  })
}

export function adminCourseMemberNotFoundException(
  courseId: string,
  userId: string,
): HttpException {
  return new NotFoundException({
    code: ADMIN_COURSES_ERROR_CODES.MEMBER_NOT_FOUND,
    message: 'Course membership was not found',
    courseId,
    userId,
  })
}

export function adminCourseMaterialNotFoundException(
  courseId: string,
  materialId: string,
): HttpException {
  return new NotFoundException({
    code: ADMIN_COURSES_ERROR_CODES.MATERIAL_NOT_FOUND,
    message: 'Material was not found',
    courseId,
    materialId,
  })
}

export function invalidAdminCoursesRequestException(
  errors: AdminCoursesValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: ADMIN_COURSES_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid admin courses request',
    errors,
  })
}
