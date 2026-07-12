import { Injectable } from '@nestjs/common'

import { CourseMembershipRole } from '../../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../../auth/auth.dto'
import type { AuditRequestContext } from '../../audit/audit.service'
import type {
  AdminAddCourseMemberRequest,
  AdminCourseDetailResponseDto,
  AdminCourseListResponseDto,
  AdminCourseMemberListResponseDto,
  AdminCourseMemberResponseDto,
  AdminMaterialListResponseDto,
  AdminMaterialResponseDto,
  AdminUpdateMaterialRequest,
  AdminUpdateMemberRoleRequest,
} from './admin-courses.dto'
import {
  AdminCourseMemberAlreadyExistsError,
  adminCourseNotFoundException,
  adminCourseMaterialNotFoundException,
  adminCourseMemberAlreadyExistsException,
  adminCourseMemberNotFoundException,
  adminCourseUserNotFoundException,
} from './admin-courses.errors'
import {
  AdminCoursesRepository,
  type AdminCourseRecord,
  type AdminCourseMembershipRecord,
  type AdminMaterialRecord,
} from './admin-courses.repository'

@Injectable()
export class AdminCoursesService {
  constructor(
    private readonly adminCoursesRepository: AdminCoursesRepository,
  ) {}

  async listCourses(): Promise<AdminCourseListResponseDto> {
    const courses = await this.adminCoursesRepository.listCourses()

    return {
      courses: courses.map(mapAdminCourseRecord),
    }
  }

  async getCourse(courseId: string): Promise<AdminCourseDetailResponseDto> {
    const course = await this.adminCoursesRepository.findCourseById(courseId)

    if (course === null) {
      throw adminCourseNotFoundException(courseId)
    }

    return {
      course: mapAdminCourseRecord(course),
    }
  }

  async addMember(
    courseId: string,
    input: AdminAddCourseMemberRequest,
    actor: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<AdminCourseMemberResponseDto> {
    const course = await this.adminCoursesRepository.findCourseById(courseId)

    if (course === null) {
      throw adminCourseNotFoundException(courseId)
    }

    const user = await this.adminCoursesRepository.findUserById(input.userId)

    if (user === null) {
      throw adminCourseUserNotFoundException(input.userId)
    }

    const existingMembership = await this.adminCoursesRepository.findMembership(
      courseId,
      input.userId,
    )

    if (existingMembership !== null) {
      throw adminCourseMemberAlreadyExistsException(courseId, input.userId)
    }

    try {
      const membership = await this.adminCoursesRepository.addMember({
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
      if (error instanceof AdminCourseMemberAlreadyExistsError) {
        throw adminCourseMemberAlreadyExistsException(
          error.courseId,
          error.userId,
        )
      }

      throw error
    }
  }

  async removeMember(
    courseId: string,
    userId: string,
    actor: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    const course = await this.adminCoursesRepository.findCourseById(courseId)

    if (course === null) {
      throw adminCourseNotFoundException(courseId)
    }

    const membership = await this.adminCoursesRepository.findMembership(
      courseId,
      userId,
    )

    if (membership === null) {
      throw adminCourseMemberNotFoundException(courseId, userId)
    }

    await this.adminCoursesRepository.removeMember({
      courseId,
      userId,
      actorUserId: actor.id,
      requestContext,
    })
  }

  async listMembers(
    courseId: string,
  ): Promise<AdminCourseMemberListResponseDto> {
    const course = await this.adminCoursesRepository.findCourseById(courseId)

    if (course === null) {
      throw adminCourseNotFoundException(courseId)
    }

    const members = await this.adminCoursesRepository.listMembers(courseId)

    return {
      members: members.map(mapMembershipRecord),
    }
  }

  async updateMemberRole(
    courseId: string,
    userId: string,
    input: AdminUpdateMemberRoleRequest,
    actor: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<AdminCourseMemberResponseDto> {
    const course = await this.adminCoursesRepository.findCourseById(courseId)

    if (course === null) {
      throw adminCourseNotFoundException(courseId)
    }

    const membership = await this.adminCoursesRepository.findMembership(
      courseId,
      userId,
    )

    if (membership === null) {
      throw adminCourseMemberNotFoundException(courseId, userId)
    }

    const updated = await this.adminCoursesRepository.updateMemberRole({
      courseId,
      userId,
      role: input.role,
      actorUserId: actor.id,
      requestContext,
    })

    return {
      member: mapMembershipRecord(updated),
    }
  }

  async listMaterials(courseId: string): Promise<AdminMaterialListResponseDto> {
    const course = await this.adminCoursesRepository.findCourseById(courseId)

    if (course === null) {
      throw adminCourseNotFoundException(courseId)
    }

    const materials = await this.adminCoursesRepository.listMaterials(courseId)

    return {
      materials: materials.map(mapMaterialRecord),
    }
  }

  async getMaterial(
    courseId: string,
    materialId: string,
  ): Promise<AdminMaterialResponseDto> {
    const course = await this.adminCoursesRepository.findCourseById(courseId)

    if (course === null) {
      throw adminCourseNotFoundException(courseId)
    }

    const material = await this.adminCoursesRepository.findMaterialById(
      courseId,
      materialId,
    )

    if (material === null) {
      throw adminCourseMaterialNotFoundException(courseId, materialId)
    }

    return {
      material: mapMaterialRecord(material),
    }
  }

  async updateMaterial(
    courseId: string,
    materialId: string,
    input: AdminUpdateMaterialRequest,
    actor: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<AdminMaterialResponseDto> {
    const course = await this.adminCoursesRepository.findCourseById(courseId)

    if (course === null) {
      throw adminCourseNotFoundException(courseId)
    }

    const existingMaterial = await this.adminCoursesRepository.findMaterialById(
      courseId,
      materialId,
    )

    if (existingMaterial === null) {
      throw adminCourseMaterialNotFoundException(courseId, materialId)
    }

    const material = await this.adminCoursesRepository.updateMaterial({
      materialId,
      courseId,
      title: input.title,
      actorUserId: actor.id,
      requestContext,
    })

    return {
      material: mapMaterialRecord(material),
    }
  }
}

function mapAdminCourseRecord(course: AdminCourseRecord) {
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

function mapMembershipRecord(membership: AdminCourseMembershipRecord) {
  return {
    id: membership.id,
    userId: membership.userId,
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
    user: membership.user,
  }
}

function mapMaterialRecord(material: AdminMaterialRecord) {
  return {
    id: material.id,
    courseId: material.courseId,
    uploadedById: material.uploadedById,
    title: material.title,
    originalFilename: material.originalFilename,
    storagePath: material.storagePath,
    sha256Hash: material.sha256Hash,
    status: material.status,
    extractedTextLength: material.extractedTextLength,
    chunkCount: material.chunkCount,
    errorMessage: material.errorMessage,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
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
