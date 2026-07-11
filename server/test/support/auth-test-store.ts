import type {
  AuditLog,
  Course,
  CourseMembership,
  Prisma,
  RefreshToken,
  User,
} from '../../src/generated/prisma/client'
import {
  createP0DemoPasswordHash,
  P0_DEMO_COURSE,
  P0_DEMO_USERS,
  P0_HIDDEN_ISOLATION_COURSE,
} from '../../src/seeds/p0-demo.seed'
import type { PrismaService } from '../../src/modules/prisma/prisma.service'

type StoredCourseMembership = CourseMembership & { course?: Course }
type StoredCourse = Course & { memberships?: CourseMembership[] }
type StoredRefreshToken = RefreshToken & { user?: User }

interface FindUniqueArgs {
  where: {
    email?: string
    id?: string
    tokenHash?: string
  }
  include?: {
    user?: boolean
  }
}

interface UpdateUserArgs {
  where: {
    id: string
  }
  data: Partial<Pick<User, 'lastLoginAt' | 'status' | 'disabledAt'>>
}

interface CreateUserArgs {
  data: Pick<User, 'email' | 'displayName' | 'role' | 'status' | 'passwordHash'>
}

interface FindManyUserArgs {
  orderBy?: {
    createdAt?: 'asc' | 'desc'
  }
}

interface CreateRefreshTokenArgs {
  data: Pick<
    RefreshToken,
    'userId' | 'tokenHash' | 'expiresAt' | 'ip' | 'userAgent'
  >
}

interface UpdateRefreshTokenArgs {
  where: {
    id: string
  }
  data: Partial<Pick<RefreshToken, 'revokedAt' | 'replacedByTokenId'>>
}

interface UpdateManyRefreshTokenArgs {
  where: {
    id?: string
    tokenHash: string
    revokedAt: null
    expiresAt: {
      gt: Date
    }
  }
  data: Pick<RefreshToken, 'revokedAt'>
}

interface FindManyMembershipArgs {
  where?: {
    userId?: string
  }
  include?: {
    course?: boolean
  }
}

interface FindManyCourseArgs {
  include?: {
    memberships?: {
      where?: {
        userId?: string
      }
    }
  }
}

interface CreateAuditLogArgs {
  data: {
    actorUserId?: string | null
    action: string
    targetType: string
    targetId?: string | null
    courseId?: string | null
    ip?: string | null
    userAgent?: string | null
    metadata?: Prisma.InputJsonObject
  }
}

interface FindUniqueAuditLogArgs {
  where: {
    id: string
  }
}

export class AuthTestStore {
  readonly users = new Map<string, User>()
  readonly courses = new Map<string, Course>()
  readonly memberships: CourseMembership[] = []
  readonly refreshTokens = new Map<string, RefreshToken>()
  readonly auditLogs = new Map<string, AuditLog>()

  private nextUserSequence = 1
  private nextRefreshTokenSequence = 1
  private nextAuditLogSequence = 1
  private failNextActiveRefreshTokenRevoke = false

  readonly prisma = {
    user: {
      findUnique: jest.fn((args: FindUniqueArgs) =>
        Promise.resolve(this.findUser(args)),
      ),
      findMany: jest.fn((args?: FindManyUserArgs) =>
        Promise.resolve(this.findUsers(args)),
      ),
      create: jest.fn((args: CreateUserArgs) =>
        Promise.resolve(this.createUser(args)),
      ),
      update: jest.fn((args: UpdateUserArgs) =>
        Promise.resolve(this.updateUser(args)),
      ),
    },
    refreshToken: {
      create: jest.fn((args: CreateRefreshTokenArgs) =>
        Promise.resolve(this.createRefreshToken(args)),
      ),
      findUnique: jest.fn((args: FindUniqueArgs) =>
        Promise.resolve(this.findRefreshToken(args)),
      ),
      update: jest.fn((args: UpdateRefreshTokenArgs) =>
        Promise.resolve(this.updateRefreshToken(args)),
      ),
      updateMany: jest.fn((args: UpdateManyRefreshTokenArgs) =>
        Promise.resolve(this.updateManyRefreshTokens(args)),
      ),
    },
    courseMembership: {
      findMany: jest.fn((args?: FindManyMembershipArgs) =>
        Promise.resolve(this.findMemberships(args)),
      ),
    },
    course: {
      findMany: jest.fn((args?: FindManyCourseArgs) =>
        Promise.resolve(this.findCourses(args)),
      ),
    },
    auditLog: {
      create: jest.fn((args: CreateAuditLogArgs) =>
        Promise.resolve(this.createAuditLog(args)),
      ),
      findUnique: jest.fn((args: FindUniqueAuditLogArgs) =>
        Promise.resolve(this.findAuditLog(args)),
      ),
    },
    $transaction: jest.fn(
      async <T>(fn: (tx: AuthTestStore['prisma']) => Promise<T>) =>
        fn(this.prisma),
    ),
  } as unknown as PrismaService

  constructor() {
    this.seedP0DemoData()
  }

  findUserByEmail(email: string) {
    return (
      [...this.users.values()].find(
        (user) => user.email.toLowerCase() === email.toLowerCase(),
      ) ?? null
    )
  }

  disableUser(email: string) {
    const user = this.findUserByEmail(email)

    if (!user) {
      throw new Error(`Missing test user ${email}`)
    }

    this.users.set(user.id, {
      ...user,
      status: 'DISABLED',
      disabledAt: new Date('2026-07-06T10:00:00.000Z'),
    })
  }

  simulateNextActiveRefreshTokenRevokeRace() {
    this.failNextActiveRefreshTokenRevoke = true
  }

  private seedP0DemoData() {
    const now = new Date('2026-07-06T00:00:00.000Z')
    const adminId = '00000000-0000-4000-8000-000000000001'
    const instructorId = '00000000-0000-4000-8000-000000000002'
    const pythonCourseId = '00000000-0000-4000-8000-000000000101'

    for (const [index, seedUser] of P0_DEMO_USERS.entries()) {
      const id = `00000000-0000-4000-8000-00000000000${(index + 1).toString()}`
      this.users.set(id, {
        id,
        email: seedUser.email,
        displayName: seedUser.displayName,
        role: seedUser.role,
        status: 'ACTIVE',
        passwordHash: createP0DemoPasswordHash(seedUser.passwordSalt),
        disabledAt: null,
        disabledById: null,
        lastLoginAt: null,
        passwordChangedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    }

    this.courses.set(pythonCourseId, {
      id: pythonCourseId,
      code: P0_DEMO_COURSE.code,
      title: P0_DEMO_COURSE.title,
      createdById: instructorId,
      createdAt: now,
      updatedAt: now,
    })
    this.courses.set('00000000-0000-4000-8000-000000000102', {
      id: '00000000-0000-4000-8000-000000000102',
      code: P0_HIDDEN_ISOLATION_COURSE.code,
      title: P0_HIDDEN_ISOLATION_COURSE.title,
      createdById: null,
      createdAt: now,
      updatedAt: now,
    })

    for (const seedUser of P0_DEMO_USERS) {
      if (seedUser.pythonMembershipRole === null) {
        continue
      }

      const user = this.findUserByEmail(seedUser.email)

      if (!user) {
        throw new Error(`Missing test user ${seedUser.email}`)
      }

      this.memberships.push({
        id: `00000000-0000-4000-8000-00000000020${this.memberships.length.toString()}`,
        courseId: pythonCourseId,
        userId: user.id,
        role: seedUser.pythonMembershipRole,
        createdById: adminId,
        createdAt: now,
      })
    }
  }

  private findUser(args: FindUniqueArgs): User | null {
    if (args.where.id !== undefined) {
      return this.users.get(args.where.id) ?? null
    }

    if (args.where.email !== undefined) {
      return this.findUserByEmail(args.where.email)
    }

    return null
  }

  private findUsers(args: FindManyUserArgs | undefined) {
    const users = [...this.users.values()]

    if (args?.orderBy?.createdAt === 'desc') {
      users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    if (args?.orderBy?.createdAt === 'asc') {
      users.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    }

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      memberships: this.memberships
        .filter((membership) => membership.userId === user.id)
        .map((membership) => {
          const course = this.courses.get(membership.courseId)

          if (!course) {
            throw new Error(`Missing course ${membership.courseId}`)
          }

          return {
            courseId: membership.courseId,
            role: membership.role,
            course: {
              id: course.id,
              code: course.code,
              title: course.title,
            },
          }
        }),
    }))
  }

  private updateUser(args: UpdateUserArgs): User {
    const user = this.users.get(args.where.id)

    if (!user) {
      throw new Error(`Missing user ${args.where.id}`)
    }

    const updated = {
      ...user,
      ...args.data,
      updatedAt: new Date('2026-07-06T12:00:00.000Z'),
    }
    this.users.set(user.id, updated)

    return updated
  }

  private createUser(args: CreateUserArgs): User {
    const sequence = this.nextUserSequence
    this.nextUserSequence += 1
    const now = new Date('2026-07-06T12:00:00.000Z')
    const user: User = {
      id: `00000000-0000-4000-8000-00000000050${sequence.toString()}`,
      email: args.data.email,
      displayName: args.data.displayName,
      role: args.data.role,
      status: args.data.status,
      passwordHash: args.data.passwordHash,
      disabledAt: null,
      disabledById: null,
      lastLoginAt: null,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    }

    this.users.set(user.id, user)

    return user
  }

  private createRefreshToken(args: CreateRefreshTokenArgs): RefreshToken {
    const sequence = this.nextRefreshTokenSequence
    this.nextRefreshTokenSequence += 1

    const refreshToken: RefreshToken = {
      id: `00000000-0000-4000-8000-00000000030${sequence.toString()}`,
      userId: args.data.userId,
      tokenHash: args.data.tokenHash,
      expiresAt: args.data.expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
      ip: args.data.ip,
      userAgent: args.data.userAgent,
      createdAt: new Date('2026-07-06T12:00:00.000Z'),
    }

    this.refreshTokens.set(refreshToken.id, refreshToken)

    return refreshToken
  }

  private findRefreshToken(args: FindUniqueArgs): StoredRefreshToken | null {
    const refreshToken = [...this.refreshTokens.values()].find(
      (storedToken) => storedToken.tokenHash === args.where.tokenHash,
    )

    if (!refreshToken) {
      return null
    }

    if (args.include?.user === true) {
      const user = this.users.get(refreshToken.userId)

      if (!user) {
        throw new Error(`Missing token user ${refreshToken.userId}`)
      }

      return {
        ...refreshToken,
        user,
      }
    }

    return refreshToken
  }

  private updateRefreshToken(args: UpdateRefreshTokenArgs): RefreshToken {
    const refreshToken = this.refreshTokens.get(args.where.id)

    if (!refreshToken) {
      throw new Error(`Missing refresh token ${args.where.id}`)
    }

    const updated = {
      ...refreshToken,
      ...args.data,
    }
    this.refreshTokens.set(updated.id, updated)

    return updated
  }

  private updateManyRefreshTokens(args: UpdateManyRefreshTokenArgs) {
    let count = 0

    if (args.where.id !== undefined && this.failNextActiveRefreshTokenRevoke) {
      this.failNextActiveRefreshTokenRevoke = false
      return { count }
    }

    for (const refreshToken of this.refreshTokens.values()) {
      const isMatch =
        (args.where.id === undefined || refreshToken.id === args.where.id) &&
        refreshToken.tokenHash === args.where.tokenHash &&
        refreshToken.revokedAt === args.where.revokedAt &&
        refreshToken.expiresAt > args.where.expiresAt.gt

      if (!isMatch) {
        continue
      }

      this.refreshTokens.set(refreshToken.id, {
        ...refreshToken,
        revokedAt: args.data.revokedAt,
      })
      count += 1
    }

    return { count }
  }

  private findMemberships(
    args: FindManyMembershipArgs | undefined,
  ): StoredCourseMembership[] {
    const userId = args?.where?.userId
    const memberships =
      userId !== undefined
        ? this.memberships.filter((membership) => membership.userId === userId)
        : this.memberships

    return memberships.map((membership) => {
      if (args?.include?.course !== true) {
        return membership
      }

      const course = this.courses.get(membership.courseId)

      if (!course) {
        throw new Error(`Missing course ${membership.courseId}`)
      }

      return {
        ...membership,
        course,
      }
    })
  }

  private findCourses(args: FindManyCourseArgs | undefined): StoredCourse[] {
    return [...this.courses.values()].map((course) => {
      const membershipUserId = args?.include?.memberships?.where?.userId

      if (membershipUserId === undefined) {
        return course
      }

      return {
        ...course,
        memberships: this.memberships.filter(
          (membership) =>
            membership.courseId === course.id &&
            membership.userId === membershipUserId,
        ),
      }
    })
  }

  private createAuditLog(args: CreateAuditLogArgs): AuditLog {
    const sequence = this.nextAuditLogSequence
    this.nextAuditLogSequence += 1

    const auditLog: AuditLog = {
      id: `00000000-0000-4000-8000-00000000040${sequence.toString()}`,
      actorUserId: args.data.actorUserId ?? null,
      action: args.data.action,
      targetType: args.data.targetType,
      targetId: args.data.targetId ?? null,
      courseId: args.data.courseId ?? null,
      ip: args.data.ip ?? null,
      userAgent: args.data.userAgent ?? null,
      metadata: (args.data.metadata ?? {}) as Prisma.JsonValue,
      createdAt: new Date('2026-07-06T12:00:00.000Z'),
    }

    this.auditLogs.set(auditLog.id, auditLog)

    return auditLog
  }

  private findAuditLog(args: FindUniqueAuditLogArgs): AuditLog | null {
    return this.auditLogs.get(args.where.id) ?? null
  }
}
