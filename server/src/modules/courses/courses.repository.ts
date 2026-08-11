import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  Prisma,
  type UserRole,
  type UserStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { AuditRequestContext } from '../audit/audit.public'
import { CourseAudit } from './course-audit'
import {
  CourseCodeAlreadyExistsError,
  CourseMemberAlreadyExistsError,
} from './course-administration.errors'

// ---------------------------------------------------------------------------
// Record interfaces
// ---------------------------------------------------------------------------

export interface CourseUserRecord {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
}

export interface CourseMembershipRecord {
  id: string
  userId: string
  role: CourseMembershipRole
  createdAt: Date
  user: CourseUserRecord
}

export interface CourseAdministrationRecord {
  id: string
  code: string
  title: string
  createdById: string | null
  createdBy: CourseUserRecord | null
  createdAt: Date
  updatedAt: Date
  memberships: CourseMembershipRecord[]
  materials: { deletedAt: Date | null }[]
}

export interface MemberCourseRecord {
  id: string
  code: string
  title: string
  membershipRole: CourseMembershipRole | null
}

export interface CourseAccessRecord {
  id: string
  membershipRole: CourseMembershipRole | null
}

// ---------------------------------------------------------------------------
// Repository input interfaces
// ---------------------------------------------------------------------------

export interface CreateCourseInput {
  code: string
  title: string
  actorUserId: string
  requestContext?: AuditRequestContext
}

export interface UpdateCourseInput {
  courseId: string
  code?: string
  title?: string
  actorUserId: string
  requestContext?: AuditRequestContext
}

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

export class CourseMemberNotFoundError extends Error {
  constructor(
    readonly courseId: string,
    readonly userId: string,
  ) {
    super(
      `Active membership not found for user ${userId} in course ${courseId}`,
    )
  }
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

const courseAdministrationSelect = {
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
    where: { removedAt: null },
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

export abstract class CoursesRepository {
  abstract listCourseAdministration(): Promise<CourseAdministrationRecord[]>

  abstract findCourseAdministrationById(
    courseId: string,
  ): Promise<CourseAdministrationRecord | null>

  abstract findCourseAdministrationByCode(
    code: string,
  ): Promise<CourseAdministrationRecord | null>

  abstract createCourse(
    input: CreateCourseInput,
  ): Promise<CourseAdministrationRecord>

  abstract updateCourse(
    input: UpdateCourseInput,
  ): Promise<CourseAdministrationRecord>

  abstract findUserById(userId: string): Promise<{ id: string } | null>

  abstract findMembership(
    courseId: string,
    userId: string,
  ): Promise<CourseMembershipRecord | null>

  abstract addMember(
    input: AddCourseMemberInput,
  ): Promise<CourseMembershipRecord>

  abstract removeMember(input: RemoveCourseMemberInput): Promise<void>

  abstract listMembers(courseId: string): Promise<CourseMembershipRecord[]>

  abstract updateMemberRole(
    input: UpdateMemberRoleInput,
  ): Promise<CourseMembershipRecord>

  abstract findCourseAccess(
    userId: string,
    courseId: string,
  ): Promise<CourseAccessRecord | null>

  abstract findMembershipRole(
    userId: string,
    courseId: string,
  ): Promise<CourseMembershipRole | null>

  abstract hasActiveCourseMembership(
    userId: string,
    courseId: string,
    role: CourseMembershipRole,
  ): Promise<boolean>

  abstract listMemberCourses(
    userId: string,
    role: CourseMembershipRole,
  ): Promise<MemberCourseRecord[]>
}

// ---------------------------------------------------------------------------
// Prisma implementation
// ---------------------------------------------------------------------------

@Injectable()
export class PrismaCoursesRepository extends CoursesRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly courseAudit: CourseAudit,
  ) {
    super()
  }

  listCourseAdministration(): Promise<CourseAdministrationRecord[]> {
    return this.prismaService.course.findMany({
      select: courseAdministrationSelect,
      orderBy: {
        code: 'asc',
      },
    })
  }

  findCourseAdministrationById(
    courseId: string,
  ): Promise<CourseAdministrationRecord | null> {
    return this.prismaService.course.findUnique({
      where: { id: courseId },
      select: courseAdministrationSelect,
    })
  }

  findCourseAdministrationByCode(
    code: string,
  ): Promise<CourseAdministrationRecord | null> {
    return this.prismaService.course.findUnique({
      where: { code },
      select: courseAdministrationSelect,
    })
  }

  async createCourse(
    input: CreateCourseInput,
  ): Promise<CourseAdministrationRecord> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const course = await tx.course.create({
          data: {
            code: input.code,
            title: input.title,
            createdById: input.actorUserId,
          },
          select: courseAdministrationSelect,
        })

        await this.courseAudit.recordCourseCreated(
          {
            actorUserId: input.actorUserId,
            course,
            requestContext: input.requestContext,
          },
          tx,
        )

        return course
      })
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new CourseCodeAlreadyExistsError(input.code)
      }

      throw error
    }
  }

  async updateCourse(
    input: UpdateCourseInput,
  ): Promise<CourseAdministrationRecord> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const previousCourse = await tx.course.findUnique({
          where: { id: input.courseId },
          select: {
            code: true,
            title: true,
          },
        })

        if (previousCourse === null) {
          throw new Error(`Course ${input.courseId} disappeared during update`)
        }

        const course = await tx.course.update({
          where: { id: input.courseId },
          data: {
            code: input.code,
            title: input.title,
          },
          select: courseAdministrationSelect,
        })

        await this.courseAudit.recordCourseUpdated(
          {
            actorUserId: input.actorUserId,
            course,
            previousCourse,
            requestContext: input.requestContext,
          },
          tx,
        )

        return course
      })
    } catch (error) {
      if (isUniqueConstraintViolation(error) && input.code !== undefined) {
        throw new CourseCodeAlreadyExistsError(input.code)
      }

      throw error
    }
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
  ): Promise<CourseMembershipRecord | null> {
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
  ): Promise<CourseMembershipRecord> {
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
          throw new CourseMemberAlreadyExistsError(input.courseId, input.userId)
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

        await this.courseAudit.recordMemberAdded(
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
      if (error instanceof CourseMemberAlreadyExistsError) {
        throw error
      }

      if (isUniqueConstraintViolation(error)) {
        throw new CourseMemberAlreadyExistsError(input.courseId, input.userId)
      }

      throw error
    }
  }

  findMembershipRole(
    userId: string,
    courseId: string,
  ): Promise<CourseMembershipRole | null> {
    return this.prismaService.courseMembership
      .findFirst({
        where: { userId, courseId, removedAt: null },
        select: { role: true },
      })
      .then((membership) => membership?.role ?? null)
  }

  async findCourseAccess(
    userId: string,
    courseId: string,
  ): Promise<CourseAccessRecord | null> {
    const course = await this.prismaService.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        memberships: {
          where: { userId, removedAt: null },
          select: { role: true },
          take: 1,
        },
      },
    })

    return course === null
      ? null
      : {
          id: course.id,
          membershipRole: course.memberships[0]?.role ?? null,
        }
  }

  async hasActiveCourseMembership(
    userId: string,
    courseId: string,
    role: CourseMembershipRole,
  ): Promise<boolean> {
    const membership = await this.prismaService.courseMembership.findFirst({
      where: { userId, courseId, role, removedAt: null },
      select: { id: true },
    })

    return membership !== null
  }

  async listMemberCourses(
    userId: string,
    role: CourseMembershipRole,
  ): Promise<MemberCourseRecord[]> {
    const memberships = await this.prismaService.courseMembership.findMany({
      where: { userId, role, removedAt: null },
      select: {
        role: true,
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },
    })

    return memberships.map((membership) => ({
      ...membership.course,
      membershipRole: membership.role,
    }))
  }

  async removeMember(input: RemoveCourseMemberInput): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      // Soft removal: chat_sessions carry an ON DELETE RESTRICT FK onto the
      // membership, so a hard delete would 500 once the student has any chat
      // session. Setting removed_at preserves referential integrity and keeps
      // the audit trail intact.
      const membership = await tx.courseMembership.findFirst({
        where: {
          courseId: input.courseId,
          userId: input.userId,
          removedAt: null,
        },
        select: {
          id: true,
          userId: true,
          role: true,
          createdAt: true,
          user: { select: courseUserSelect },
        },
      })

      if (membership === null) {
        throw new CourseMemberNotFoundError(input.courseId, input.userId)
      }

      const result = await tx.courseMembership.updateMany({
        where: {
          courseId: input.courseId,
          userId: input.userId,
          removedAt: null,
        },
        data: { removedAt: new Date() },
      })

      if (result.count !== 1) {
        throw new CourseMemberNotFoundError(input.courseId, input.userId)
      }

      await this.courseAudit.recordMemberRemoved(
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

  listMembers(courseId: string): Promise<CourseMembershipRecord[]> {
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
  ): Promise<CourseMembershipRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const membership = await tx.courseMembership.findFirst({
        where: {
          courseId: input.courseId,
          userId: input.userId,
          removedAt: null,
        },
        select: {
          id: true,
          userId: true,
          role: true,
          createdAt: true,
          user: { select: courseUserSelect },
        },
      })

      if (membership === null) {
        throw new CourseMemberNotFoundError(input.courseId, input.userId)
      }

      const result = await tx.courseMembership.updateMany({
        where: {
          courseId: input.courseId,
          userId: input.userId,
          removedAt: null,
        },
        data: { role: input.role },
      })

      if (result.count !== 1) {
        throw new CourseMemberNotFoundError(input.courseId, input.userId)
      }

      const updatedMembership = {
        ...membership,
        role: input.role,
      }

      await this.courseAudit.recordMemberRoleChanged(
        {
          actorUserId: input.actorUserId,
          courseId: input.courseId,
          membership: updatedMembership,
          requestContext: input.requestContext,
        },
        tx,
      )

      return updatedMembership
    })
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}
