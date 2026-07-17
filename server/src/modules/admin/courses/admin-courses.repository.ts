import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  Prisma,
  type MaterialStatus,
  type UserRole,
  type UserStatus,
} from '../../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuditRequestContext } from '../../audit/audit.service'
import { AdminCoursesAuditService } from './admin-courses.audit.service'
import { AdminCourseMemberAlreadyExistsError } from './admin-courses.errors'

// ---------------------------------------------------------------------------
// Record interfaces
// ---------------------------------------------------------------------------

export interface AdminCourseUserRecord {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
}

export interface AdminCourseMembershipRecord {
  id: string
  userId: string
  role: CourseMembershipRole
  createdAt: Date
  user: AdminCourseUserRecord
}

export interface AdminCourseRecord {
  id: string
  code: string
  title: string
  createdById: string | null
  createdBy: AdminCourseUserRecord | null
  createdAt: Date
  updatedAt: Date
  memberships: AdminCourseMembershipRecord[]
  materials: { deletedAt: Date | null }[]
}

export interface AdminMaterialRecord {
  id: string
  courseId: string
  uploadedById: string
  uploadedBy: AdminCourseUserRecord
  title: string
  originalFilename: string
  storagePath: string
  sha256Hash: string | null
  status: MaterialStatus
  extractedTextLength: number | null
  chunkCount: number | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Repository input interfaces
// ---------------------------------------------------------------------------

export interface AddCourseMemberInput {
  courseId: string
  userId: string
  role: CourseMembershipRole
  actorUserId: string
  requestContext?: AuditRequestContext
}

export interface RemoveCourseMemberInput {
  courseId: string
  userId: string
  actorUserId: string
  requestContext?: AuditRequestContext
}

export interface UpdateMemberRoleInput {
  courseId: string
  userId: string
  role: CourseMembershipRole
  actorUserId: string
  requestContext?: AuditRequestContext
}

export interface UpdateMaterialInput {
  materialId: string
  courseId: string
  title: string
  actorUserId: string
  requestContext?: AuditRequestContext
}

// ---------------------------------------------------------------------------
// Abstract repository
// ---------------------------------------------------------------------------

const courseUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
} satisfies Prisma.UserSelect

const adminCourseSelect = {
  id: true,
  code: true,
  title: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: courseUserSelect,
  },
  memberships: {
    select: {
      id: true,
      userId: true,
      role: true,
      createdAt: true,
      user: {
        select: courseUserSelect,
      },
    },
  },
  materials: {
    select: {
      deletedAt: true,
    },
  },
} satisfies Prisma.CourseSelect

const adminMaterialSelect = {
  id: true,
  courseId: true,
  uploadedById: true,
  uploadedBy: {
    select: courseUserSelect,
  },
  title: true,
  originalFilename: true,
  storagePath: true,
  sha256Hash: true,
  status: true,
  extractedTextLength: true,
  chunkCount: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MaterialSelect

export abstract class AdminCoursesRepository {
  abstract listCourses(): Promise<AdminCourseRecord[]>

  abstract findCourseById(courseId: string): Promise<AdminCourseRecord | null>

  abstract findUserById(userId: string): Promise<{ id: string } | null>

  abstract findMembership(
    courseId: string,
    userId: string,
  ): Promise<AdminCourseMembershipRecord | null>

  abstract addMember(
    input: AddCourseMemberInput,
  ): Promise<AdminCourseMembershipRecord>

  abstract removeMember(input: RemoveCourseMemberInput): Promise<void>

  abstract listMembers(courseId: string): Promise<AdminCourseMembershipRecord[]>

  abstract updateMemberRole(
    input: UpdateMemberRoleInput,
  ): Promise<AdminCourseMembershipRecord>

  abstract listMaterials(courseId: string): Promise<AdminMaterialRecord[]>

  abstract findMaterialById(
    courseId: string,
    materialId: string,
  ): Promise<AdminMaterialRecord | null>

  abstract updateMaterial(
    input: UpdateMaterialInput,
  ): Promise<AdminMaterialRecord>
}

// ---------------------------------------------------------------------------
// Prisma implementation
// ---------------------------------------------------------------------------

@Injectable()
export class PrismaAdminCoursesRepository extends AdminCoursesRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly adminCoursesAuditService: AdminCoursesAuditService,
  ) {
    super()
  }

  listCourses(): Promise<AdminCourseRecord[]> {
    return this.prismaService.course.findMany({
      select: adminCourseSelect,
      orderBy: {
        code: 'asc',
      },
    })
  }

  findCourseById(courseId: string): Promise<AdminCourseRecord | null> {
    return this.prismaService.course.findUnique({
      where: { id: courseId },
      select: adminCourseSelect,
    })
  }

  findUserById(userId: string): Promise<{ id: string } | null> {
    return this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
  }

  async findMembership(
    courseId: string,
    userId: string,
  ): Promise<AdminCourseMembershipRecord | null> {
    const membership = await this.prismaService.courseMembership.findUnique({
      where: {
        courseId_userId: { courseId, userId },
      },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        removedAt: true,
        user: {
          select: courseUserSelect,
        },
      },
    })

    if (membership === null) {
      return null
    }

    // Only active memberships count: a soft-removed member is treated as absent
    // (re-addable, not removable/updatable) across the admin surface.
    if (membership.removedAt !== null) {
      return null
    }

    const { removedAt: _removedAt, ...record } = membership

    return record
  }

  async addMember(
    input: AddCourseMemberInput,
  ): Promise<AdminCourseMembershipRecord> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const existing = await tx.courseMembership.findUnique({
          where: {
            courseId_userId: {
              courseId: input.courseId,
              userId: input.userId,
            },
          },
          select: {
            id: true,
            removedAt: true,
          },
        })

        if (existing?.removedAt === null) {
          throw new AdminCourseMemberAlreadyExistsError(
            input.courseId,
            input.userId,
          )
        }

        // The @@unique([courseId, userId]) constraint keeps the soft-removed row
        // around, so re-adding reactivates it (clearing removedAt) rather than
        // inserting a duplicate.
        const membership =
          existing === null
            ? await tx.courseMembership.create({
                data: {
                  courseId: input.courseId,
                  userId: input.userId,
                  role: input.role,
                  createdById: input.actorUserId,
                },
                select: {
                  id: true,
                  userId: true,
                  role: true,
                  createdAt: true,
                  user: {
                    select: courseUserSelect,
                  },
                },
              })
            : await tx.courseMembership.update({
                where: {
                  courseId_userId: {
                    courseId: input.courseId,
                    userId: input.userId,
                  },
                },
                data: {
                  role: input.role,
                  removedAt: null,
                  createdById: input.actorUserId,
                },
                select: {
                  id: true,
                  userId: true,
                  role: true,
                  createdAt: true,
                  user: {
                    select: courseUserSelect,
                  },
                },
              })

        await this.adminCoursesAuditService.recordMemberAdded(
          {
            actorUserId: input.actorUserId,
            courseId: input.courseId,
            membership,
            requestContext: input.requestContext,
          },
          tx,
        )

        return membership
      })
    } catch (error) {
      if (error instanceof AdminCourseMemberAlreadyExistsError) {
        throw error
      }

      if (isUniqueConstraintViolation(error)) {
        throw new AdminCourseMemberAlreadyExistsError(
          input.courseId,
          input.userId,
        )
      }

      throw error
    }
  }

  async removeMember(input: RemoveCourseMemberInput): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      // Soft removal: chat_sessions carry an ON DELETE RESTRICT FK onto the
      // membership, so a hard delete would 500 once the student has any chat
      // session. Setting removed_at preserves referential integrity and keeps
      // the audit trail intact.
      const membership = await tx.courseMembership.update({
        where: {
          courseId_userId: {
            courseId: input.courseId,
            userId: input.userId,
          },
        },
        data: {
          removedAt: new Date(),
        },
        select: {
          id: true,
          userId: true,
          role: true,
          createdAt: true,
          user: {
            select: courseUserSelect,
          },
        },
      })

      await this.adminCoursesAuditService.recordMemberRemoved(
        {
          actorUserId: input.actorUserId,
          courseId: input.courseId,
          membership,
          requestContext: input.requestContext,
        },
        tx,
      )
    })
  }

  listMembers(courseId: string): Promise<AdminCourseMembershipRecord[]> {
    return this.prismaService.courseMembership.findMany({
      where: { courseId, removedAt: null },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: courseUserSelect,
        },
      },
      orderBy: [{ role: 'asc' }, { user: { email: 'asc' } }],
    })
  }

  updateMemberRole(
    input: UpdateMemberRoleInput,
  ): Promise<AdminCourseMembershipRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const membership = await tx.courseMembership.update({
        where: {
          courseId_userId: {
            courseId: input.courseId,
            userId: input.userId,
          },
        },
        data: { role: input.role },
        select: {
          id: true,
          userId: true,
          role: true,
          createdAt: true,
          user: {
            select: courseUserSelect,
          },
        },
      })

      await this.adminCoursesAuditService.recordMemberRoleChanged(
        {
          actorUserId: input.actorUserId,
          courseId: input.courseId,
          membership,
          requestContext: input.requestContext,
        },
        tx,
      )

      return membership
    })
  }

  listMaterials(courseId: string): Promise<AdminMaterialRecord[]> {
    return this.prismaService.material.findMany({
      where: {
        courseId,
        deletedAt: null,
      },
      select: adminMaterialSelect,
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  findMaterialById(
    courseId: string,
    materialId: string,
  ): Promise<AdminMaterialRecord | null> {
    return this.prismaService.material.findFirst({
      where: {
        id: materialId,
        courseId,
        deletedAt: null,
      },
      select: adminMaterialSelect,
    })
  }

  updateMaterial(input: UpdateMaterialInput): Promise<AdminMaterialRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const material = await tx.material.update({
        where: { id: input.materialId },
        data: { title: input.title },
        select: adminMaterialSelect,
      })

      await this.adminCoursesAuditService.recordMaterialUpdated(
        {
          actorUserId: input.actorUserId,
          courseId: input.courseId,
          material,
          requestContext: input.requestContext,
        },
        tx,
      )

      return material
    })
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}
