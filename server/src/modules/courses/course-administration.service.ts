import { Injectable } from '@nestjs/common'

import { CourseMembershipRole } from './course-membership.types'
import type { AuthenticatedUser } from '../identity/identity.types'
import type { AuditRequestContext } from '../audit/audit.public'
import type {
  AddCourseMemberRequest,
  CourseAdministrationDetailResponseDto,
  CourseAdministrationListResponseDto,
  CourseAdministrationMemberListResponseDto,
  CourseAdministrationMemberResponseDto,
  CreateCourseRequest,
  UpdateCourseRequest,
  UpdateMemberRoleRequest,
} from './course-administration.types'
import {
  CourseCodeAlreadyExistsError,
  CourseMemberAlreadyExistsError,
  courseCodeAlreadyExistsException,
  courseNotFoundException,
  courseMemberAlreadyExistsException,
  courseMemberNotFoundException,
  courseUserNotFoundException,
} from './course-administration.errors'
import {
  CoursesRepository,
  type CourseAdministrationRecord,
  type CourseMembershipRecord,
  CourseMemberNotFoundError,
} from './courses.repository'

@Injectable()
export class CourseAdministrationService {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  async listCourses(): Promise<CourseAdministrationListResponseDto> {
    const courses = await this.coursesRepository.listCourseAdministration()

    return {
      courses: courses.map(mapCourseAdministrationRecord),
    }
  }

  async getCourse(
    courseId: string,
  ): Promise<CourseAdministrationDetailResponseDto> {
    const course =
      await this.coursesRepository.findCourseAdministrationById(courseId)

    if (course === null) {
      throw courseNotFoundException(courseId)
    }

    return {
      course: mapCourseAdministrationRecord(course),
    }
  }

  async createCourse(
    input: CreateCourseRequest,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<CourseAdministrationDetailResponseDto> {
    const existingCourse =
      await this.coursesRepository.findCourseAdministrationByCode(input.code)

    if (existingCourse !== null) {
      throw courseCodeAlreadyExistsException(input.code)
    }

    try {
      const course = await this.coursesRepository.createCourse({
        code: input.code,
        title: input.title,
        actorUserId: actor.id,
        requestContext,
      })

      return {
        course: mapCourseAdministrationRecord(course),
      }
    } catch (error) {
      if (error instanceof CourseCodeAlreadyExistsError) {
        throw courseCodeAlreadyExistsException(error.code)
      }

      throw error
    }
  }

  async updateCourse(
    courseId: string,
    input: UpdateCourseRequest,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<CourseAdministrationDetailResponseDto> {
    const existingCourse =
      await this.coursesRepository.findCourseAdministrationById(courseId)

    if (existingCourse === null) {
      throw courseNotFoundException(courseId)
    }

    if (input.code !== undefined && input.code !== existingCourse.code) {
      const courseWithCode =
        await this.coursesRepository.findCourseAdministrationByCode(input.code)

      if (courseWithCode !== null) {
        throw courseCodeAlreadyExistsException(input.code)
      }
    }

    try {
      const course = await this.coursesRepository.updateCourse({
        courseId,
        code: input.code,
        title: input.title,
        actorUserId: actor.id,
        requestContext,
      })

      return {
        course: mapCourseAdministrationRecord(course),
      }
    } catch (error) {
      if (error instanceof CourseCodeAlreadyExistsError) {
        throw courseCodeAlreadyExistsException(error.code)
      }

      throw error
    }
  }

  async addMember(
    courseId: string,
    input: AddCourseMemberRequest,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<CourseAdministrationMemberResponseDto> {
    const course =
      await this.coursesRepository.findCourseAdministrationById(courseId)

    if (course === null) {
      throw courseNotFoundException(courseId)
    }

    const user = await this.coursesRepository.findUserById(input.userId)

    if (user === null) {
      throw courseUserNotFoundException(input.userId)
    }

    const existingMembership = await this.coursesRepository.findMembership(
      courseId,
      input.userId,
    )

    if (existingMembership !== null) {
      throw courseMemberAlreadyExistsException(courseId, input.userId)
    }

    try {
      const membership = await this.coursesRepository.addMember({
        courseId,
        userId: input.userId,
        role: input.role,
        actorUserId: actor.id,
        requestContext,
      })

      return {
        member: mapMembershipRecord(membership),
      }
    } catch (error) {
      if (error instanceof CourseMemberAlreadyExistsError) {
        throw courseMemberAlreadyExistsException(error.courseId, error.userId)
      }

      throw error
    }
  }

  async removeMember(
    courseId: string,
    userId: string,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    const course =
      await this.coursesRepository.findCourseAdministrationById(courseId)

    if (course === null) {
      throw courseNotFoundException(courseId)
    }

    const membership = await this.coursesRepository.findMembership(
      courseId,
      userId,
    )

    if (membership === null) {
      throw courseMemberNotFoundException(courseId, userId)
    }

    try {
      await this.coursesRepository.removeMember({
        courseId,
        userId,
        actorUserId: actor.id,
        requestContext,
      })
    } catch (error) {
      if (error instanceof CourseMemberNotFoundError) {
        throw courseMemberNotFoundException(courseId, userId)
      }

      throw error
    }
  }

  async listMembers(
    courseId: string,
  ): Promise<CourseAdministrationMemberListResponseDto> {
    const course =
      await this.coursesRepository.findCourseAdministrationById(courseId)

    if (course === null) {
      throw courseNotFoundException(courseId)
    }

    const members = await this.coursesRepository.listMembers(courseId)

    return {
      members: members.map(mapMembershipRecord),
    }
  }

  async updateMemberRole(
    courseId: string,
    userId: string,
    input: UpdateMemberRoleRequest,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<CourseAdministrationMemberResponseDto> {
    const course =
      await this.coursesRepository.findCourseAdministrationById(courseId)

    if (course === null) {
      throw courseNotFoundException(courseId)
    }

    const membership = await this.coursesRepository.findMembership(
      courseId,
      userId,
    )

    if (membership === null) {
      throw courseMemberNotFoundException(courseId, userId)
    }

    let updated: CourseMembershipRecord
    try {
      updated = await this.coursesRepository.updateMemberRole({
        courseId,
        userId,
        role: input.role,
        actorUserId: actor.id,
        requestContext,
      })
    } catch (error) {
      if (error instanceof CourseMemberNotFoundError) {
        throw courseMemberNotFoundException(courseId, userId)
      }

      throw error
    }

    return {
      member: mapMembershipRecord(updated),
    }
  }
}

function mapCourseAdministrationRecord(course: CourseAdministrationRecord) {
  const memberships = course.memberships
    .map(mapMembershipRecord)
    .sort(compareMemberships)
  const instructorCount = memberships.filter(
    (m) => m.role === CourseMembershipRole.INSTRUCTOR,
  ).length
  const studentCount = memberships.filter(
    (m) => m.role === CourseMembershipRole.STUDENT,
  ).length
  const activeMaterialCount = course.materials.filter(
    (m) => m.deletedAt === null,
  ).length

  return {
    id: course.id,
    code: course.code,
    title: course.title,
    adminMetadata: {
      createdById: course.createdById,
      createdBy: course.createdBy,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
      memberships,
      memberCount: memberships.length,
      instructorCount,
      studentCount,
      materialCount: course.materials.length,
      activeMaterialCount,
    },
  }
}

function mapMembershipRecord(membership: CourseMembershipRecord) {
  return {
    id: membership.id,
    userId: membership.userId,
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
    user: membership.user,
  }
}

function compareMemberships(
  a: { role: CourseMembershipRole; user: { email: string } },
  b: { role: CourseMembershipRole; user: { email: string } },
) {
  const roleCompare = a.role.localeCompare(b.role)

  if (roleCompare !== 0) {
    return roleCompare
  }

  return a.user.email.localeCompare(b.user.email)
}
