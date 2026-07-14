import type {
  AuditLog,
  Course,
  CourseMembership,
  Material,
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
type StoredCourse = Course & {
  memberships?: CourseMembership[]
  materials?: Material[]
}
type StoredRefreshToken = RefreshToken & { user?: User }
type StoredMaterial = Material

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
  data: Partial<
    Pick<
      User,
      | 'lastLoginAt'
      | 'status'
      | 'disabledAt'
      | 'disabledById'
      | 'passwordHash'
      | 'passwordChangedAt'
    >
  >
}

interface CreateUserArgs {
  data: Pick<User, 'email' | 'displayName' | 'role' | 'status' | 'passwordHash'>
}

interface FindManyUserArgs {
  orderBy?: {
    createdAt?: 'asc' | 'desc'
    id?: 'asc' | 'desc'
  }[]
  cursor?: { id: string }
  skip?: number
  take?: number
}

interface CountUserArgs {
  where?: {
    role?: User['role']
    status?: User['status']
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
    tokenHash?: string
    userId?: string
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
    courseId?: string
  }
  include?: {
    course?: boolean
  }
  orderBy?: {
    role?: 'asc' | 'desc'
    user?: { email?: 'asc' | 'desc' }
  }[]
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

interface CreateCourseMembershipArgs {
  data: Pick<CourseMembership, 'courseId' | 'userId' | 'role' | 'createdById'>
}

interface DeleteCourseMembershipArgs {
  where: {
    courseId_userId: {
      courseId: string
      userId: string
    }
  }
}

interface UpdateCourseMembershipArgs {
  where: {
    courseId_userId: {
      courseId: string
      userId: string
    }
  }
  data: Partial<Pick<CourseMembership, 'role'>>
}

interface FindUniqueMembershipArgs {
  where: {
    courseId_userId: {
      courseId: string
      userId: string
    }
  }
}

interface FindUniqueCourseArgs {
  where: {
    id: string
  }
}

interface FindManyMaterialArgs {
  where?: {
    courseId?: string
    deletedAt?: null | Date
  }
  orderBy?: {
    createdAt?: 'asc' | 'desc'
  }
}

interface FindFirstMaterialArgs {
  where?: {
    id?: string
    courseId?: string
    deletedAt?: null | Date
  }
}

interface UpdateMaterialArgs {
  where: {
    id: string
  }
  data: Partial<Pick<Material, 'title'>>
}

export class AuthTestStore {
  readonly users = new Map<string, User>()
  readonly courses = new Map<string, Course>()
  readonly materials = new Map<string, Material>()
  readonly memberships: CourseMembership[] = []
  readonly refreshTokens = new Map<string, RefreshToken>()
  readonly auditLogs = new Map<string, AuditLog>()

  private nextUserSequence = 1
  private nextRefreshTokenSequence = 1
  private nextAuditLogSequence = 1
  private nextMembershipSequence = 1
  private nextMaterialSequence = 1
  private failNextActiveRefreshTokenRevoke = false

  readonly prisma = {
    user: {
      findUnique: jest.fn((args: FindUniqueArgs) =>
        Promise.resolve(this.findUser(args)),
      ),
      findMany: jest.fn((args?: FindManyUserArgs) =>
        Promise.resolve(this.findUsers(args)),
      ),
      count: jest.fn((args?: CountUserArgs) =>
        Promise.resolve(this.countUsers(args)),
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
      findUnique: jest.fn((args: FindUniqueMembershipArgs) =>
        Promise.resolve(this.findUniqueMembership(args)),
      ),
      findMany: jest.fn((args?: FindManyMembershipArgs) =>
        Promise.resolve(this.findMemberships(args)),
      ),
      create: jest.fn((args: CreateCourseMembershipArgs) =>
        Promise.resolve(this.createMembership(args)),
      ),
      delete: jest.fn((args: DeleteCourseMembershipArgs) =>
        Promise.resolve(this.deleteMembership(args)),
      ),
      update: jest.fn((args: UpdateCourseMembershipArgs) =>
        Promise.resolve(this.updateMembership(args)),
      ),
    },
    course: {
      findUnique: jest.fn((args: FindUniqueCourseArgs) =>
        Promise.resolve(this.findCourse(args)),
      ),
      findMany: jest.fn((args?: FindManyCourseArgs) =>
        Promise.resolve(this.findCourses(args)),
      ),
    },
    material: {
      findMany: jest.fn((args?: FindManyMaterialArgs) =>
        Promise.resolve(this.findMaterials(args)),
      ),
      findFirst: jest.fn((args?: FindFirstMaterialArgs) =>
        Promise.resolve(this.findFirstMaterial(args)),
      ),
      update: jest.fn((args: UpdateMaterialArgs) =>
        Promise.resolve(this.updateMaterial(args)),
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

  disableUser(email: string, disabledById: string | null = null) {
    const user = this.findUserByEmail(email)

    if (!user) {
      throw new Error(`Missing test user ${email}`)
    }

    this.users.set(user.id, {
      ...user,
      status: 'DISABLED',
      disabledAt: new Date('2026-07-06T10:00:00.000Z'),
      disabledById,
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
    const hiddenCourseId = '00000000-0000-4000-8000-000000000102'

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
    this.courses.set(hiddenCourseId, {
      id: hiddenCourseId,
      code: P0_HIDDEN_ISOLATION_COURSE.code,
      title: P0_HIDDEN_ISOLATION_COURSE.title,
      createdById: null,
      createdAt: now,
      updatedAt: now,
    })

    this.materials.set('00000000-0000-4000-8000-000000000401', {
      id: '00000000-0000-4000-8000-000000000401',
      courseId: pythonCourseId,
      uploadedById: instructorId,
      title: 'Python Basics',
      originalFilename: 'python_basics.pdf',
      storagePath: '/storage/python_basics.pdf',
      sha256Hash: 'dummyhash',
      status: 'READY',
      extractedTextLength: 1000,
      chunkCount: 10,
      errorMessage: null,
      deletedAt: null,
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
        removedAt: null,
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
    let users = [...this.users.values()]
    const createdAtOrder = args?.orderBy?.find(
      (order) => order.createdAt !== undefined,
    )?.createdAt
    const idOrder = args?.orderBy?.find((order) => order.id !== undefined)?.id

    if (createdAtOrder === 'desc') {
      users.sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          (idOrder === 'desc' ? b.id.localeCompare(a.id) : 0),
      )
    }

    if (createdAtOrder === 'asc') {
      users.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    }

    if (args?.cursor !== undefined) {
      const cursorIndex = users.findIndex((user) => user.id === args.cursor?.id)
      users = cursorIndex < 0 ? [] : users.slice(cursorIndex + (args.skip ?? 0))
    }

    if (args?.take !== undefined) {
      users = users.slice(0, args.take)
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

  private countUsers(args: CountUserArgs | undefined): number {
    return this.findStoredUsers(args).length
  }

  private findStoredUsers(args: CountUserArgs | undefined): User[] {
    return [...this.users.values()].filter((user) => {
      if (args?.where?.role !== undefined && user.role !== args.where.role) {
        return false
      }

      if (
        args?.where?.status !== undefined &&
        user.status !== args.where.status
      ) {
        return false
      }

      return true
    })
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
        (args.where.tokenHash === undefined ||
          refreshToken.tokenHash === args.where.tokenHash) &&
        (args.where.userId === undefined ||
          refreshToken.userId === args.where.userId) &&
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
    let memberships = this.memberships

    const userId = args?.where?.userId
    if (userId !== undefined) {
      memberships = memberships.filter((m) => m.userId === userId)
    }

    const courseId = args?.where?.courseId
    if (courseId !== undefined) {
      memberships = memberships.filter((m) => m.courseId === courseId)
    }

    return memberships.map((membership) => {
      if (args?.include?.course !== true) {
        return {
          ...membership,
          user: this.users.get(membership.userId),
        }
      }

      const course = this.courses.get(membership.courseId)

      if (!course) {
        throw new Error(`Missing course ${membership.courseId}`)
      }

      return {
        ...membership,
        user: this.users.get(membership.userId),
        course,
      }
    })
  }

  private findCourses(args: FindManyCourseArgs | undefined): StoredCourse[] {
    const courses = [...this.courses.values()]
    courses.sort((a, b) => a.code.localeCompare(b.code))
    return courses.map((course) => {
      const membershipUserId = args?.include?.memberships?.where?.userId

      let courseMemberships = this.memberships.filter(
        (membership) => membership.courseId === course.id,
      )

      if (membershipUserId !== undefined) {
        courseMemberships = courseMemberships.filter(
          (membership) => membership.userId === membershipUserId,
        )
      }

      return {
        ...course,
        memberships: courseMemberships.map((m) => ({
          ...m,
          user: this.users.get(m.userId),
        })),
        materials: [...this.materials.values()].filter(
          (m) => m.courseId === course.id,
        ),
      }
    })
  }

  private findCourse(args: FindUniqueCourseArgs): StoredCourse | null {
    const courseId = args.where.id
    const course = this.courses.get(courseId)

    if (!course) {
      return null
    }

    const memberships = this.memberships
      .filter((m) => m.courseId === courseId)
      .map((m) => ({
        ...m,
        user: this.users.get(m.userId),
      }))

    return {
      ...course,
      memberships,
      materials: [...this.materials.values()].filter(
        (m) => m.courseId === course.id,
      ),
    }
  }

  private findUniqueMembership(args: FindUniqueMembershipArgs) {
    const { courseId, userId } = args.where.courseId_userId
    const membership = this.memberships.find(
      (m) => m.courseId === courseId && m.userId === userId,
    )
    if (!membership) return null

    return {
      ...membership,
      user: this.users.get(membership.userId),
    }
  }

  private createMembership(args: CreateCourseMembershipArgs) {
    const sequence = this.nextMembershipSequence
    this.nextMembershipSequence += 1
    const membership: CourseMembership = {
      id: `00000000-0000-4000-8000-0000000002${sequence.toString().padStart(2, '0')}`,
      courseId: args.data.courseId,
      userId: args.data.userId,
      role: args.data.role,
      createdById: args.data.createdById,
      removedAt: null,
      createdAt: new Date('2026-07-06T12:00:00.000Z'),
    }

    const existing = this.memberships.findIndex(
      (m) =>
        m.courseId === membership.courseId && m.userId === membership.userId,
    )
    if (existing >= 0) {
      const error = new Error('Unique constraint failed') as Error & {
        code?: string
      }
      error.code = 'P2002'
      throw error
    }

    this.memberships.push(membership)
    return {
      ...membership,
      user: this.users.get(membership.userId),
    }
  }

  private deleteMembership(args: DeleteCourseMembershipArgs) {
    const { courseId, userId } = args.where.courseId_userId
    const index = this.memberships.findIndex(
      (m) => m.courseId === courseId && m.userId === userId,
    )
    if (index === -1) {
      throw new Error('Membership not found')
    }

    const [deleted] = this.memberships.splice(index, 1)
    return {
      ...deleted,
      user: this.users.get(deleted.userId),
    }
  }

  private updateMembership(args: UpdateCourseMembershipArgs) {
    const { courseId, userId } = args.where.courseId_userId
    const index = this.memberships.findIndex(
      (m) => m.courseId === courseId && m.userId === userId,
    )
    if (index === -1) {
      throw new Error('Membership not found')
    }

    const role = args.data.role
    const updated: CourseMembership = {
      ...this.memberships[index],
      role: role ?? this.memberships[index].role,
    }
    this.memberships[index] = updated
    return {
      ...updated,
      user: this.users.get(updated.userId),
    }
  }

  private findMaterials(
    args: FindManyMaterialArgs | undefined,
  ): StoredMaterial[] {
    let materials = [...this.materials.values()]

    const courseId = args?.where?.courseId
    if (courseId !== undefined) {
      materials = materials.filter((m) => m.courseId === courseId)
    }

    if (args?.where?.deletedAt === null) {
      materials = materials.filter((m) => m.deletedAt === null)
    }

    if (args?.orderBy?.createdAt === 'desc') {
      materials.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    return materials
  }

  private findFirstMaterial(
    args: FindFirstMaterialArgs | undefined,
  ): StoredMaterial | null {
    let materials = [...this.materials.values()]

    const id = args?.where?.id
    if (id !== undefined) {
      materials = materials.filter((m) => m.id === id)
    }

    const courseId = args?.where?.courseId
    if (courseId !== undefined) {
      materials = materials.filter((m) => m.courseId === courseId)
    }

    if (args?.where?.deletedAt === null) {
      materials = materials.filter((m) => m.deletedAt === null)
    }

    return materials[0] ?? null
  }

  private updateMaterial(args: UpdateMaterialArgs): StoredMaterial {
    const material = this.materials.get(args.where.id)
    if (!material) {
      throw new Error('Material not found')
    }

    const updated = {
      ...material,
      ...args.data,
      updatedAt: new Date('2026-07-06T12:00:00.000Z'),
    }
    this.materials.set(args.where.id, updated)
    return updated
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
