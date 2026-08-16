import type {
  AuditLog,
  Course,
  CourseMembership,
  CourseMembershipRole,
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
import type { PrismaService } from '../../src/platform/database/prisma.service'

type StoredCourseMembership = CourseMembership & { course?: Course }
type StoredCourse = Course & {
  createdBy?: User | null
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
    refreshTokens?: {
      where?: {
        familyId?: string
        revokedAt?: null | Date
        expiresAt?: { gt: Date }
      }
      take?: number
    }
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
      | 'email'
      | 'displayName'
      | 'role'
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
  data: {
    userId: string
    familyId?: string
    familyCreatedAt?: Date
    tokenHash: string
    expiresAt: Date
    ip: string | null
    userAgent: string | null
  }
}

interface FindFirstRefreshTokenArgs {
  where?: {
    userId?: string
    familyId?: string
    revokedAt?: null | Date
    expiresAt?: { gt: Date }
  }
}

interface FindManyRefreshTokenArgs {
  where?: {
    userId?: string
    familyId?: string
    revokedAt?: null | Date
    expiresAt?: { gt: Date }
  }
  orderBy?: {
    createdAt?: 'asc' | 'desc'
  }
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
    familyId?: string | { not: string }
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
    removedAt?: Date | null
  }
  include?: {
    course?: boolean
  }
  orderBy?: {
    role?: 'asc' | 'desc'
    user?: { email?: 'asc' | 'desc' }
  }[]
}

interface FindFirstMembershipArgs {
  where?: {
    userId?: string
    courseId?: string
    role?: CourseMembershipRole
    removedAt?: Date | null
  }
  select?: {
    id?: boolean
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
  select?: {
    memberships?: {
      where?: {
        userId?: string
        removedAt?: Date | null
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
  data: Partial<Pick<CourseMembership, 'role' | 'removedAt' | 'createdById'>>
}

interface UpdateManyCourseMembershipArgs {
  where: {
    courseId?: string
    userId?: string
    removedAt?: Date | null
  }
  data: Partial<Pick<CourseMembership, 'role' | 'removedAt' | 'createdById'>>
}

interface FindUniqueMembershipArgs {
  where: {
    courseId_userId: {
      courseId: string
      userId: string
    }
  }
}

interface FindUniqueMembershipByIdArgs {
  where: { id: string }
}

interface FindUniqueCourseArgs {
  where: {
    id?: string
    code?: string
  }
  select?: {
    memberships?: {
      where?: {
        userId?: string
        removedAt?: Date | null
      }
    }
  }
}

interface FindFirstCourseArgs {
  where?: {
    id?: string
    code?: string
    archivedAt?: Date | null
  }
  select?: {
    id?: boolean
    code?: boolean
    title?: boolean
    archivedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    memberships?: {
      where?: {
        userId?: string
        removedAt?: Date | null
      }
      select?: {
        role?: boolean
        user?: boolean
      }
      take?: number
    }
  }
  include?: {
    memberships?: {
      where?: {
        userId?: string
        removedAt?: Date | null
      }
    }
  }
}

interface CreateCourseArgs {
  data: Pick<Course, 'code' | 'title' | 'createdById'>
}

interface UpdateCourseArgs {
  where: {
    id: string
  }
  data: Partial<Pick<Course, 'code' | 'title'>>
}

interface FindManyMaterialArgs {
  where?: {
    courseId?: string
    deletedAt?: null | Date
    title?: { contains: string; mode?: 'insensitive' }
  }
  orderBy?:
    | { createdAt?: 'asc' | 'desc' }
    | { createdAt?: 'asc' | 'desc'; id?: 'asc' | 'desc' }[]
  cursor?: { id: string }
  skip?: number
  take?: number
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

interface UpdateManyMaterialArgs {
  where: {
    id?: string
    courseId?: string
    deletedAt?: Date | null
  }
  data: Partial<Pick<Material, 'title'>>
}

interface CreateMaterialArgs {
  data: Pick<
    Material,
    | 'courseId'
    | 'uploadedById'
    | 'title'
    | 'originalFilename'
    | 'storagePath'
    | 'sha256Hash'
    | 'status'
  >
}

interface DeleteMaterialArgs {
  where: {
    id: string
  }
}

export class IdentityTestStore {
  readonly users = new Map<string, User>()
  readonly studentTutoringPreferences = new Map<
    string,
    {
      id: string
      studentId: string
      explanationDetailLevel: string
      createdAt: Date
      updatedAt: Date
    }
  >()
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
  private nextCourseSequence = 1
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
      findFirst: jest.fn((args?: FindFirstRefreshTokenArgs) =>
        Promise.resolve(this.findFirstRefreshToken(args)),
      ),
      findMany: jest.fn((args?: FindManyRefreshTokenArgs) =>
        Promise.resolve(this.findManyRefreshTokens(args)),
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
      findUniqueOrThrow: jest.fn((args: FindUniqueMembershipByIdArgs) =>
        Promise.resolve(this.findUniqueMembershipById(args)),
      ),
      findFirst: jest.fn((args?: FindFirstMembershipArgs) =>
        Promise.resolve(this.findFirstMembership(args)),
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
      updateMany: jest.fn((args: UpdateManyCourseMembershipArgs) =>
        Promise.resolve(this.updateManyMemberships(args)),
      ),
    },
    course: {
      findUnique: jest.fn((args: FindUniqueCourseArgs) =>
        Promise.resolve(this.findCourse(args)),
      ),
      findFirst: jest.fn((args?: FindFirstCourseArgs) =>
        Promise.resolve(this.findFirstCourse(args)),
      ),
      findMany: jest.fn((args?: FindManyCourseArgs) =>
        Promise.resolve(this.findCourses(args)),
      ),
      create: jest.fn((args: CreateCourseArgs) =>
        Promise.resolve(this.createCourse(args)),
      ),
      update: jest.fn((args: UpdateCourseArgs) =>
        Promise.resolve(this.updateCourse(args)),
      ),
    },
    material: {
      findMany: jest.fn((args?: FindManyMaterialArgs) =>
        Promise.resolve(this.findMaterials(args)),
      ),
      findFirst: jest.fn((args?: FindFirstMaterialArgs) =>
        Promise.resolve(this.findFirstMaterial(args)),
      ),
      create: jest.fn((args: CreateMaterialArgs) =>
        Promise.resolve(this.createMaterial(args)),
      ),
      update: jest.fn((args: UpdateMaterialArgs) =>
        Promise.resolve(this.updateMaterial(args)),
      ),
      updateMany: jest.fn((args: UpdateManyMaterialArgs) =>
        Promise.resolve(this.updateManyMaterials(args)),
      ),
      delete: jest.fn((args: DeleteMaterialArgs) =>
        Promise.resolve(this.deleteMaterial(args)),
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
    studentTutoringPreference: {
      findUnique: jest.fn(
        (args: {
          where: { studentId: string }
          select?: { explanationDetailLevel?: boolean }
        }) => {
          const pref = this.studentTutoringPreferences.get(args.where.studentId)
          return Promise.resolve(
            pref ? { explanationDetailLevel: pref.explanationDetailLevel } : null,
          )
        },
      ),
      upsert: jest.fn(
        (args: {
          where: { studentId: string }
          create: { studentId: string; explanationDetailLevel: string }
          update: { explanationDetailLevel: string }
          select?: { explanationDetailLevel?: boolean }
        }) => {
          const existing = this.studentTutoringPreferences.get(
            args.where.studentId,
          )
          const record = {
            id:
              existing?.id ??
              `00000000-0000-4000-8000-00000000070${(this.studentTutoringPreferences.size + 1).toString()}`,
            studentId: args.where.studentId,
            explanationDetailLevel:
              args.update.explanationDetailLevel ??
              args.create.explanationDetailLevel,
            createdAt: existing?.createdAt ?? new Date(),
            updatedAt: new Date(),
          }
          this.studentTutoringPreferences.set(args.where.studentId, record)
          return Promise.resolve({
            explanationDetailLevel: record.explanationDetailLevel,
          })
        },
      ),
    },
    $queryRaw: jest.fn((query: TemplateStringsArray, ...values: string[]) => {
      const sql = query.join(' ')
      if (sql.includes('FROM course_memberships')) {
        const [courseId, userId] = values
        const membership = this.memberships.find(
          (candidate) =>
            candidate.courseId === courseId &&
            candidate.userId === userId &&
            candidate.removedAt === null,
        )
        return Promise.resolve(membership ? [{ id: membership.id }] : [])
      }

      const [userId] = values
      const user = this.users.get(userId)
      return Promise.resolve(user ? [{ ...user }] : [])
    }),
    $transaction: jest.fn(
      async <T>(fn: (tx: IdentityTestStore['prisma']) => Promise<T>) =>
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
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    this.courses.set(hiddenCourseId, {
      id: hiddenCourseId,
      code: P0_HIDDEN_ISOLATION_COURSE.code,
      title: P0_HIDDEN_ISOLATION_COURSE.title,
      createdById: null,
      archivedAt: null,
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
      processingAttemptId: null,
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

  private findUser(
    args: FindUniqueArgs,
  ): (User & { refreshTokens?: RefreshToken[] }) | null {
    let user: User | null = null

    if (args.where.id !== undefined) {
      user = this.users.get(args.where.id) ?? null
    } else if (args.where.email !== undefined) {
      user = this.findUserByEmail(args.where.email)
    }

    if (!user) {
      return null
    }

    if (args.include?.refreshTokens) {
      const filter = args.include.refreshTokens.where
      let tokens = [...this.refreshTokens.values()].filter(
        (t) => t.userId === user.id,
      )
      if (filter?.familyId !== undefined) {
        tokens = tokens.filter((t) => t.familyId === filter.familyId)
      }
      if (filter?.revokedAt !== undefined) {
        tokens = tokens.filter((t) => t.revokedAt === filter.revokedAt)
      }
      if (filter?.expiresAt?.gt !== undefined) {
        const minExpiry = filter.expiresAt.gt
        tokens = tokens.filter((t) => t.expiresAt > minExpiry)
      }
      if (args.include.refreshTokens.take !== undefined) {
        tokens = tokens.slice(0, args.include.refreshTokens.take)
      }
      return {
        ...user,
        refreshTokens: tokens,
      }
    }

    return user
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
      ...(args.data.lastLoginAt === undefined
        ? {}
        : { lastLoginAt: args.data.lastLoginAt }),
      ...(args.data.status === undefined ? {} : { status: args.data.status }),
      ...(args.data.disabledAt === undefined
        ? {}
        : { disabledAt: args.data.disabledAt }),
      ...(args.data.disabledById === undefined
        ? {}
        : { disabledById: args.data.disabledById }),
      ...(args.data.passwordHash === undefined
        ? {}
        : { passwordHash: args.data.passwordHash }),
      ...(args.data.passwordChangedAt === undefined
        ? {}
        : { passwordChangedAt: args.data.passwordChangedAt }),
      ...(args.data.email === undefined ? {} : { email: args.data.email }),
      ...(args.data.displayName === undefined
        ? {}
        : { displayName: args.data.displayName }),
      ...(args.data.role === undefined ? {} : { role: args.data.role }),
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

    const familyId =
      args.data.familyId ??
      `00000000-0000-4000-8000-00000000090${sequence.toString()}`
    const familyCreatedAt =
      args.data.familyCreatedAt ?? new Date('2026-07-06T12:00:00.000Z')

    const refreshToken: RefreshToken = {
      id: `00000000-0000-4000-8000-00000000030${sequence.toString()}`,
      userId: args.data.userId,
      familyId,
      familyCreatedAt,
      tokenHash: args.data.tokenHash,
      expiresAt: args.data.expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
      ip: args.data.ip,
      userAgent: args.data.userAgent,
      createdAt: new Date(),
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

  private findFirstRefreshToken(
    args?: FindFirstRefreshTokenArgs,
  ): RefreshToken | null {
    for (const token of this.refreshTokens.values()) {
      if (
        args?.where?.userId !== undefined &&
        token.userId !== args.where.userId
      ) {
        continue
      }
      if (
        args?.where?.familyId !== undefined &&
        token.familyId !== args.where.familyId
      ) {
        continue
      }
      if (
        args?.where?.revokedAt !== undefined &&
        token.revokedAt !== args.where.revokedAt
      ) {
        continue
      }
      if (
        args?.where?.expiresAt?.gt !== undefined &&
        token.expiresAt <= args.where.expiresAt.gt
      ) {
        continue
      }
      return token
    }
    return null
  }

  private findManyRefreshTokens(
    args?: FindManyRefreshTokenArgs,
  ): RefreshToken[] {
    const tokens = [...this.refreshTokens.values()].filter((token) => {
      if (
        args?.where?.userId !== undefined &&
        token.userId !== args.where.userId
      ) {
        return false
      }
      if (
        args?.where?.familyId !== undefined &&
        token.familyId !== args.where.familyId
      ) {
        return false
      }
      if (
        args?.where?.revokedAt !== undefined &&
        token.revokedAt !== args.where.revokedAt
      ) {
        return false
      }
      if (
        args?.where?.expiresAt?.gt !== undefined &&
        token.expiresAt <= args.where.expiresAt.gt
      ) {
        return false
      }
      return true
    })

    if (args?.orderBy?.createdAt === 'desc') {
      tokens.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    return tokens
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
      const matchesFamily =
        args.where.familyId === undefined ||
        (typeof args.where.familyId === 'string'
          ? refreshToken.familyId === args.where.familyId
          : refreshToken.familyId !== args.where.familyId.not)

      const isMatch =
        (args.where.id === undefined || refreshToken.id === args.where.id) &&
        (args.where.tokenHash === undefined ||
          refreshToken.tokenHash === args.where.tokenHash) &&
        (args.where.userId === undefined ||
          refreshToken.userId === args.where.userId) &&
        matchesFamily &&
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

    if (args?.where?.removedAt === null) {
      memberships = memberships.filter((m) => m.removedAt === null)
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

      const selectedMemberships = args?.select?.memberships?.where
      const selectedUserId = selectedMemberships?.userId ?? membershipUserId

      if (selectedUserId !== undefined) {
        courseMemberships = courseMemberships.filter(
          (membership) => membership.userId === selectedUserId,
        )
      }

      if (selectedMemberships?.removedAt !== undefined) {
        courseMemberships = courseMemberships.filter(
          (membership) =>
            membership.removedAt === selectedMemberships.removedAt,
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

  private findFirstCourse(args?: FindFirstCourseArgs): StoredCourse | null {
    const where = args?.where
    const course = [...this.courses.values()].find((c) => {
      if (where?.id !== undefined && c.id !== where.id) return false
      if (where?.code !== undefined && c.code !== where.code) return false
      if (where?.archivedAt !== undefined) {
        if (where.archivedAt === null && c.archivedAt !== null) return false
        if (
          where.archivedAt !== null &&
          c.archivedAt?.getTime() !== where.archivedAt.getTime()
        )
          return false
      }
      return true
    })

    if (!course) {
      return null
    }

    const membershipUserId = args?.include?.memberships?.where?.userId
    let courseMemberships = this.memberships.filter(
      (membership) => membership.courseId === course.id,
    )

    const selectedMemberships = args?.select?.memberships?.where
    const selectedUserId = selectedMemberships?.userId ?? membershipUserId

    if (selectedUserId !== undefined) {
      courseMemberships = courseMemberships.filter(
        (membership) => membership.userId === selectedUserId,
      )
    }

    if (selectedMemberships?.removedAt !== undefined) {
      courseMemberships = courseMemberships.filter(
        (membership) => membership.removedAt === selectedMemberships.removedAt,
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
  }

  private findCourse(args: FindUniqueCourseArgs): StoredCourse | null {
    const course =
      args.where.id !== undefined
        ? this.courses.get(args.where.id)
        : [...this.courses.values()].find(
            (candidate) => candidate.code === args.where.code,
          )

    if (!course) {
      return null
    }

    const courseId = course.id
    const selectedMemberships = args.select?.memberships?.where
    const memberships = this.memberships
      .filter((m) => m.courseId === courseId)
      .filter(
        (m) =>
          selectedMemberships?.userId === undefined ||
          m.userId === selectedMemberships.userId,
      )
      .filter(
        (m) =>
          selectedMemberships?.removedAt === undefined ||
          m.removedAt === selectedMemberships.removedAt,
      )
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

  private createCourse(args: CreateCourseArgs): StoredCourse {
    if (
      [...this.courses.values()].some(
        (course) => course.code === args.data.code,
      )
    ) {
      const error = new Error('Unique constraint failed') as Error & {
        code?: string
      }
      error.code = 'P2002'
      throw error
    }

    const sequence = this.nextCourseSequence
    this.nextCourseSequence += 1
    const now = new Date('2026-07-06T12:00:00.000Z')
    const course: Course = {
      id: `00000000-0000-4000-8000-0000000007${sequence
        .toString()
        .padStart(2, '0')}`,
      code: args.data.code,
      title: args.data.title,
      createdById: args.data.createdById,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    this.courses.set(course.id, course)
    return {
      ...course,
      createdBy: this.users.get(course.createdById ?? '') ?? null,
      memberships: [],
      materials: [],
    }
  }

  private updateCourse(args: UpdateCourseArgs): StoredCourse {
    const course = this.courses.get(args.where.id)
    if (!course) {
      throw new Error(`Missing course ${args.where.id}`)
    }

    const updated = {
      ...course,
      ...(args.data.code === undefined ? {} : { code: args.data.code }),
      ...(args.data.title === undefined ? {} : { title: args.data.title }),
      updatedAt: new Date('2026-07-06T12:00:00.000Z'),
    }
    this.courses.set(course.id, updated)
    const updatedCourse = this.findCourse({ where: { id: course.id } })
    if (!updatedCourse) {
      throw new Error(`Missing updated course ${course.id}`)
    }
    return updatedCourse
  }

  private findFirstMembership(
    args: FindFirstMembershipArgs | undefined,
  ): (StoredCourseMembership & { user?: User }) | null {
    const where = args?.where
    const membership = this.memberships.find(
      (m) =>
        (where?.courseId === undefined || m.courseId === where.courseId) &&
        (where?.userId === undefined || m.userId === where.userId) &&
        (where?.role === undefined || m.role === where.role) &&
        (where?.removedAt === undefined || m.removedAt === where.removedAt),
    )

    return membership
      ? { ...membership, user: this.users.get(membership.userId) }
      : null
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

  private findUniqueMembershipById(args: FindUniqueMembershipByIdArgs) {
    const membership = this.memberships.find(
      (candidate) => candidate.id === args.where.id,
    )
    if (!membership) {
      throw new Error(`Missing course membership ${args.where.id}`)
    }

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

    const current = this.memberships[index]
    const updated: CourseMembership = {
      ...current,
      role: args.data.role ?? current.role,
      removedAt:
        args.data.removedAt === undefined
          ? current.removedAt
          : args.data.removedAt,
      createdById:
        args.data.createdById === undefined
          ? current.createdById
          : args.data.createdById,
    }
    this.memberships[index] = updated
    return {
      ...updated,
      user: this.users.get(updated.userId),
    }
  }

  private updateManyMemberships(args: UpdateManyCourseMembershipArgs) {
    const matches = this.memberships.filter((membership) => {
      const matchesCourse =
        args.where.courseId === undefined ||
        membership.courseId === args.where.courseId
      const matchesUser =
        args.where.userId === undefined ||
        membership.userId === args.where.userId
      const matchesRemovedAt =
        args.where.removedAt === undefined ||
        (args.where.removedAt === null
          ? membership.removedAt === null
          : membership.removedAt?.getTime() === args.where.removedAt.getTime())

      return matchesCourse && matchesUser && matchesRemovedAt
    })

    for (const membership of matches) {
      const index = this.memberships.indexOf(membership)
      this.memberships[index] = {
        ...membership,
        ...args.data,
      }
    }

    return { count: matches.length }
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

    const titleSearch = args?.where?.title?.contains.toLocaleLowerCase()
    if (titleSearch !== undefined) {
      materials = materials.filter((m) =>
        m.title.toLocaleLowerCase().includes(titleSearch),
      )
    }

    const createdAtOrder = Array.isArray(args?.orderBy)
      ? args.orderBy.find((order) => order.createdAt !== undefined)?.createdAt
      : args?.orderBy?.createdAt

    if (createdAtOrder === 'desc') {
      materials.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }

    if (args?.cursor !== undefined) {
      const cursorIndex = materials.findIndex(
        (material) => material.id === args.cursor?.id,
      )
      materials =
        cursorIndex < 0 ? [] : materials.slice(cursorIndex + (args.skip ?? 0))
    }

    if (args?.take !== undefined) {
      materials = materials.slice(0, args.take)
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

  private updateManyMaterials(args: UpdateManyMaterialArgs) {
    const matches = [...this.materials.values()].filter((material) => {
      const matchesId =
        args.where.id === undefined || material.id === args.where.id
      const matchesCourse =
        args.where.courseId === undefined ||
        material.courseId === args.where.courseId
      const matchesDeletedAt =
        args.where.deletedAt === undefined ||
        (args.where.deletedAt === null
          ? material.deletedAt === null
          : material.deletedAt?.getTime() === args.where.deletedAt.getTime())

      return matchesId && matchesCourse && matchesDeletedAt
    })

    for (const material of matches) {
      this.materials.set(material.id, {
        ...material,
        ...args.data,
        updatedAt: new Date('2026-07-06T12:00:00.000Z'),
      })
    }

    return { count: matches.length }
  }

  private createMaterial(args: CreateMaterialArgs): StoredMaterial {
    const sequence = this.nextMaterialSequence
    this.nextMaterialSequence += 1
    const now = new Date('2026-07-06T12:00:00.000Z')
    const material: Material = {
      id: `00000000-0000-4000-8000-0000000006${sequence.toString().padStart(2, '0')}`,
      courseId: args.data.courseId,
      uploadedById: args.data.uploadedById,
      title: args.data.title,
      originalFilename: args.data.originalFilename,
      storagePath: args.data.storagePath,
      sha256Hash: args.data.sha256Hash,
      status: args.data.status,
      processingAttemptId: null,
      extractedTextLength: null,
      chunkCount: null,
      errorMessage: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    this.materials.set(material.id, material)

    return material
  }

  private deleteMaterial(args: DeleteMaterialArgs): StoredMaterial {
    const material = this.materials.get(args.where.id)
    if (!material) {
      throw new Error('Material not found')
    }

    this.materials.delete(args.where.id)

    return material
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
