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
  P0_DEMO_UNIVERSITY,
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
type StoredRefreshToken = RefreshToken & {
  user?: User & { university?: { status: string } | null }
}
type StoredMaterial = Material

interface FindUniqueArgs {
  where: {
    email?: string
    id?: string
    tokenHash?: string
  }
  include?: {
    user?:
      boolean | { include?: { university?: { select?: { status?: boolean } } } }
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
  data: Pick<
    User,
    'email' | 'displayName' | 'role' | 'status' | 'passwordHash'
  > & {
    universityId?: string | null
  }
}

interface FindManyUserArgs {
  where?: {
    role?: User['role']
    status?: User['status']
    OR?: {
      id?: { in?: string[] }
      email?: { in?: string[]; mode?: 'insensitive' }
    }[]
  }
  select?: {
    id?: boolean
    email?: boolean
    displayName?: boolean
    role?: boolean
    status?: boolean
    memberships?:
      | boolean
      | {
          where?: {
            courseId?: { in?: string[] }
            removedAt?: null | Date
          }
          select?: { courseId?: boolean }
        }
  }
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
    userId?: string | { in?: string[] }
    courseId?: string | { in?: string[] }
    removedAt?: Date | null
  }
  select?: {
    id?: boolean
    courseId?: boolean
    userId?: boolean
    removedAt?: boolean
    role?: boolean
    createdAt?: boolean
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
  data: Pick<Course, 'code' | 'title' | 'createdById'> & {
    universityId?: string
  }
}

interface UpdateCourseArgs {
  where: {
    id: string
  }
  data: Partial<Pick<Course, 'code' | 'title'>>
}

interface CountMaterialArgs {
  where?: {
    courseId?: string
    deletedAt?: null | Date
    title?: { contains: string; mode?: 'insensitive' }
  }
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
    sha256Hash?: string
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
    status?: Material['status']
    processingAttemptId?: string | null
  }
  data: Partial<Material>
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

interface FindUniqueUniversityArgs {
  where: {
    id?: string
    code?: string
    ownerId?: string
  }
  select?: {
    id?: boolean
    name?: boolean
    code?: boolean
    status?: boolean
    ownerId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    owner?: boolean | { select?: Prisma.UserSelect }
    _count?: boolean | { select?: { courses?: boolean; users?: boolean } }
  }
}

interface FindFirstUniversityArgs {
  where?: {
    id?: string
    code?: string | { equals: string; mode?: 'insensitive' }
    ownerId?: string
    NOT?: { id?: string }
  }
  select?: FindUniqueUniversityArgs['select']
}

interface FindManyUniversityArgs {
  where?: {
    id?: string | { in?: string[] }
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
    search?: string
    OR?: {
      name?: { contains: string; mode?: 'insensitive' }
      code?: { contains: string; mode?: 'insensitive' }
      owner?: {
        displayName?: { contains: string; mode?: 'insensitive' }
        email?: { contains: string; mode?: 'insensitive' }
      }
    }[]
  }
  orderBy?: {
    createdAt?: 'asc' | 'desc'
    updatedAt?: 'asc' | 'desc'
    name?: 'asc' | 'desc'
    code?: 'asc' | 'desc'
    status?: 'asc' | 'desc'
    studentsCount?: 'asc' | 'desc'
    id?: 'asc' | 'desc'
  }[]
  skip?: number
  take?: number
  select?: FindUniqueUniversityArgs['select']
}

interface CountUniversityArgs {
  where?: FindManyUniversityArgs['where']
}

interface CreateUniversityArgs {
  data: {
    name: string
    code: string
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
    ownerId?: string | null
  }
  select?: FindUniqueUniversityArgs['select']
}

interface UpdateUniversityArgs {
  where: {
    id: string
  }
  data: {
    name?: string
    code?: string
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
    ownerId?: string | null
  }
  select?: FindUniqueUniversityArgs['select']
}

interface GroupByUserArgs {
  by: ('universityId' | 'role')[]
  where?: {
    universityId?: string | { in: string[] }
    role?: { in: User['role'][] }
  }
  _count?: { _all?: boolean }
}

export class IdentityTestStore {
  readonly users = new Map<string, User>()
  readonly universities = new Map<
    string,
    {
      id: string
      name: string
      code: string
      status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
      ownerId: string | null
      createdAt: Date
      updatedAt: Date
    }
  >()
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
  private nextUniversitySequence = 1
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
      groupBy: jest.fn((args: GroupByUserArgs) =>
        Promise.resolve(this.groupByUsers(args)),
      ),
    },
    university: {
      findUnique: jest.fn((args: FindUniqueUniversityArgs) =>
        Promise.resolve(this.findUniversity(args)),
      ),
      findFirst: jest.fn((args?: FindFirstUniversityArgs) =>
        Promise.resolve(this.findFirstUniversity(args)),
      ),
      findMany: jest.fn((args?: FindManyUniversityArgs) =>
        Promise.resolve(this.findManyUniversities(args)),
      ),
      count: jest.fn((args?: CountUniversityArgs) =>
        Promise.resolve(this.countUniversities(args)),
      ),
      create: jest.fn((args: CreateUniversityArgs) =>
        Promise.resolve(this.createUniversity(args)),
      ),
      update: jest.fn((args: UpdateUniversityArgs) =>
        Promise.resolve(this.updateUniversity(args)),
      ),
    },
    universitySubscription: {
      findUnique: jest.fn(() => Promise.resolve(null)),
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
      create: jest.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: '00000000-0000-4000-8000-000000000888',
          ...args.data,
        }),
      ),
      update: jest.fn(
        (args: { where: { id: string }; data: Record<string, unknown> }) =>
          Promise.resolve({
            id: args.where.id,
            ...args.data,
          }),
      ),
    },
    globalPricingConfig: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          id: 'default',
          defaultPricePerSeat: 10,
          currency: 'USD',
        }),
      ),
      findFirst: jest.fn(() =>
        Promise.resolve({
          id: 'default',
          defaultPricePerSeat: 10,
          currency: 'USD',
        }),
      ),
      upsert: jest.fn(() =>
        Promise.resolve({
          id: 'default',
          defaultPricePerSeat: 10,
          currency: 'USD',
        }),
      ),
    },
    subscriptionInvoice: {
      findMany: jest.fn(() => Promise.resolve([])),
      findFirst: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: '00000000-0000-4000-8000-000000000889',
          ...args.data,
        }),
      ),
    },
    universityMonthlyUsage: {
      findMany: jest.fn(() => Promise.resolve([])),
      upsert: jest.fn(
        (args: {
          create: Record<string, unknown>
          update: Record<string, unknown>
        }) =>
          Promise.resolve({
            id: '00000000-0000-4000-8000-000000000890',
            ...args.create,
          }),
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
      count: jest.fn((args?: CountMaterialArgs) =>
        Promise.resolve(this.countMaterials(args)),
      ),
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
            pref
              ? { explanationDetailLevel: pref.explanationDetailLevel }
              : null,
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
            explanationDetailLevel: existing
              ? args.update.explanationDetailLevel
              : args.create.explanationDetailLevel,
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

      if (sql.includes('COUNT(DISTINCT u.id)')) {
        const matchingCount = this.universities.size
        return Promise.resolve([{ count: BigInt(matchingCount) }])
      }

      if (
        sql.includes('COUNT(usr.id) FILTER') ||
        sql.includes('student_count')
      ) {
        const list = [...this.universities.values()].map((u) => {
          const studentCount = [...this.users.values()].filter(
            (usr) => usr.universityId === u.id && usr.role === 'STUDENT',
          ).length
          return { id: u.id, student_count: studentCount }
        })
        const isAsc = sql.includes('ASC')
        list.sort((a, b) =>
          isAsc
            ? a.student_count - b.student_count
            : b.student_count - a.student_count,
        )
        return Promise.resolve(list)
      }

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

      if (sql.includes('FROM users') && sql.includes("role = 'ADMIN'")) {
        const activeAdmins = [...this.users.values()]
          .filter((u) => u.role === 'ADMIN' && u.status === 'ACTIVE')
          .map((u) => ({ id: u.id }))
        return Promise.resolve(activeAdmins)
      }

      const [userId] = values
      const user = this.users.get(userId)
      if (!user) {
        return Promise.resolve([])
      }
      const university =
        user.universityId !== null
          ? (this.universities.get(user.universityId) ?? null)
          : null
      return Promise.resolve([
        {
          ...user,
          universityStatus: university?.status ?? null,
        },
      ])
    }),
    $executeRaw: jest.fn(() => Promise.resolve(0)),
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

  setUniversityStatus(
    universityId: string,
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  ) {
    const uni = this.universities.get(universityId)
    if (!uni) {
      throw new Error(`Missing test university ${universityId}`)
    }
    this.universities.set(universityId, {
      ...uni,
      status,
      updatedAt: new Date(),
    })
  }

  simulateNextActiveRefreshTokenRevokeRace() {
    this.failNextActiveRefreshTokenRevoke = true
  }

  private seedP0DemoData() {
    const now = new Date('2026-07-06T00:00:00.000Z')
    const demoUniversityId = '00000000-0000-4000-8000-000000000000'
    const adminId = '00000000-0000-4000-8000-000000000002'
    const instructorId = '00000000-0000-4000-8000-000000000003'
    const pythonCourseId = '00000000-0000-4000-8000-000000000101'
    const hiddenCourseId = '00000000-0000-4000-8000-000000000102'

    this.universities.set(demoUniversityId, {
      id: demoUniversityId,
      name: P0_DEMO_UNIVERSITY.name,
      code: P0_DEMO_UNIVERSITY.code,
      status: 'ACTIVE',
      ownerId: adminId,
      createdAt: now,
      updatedAt: now,
    })

    for (const [index, seedUser] of P0_DEMO_USERS.entries()) {
      const id = `00000000-0000-4000-8000-00000000000${(index + 1).toString()}`
      this.users.set(id, {
        id,
        email: seedUser.email,
        displayName: seedUser.displayName,
        role: seedUser.role,
        status: 'ACTIVE',
        universityId: seedUser.role === 'SUPER_ADMIN' ? null : demoUniversityId,
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
      universityId: demoUniversityId,
      code: P0_DEMO_COURSE.code,
      title: P0_DEMO_COURSE.title,
      createdById: instructorId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    this.courses.set(hiddenCourseId, {
      id: hiddenCourseId,
      universityId: demoUniversityId,
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

    const university =
      user.universityId !== null
        ? (this.universities.get(user.universityId) ?? null)
        : null

    const userWithUniversity = {
      ...user,
      university: university ? { status: university.status } : null,
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
        ...userWithUniversity,
        refreshTokens: tokens,
      }
    }

    return userWithUniversity
  }

  private findUsers(args: FindManyUserArgs | undefined) {
    let users = [...this.users.values()]

    if (args?.where) {
      const { role, status, OR } = args.where
      users = users.filter((user) => {
        if (role !== undefined && user.role !== role) return false
        if (status !== undefined && user.status !== status) return false
        if (OR !== undefined && OR.length > 0) {
          const matchesOr = OR.some((condition) => {
            if (condition.id?.in !== undefined) {
              if (
                condition.id.in.some(
                  (id) => id.toLowerCase() === user.id.toLowerCase(),
                )
              ) {
                return true
              }
            }
            if (condition.email?.in !== undefined) {
              if (
                condition.email.in.some(
                  (email) => email.toLowerCase() === user.email.toLowerCase(),
                )
              ) {
                return true
              }
            }
            return false
          })
          if (!matchesOr) return false
        }
        return true
      })
    }

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

    return users.map((user) => {
      const membershipsSelect = args?.select?.memberships
      let userMemberships = this.memberships.filter(
        (membership) => membership.userId === user.id,
      )

      if (
        membershipsSelect !== undefined &&
        typeof membershipsSelect === 'object' &&
        'where' in membershipsSelect &&
        membershipsSelect.where !== undefined
      ) {
        const whereM = membershipsSelect.where
        if (whereM.courseId?.in !== undefined) {
          const inIds = whereM.courseId.in
          userMemberships = userMemberships.filter((m) =>
            inIds.includes(m.courseId),
          )
        }
        if (whereM.removedAt === null) {
          userMemberships = userMemberships.filter((m) => m.removedAt === null)
        }
      }

      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        memberships: userMemberships.map((membership) => {
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
      }
    })
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

    const university =
      updated.universityId !== null
        ? (this.universities.get(updated.universityId) ?? null)
        : null

    return {
      ...updated,
      university: university ? { status: university.status } : null,
    } as unknown as User
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
      universityId:
        args.data.universityId ??
        (args.data.role === 'SUPER_ADMIN'
          ? null
          : '00000000-0000-4000-8000-000000000000'),
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

    if (args.include?.user !== undefined) {
      const user = this.users.get(refreshToken.userId)

      if (!user) {
        throw new Error(`Missing token user ${refreshToken.userId}`)
      }

      const university =
        user.universityId !== null
          ? (this.universities.get(user.universityId) ?? null)
          : null

      return {
        ...refreshToken,
        user: {
          ...user,
          university: university ? { status: university.status } : null,
        },
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
      if (typeof userId === 'string') {
        memberships = memberships.filter((m) => m.userId === userId)
      } else if (
        typeof userId === 'object' &&
        'in' in userId &&
        Array.isArray(userId.in)
      ) {
        const userIds = userId.in
        memberships = memberships.filter((m) => userIds.includes(m.userId))
      }
    }

    const courseId = args?.where?.courseId
    if (courseId !== undefined) {
      if (typeof courseId === 'string') {
        memberships = memberships.filter((m) => m.courseId === courseId)
      } else if (
        typeof courseId === 'object' &&
        'in' in courseId &&
        Array.isArray(courseId.in)
      ) {
        const courseIds = courseId.in
        memberships = memberships.filter((m) => courseIds.includes(m.courseId))
      }
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
      universityId:
        args.data.universityId ?? '00000000-0000-4000-8000-000000000000',
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

  private countMaterials(args: CountMaterialArgs | undefined): number {
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

    return materials.length
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

    const sha256Hash = args?.where?.sha256Hash
    if (sha256Hash !== undefined) {
      materials = materials.filter((m) => m.sha256Hash === sha256Hash)
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
      const matchesStatus =
        args.where.status === undefined || material.status === args.where.status
      const matchesProcessingAttempt =
        args.where.processingAttemptId === undefined ||
        material.processingAttemptId === args.where.processingAttemptId

      return (
        matchesId &&
        matchesCourse &&
        matchesDeletedAt &&
        matchesStatus &&
        matchesProcessingAttempt
      )
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

  private formatUniversityOutput(
    uni: {
      id: string
      name: string
      code: string
      status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
      ownerId: string | null
      createdAt: Date
      updatedAt: Date
    },
    select?: FindUniqueUniversityArgs['select'],
  ) {
    const owner =
      uni.ownerId !== null ? (this.users.get(uni.ownerId) ?? null) : null
    const courseCount = [...this.courses.values()].filter(
      (c) => c.universityId === uni.id && c.archivedAt === null,
    ).length

    const result: Record<string, unknown> = {
      id: uni.id,
      name: uni.name,
      code: uni.code,
      status: uni.status,
      ownerId: uni.ownerId,
      createdAt: uni.createdAt,
      updatedAt: uni.updatedAt,
      owner:
        owner !== null
          ? {
              id: owner.id,
              displayName: owner.displayName,
              email: owner.email,
              status: owner.status,
            }
          : null,
      _count: {
        courses: courseCount,
      },
    }

    if (select !== undefined) {
      const filtered: Record<string, unknown> = {}
      if (select.id === true) filtered.id = result.id
      if (select.name === true) filtered.name = result.name
      if (select.code === true) filtered.code = result.code
      if (select.status === true) filtered.status = result.status
      if (select.ownerId === true) filtered.ownerId = result.ownerId
      if (select.createdAt === true) filtered.createdAt = result.createdAt
      if (select.updatedAt === true) filtered.updatedAt = result.updatedAt
      if (select.owner !== undefined && select.owner !== false)
        filtered.owner = result.owner
      if (select._count !== undefined && select._count !== false)
        filtered._count = result._count
      return filtered
    }

    return result
  }

  private findUniversity(args: FindUniqueUniversityArgs) {
    let uni: {
      id: string
      name: string
      code: string
      status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
      ownerId: string | null
      createdAt: Date
      updatedAt: Date
    } | null = null

    if (args.where.id !== undefined) {
      uni = this.universities.get(args.where.id) ?? null
    } else if (args.where.code !== undefined) {
      const code = args.where.code
      uni =
        [...this.universities.values()].find(
          (u) => u.code.toLowerCase() === code.toLowerCase(),
        ) ?? null
    } else if (args.where.ownerId !== undefined) {
      uni =
        [...this.universities.values()].find(
          (u) => u.ownerId === args.where.ownerId,
        ) ?? null
    }

    if (!uni) return null
    return this.formatUniversityOutput(uni, args.select)
  }

  private findFirstUniversity(args: FindFirstUniversityArgs | undefined) {
    if (!args) {
      const first = this.universities.values().next().value
      return first ? this.formatUniversityOutput(first) : null
    }

    const where = args.where
    const notId = where?.NOT?.id

    const match = [...this.universities.values()].find((u) => {
      if (notId !== undefined && u.id === notId) return false
      if (where?.id !== undefined && u.id !== where.id) return false
      if (where?.ownerId !== undefined && u.ownerId !== where.ownerId)
        return false
      if (where?.code !== undefined) {
        const expectedCode =
          typeof where.code === 'string' ? where.code : where.code.equals
        if (u.code.toLowerCase() !== expectedCode.toLowerCase()) return false
      }
      return true
    })

    if (!match) return null
    return this.formatUniversityOutput(match, args.select)
  }

  private matchesUniversityWhere(
    uni: {
      id: string
      name: string
      code: string
      status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
      ownerId: string | null
      createdAt: Date
      updatedAt: Date
    },
    where?: FindManyUniversityArgs['where'],
  ): boolean {
    if (where === undefined) return true
    if (where.id !== undefined) {
      if (typeof where.id === 'string') {
        if (uni.id !== where.id) return false
      } else if (Array.isArray(where.id.in) && !where.id.in.includes(uni.id)) {
        return false
      }
    }
    if (where.status !== undefined && uni.status !== where.status) return false
    if (where.OR !== undefined && where.OR.length > 0) {
      const owner =
        uni.ownerId !== null ? this.users.get(uni.ownerId) : undefined
      const matched = where.OR.some((clause) => {
        if (clause.name?.contains !== undefined) {
          if (
            uni.name.toLowerCase().includes(clause.name.contains.toLowerCase())
          ) {
            return true
          }
        }
        if (clause.code?.contains !== undefined) {
          if (
            uni.code.toLowerCase().includes(clause.code.contains.toLowerCase())
          ) {
            return true
          }
        }
        if (clause.owner?.displayName?.contains !== undefined) {
          if (
            owner?.displayName
              .toLowerCase()
              .includes(clause.owner.displayName.contains.toLowerCase()) ===
            true
          ) {
            return true
          }
        }
        if (clause.owner?.email?.contains !== undefined) {
          if (
            owner?.email
              .toLowerCase()
              .includes(clause.owner.email.contains.toLowerCase()) === true
          ) {
            return true
          }
        }
        return false
      })
      if (!matched) return false
    }
    return true
  }

  private findManyUniversities(args?: FindManyUniversityArgs) {
    let list = [...this.universities.values()].filter((u) =>
      this.matchesUniversityWhere(u, args?.where),
    )

    if (args?.orderBy && args.orderBy.length > 0) {
      const order = args.orderBy[0]
      const key = Object.keys(order)[0] as
        | 'createdAt'
        | 'updatedAt'
        | 'name'
        | 'code'
        | 'status'
        | 'studentsCount'
        | 'id'
      const dir = order[key] === 'asc' ? 1 : -1
      list.sort((a, b) => {
        if (key === 'studentsCount') {
          const countA = [...this.users.values()].filter(
            (usr) => usr.universityId === a.id && usr.role === 'STUDENT',
          ).length
          const countB = [...this.users.values()].filter(
            (usr) => usr.universityId === b.id && usr.role === 'STUDENT',
          ).length
          if (countA < countB) return -1 * dir
          if (countA > countB) return 1 * dir
          return 0
        }
        const valA = a[key]
        const valB = b[key]
        if (valA < valB) return -1 * dir
        if (valA > valB) return 1 * dir
        return 0
      })
    }

    if (args?.skip !== undefined) {
      list = list.slice(args.skip)
    }
    if (args?.take !== undefined) {
      list = list.slice(0, args.take)
    }

    return list.map((u) => this.formatUniversityOutput(u, args?.select))
  }

  private countUniversities(args?: CountUniversityArgs) {
    const list = [...this.universities.values()].filter((u) =>
      this.matchesUniversityWhere(u, args?.where),
    )
    return list.length
  }

  private createUniversity(args: CreateUniversityArgs) {
    const code = args.data.code.toUpperCase()
    if (
      [...this.universities.values()].some((u) => u.code.toUpperCase() === code)
    ) {
      const error = new Error('Unique constraint failed') as Error & {
        code?: string
        meta?: { target?: string[] }
      }
      error.code = 'P2002'
      error.meta = { target: ['code'] }
      throw error
    }

    const sequence = this.nextUniversitySequence
    this.nextUniversitySequence += 1
    const id = `00000000-0000-4000-8000-0000000009${sequence
      .toString()
      .padStart(2, '0')}`
    const now = new Date('2026-07-06T12:00:00.000Z')

    const uni = {
      id,
      name: args.data.name,
      code,
      status: args.data.status ?? ('ACTIVE' as const),
      ownerId: args.data.ownerId ?? null,
      createdAt: now,
      updatedAt: now,
    }

    this.universities.set(id, uni)
    return this.formatUniversityOutput(uni, args.select)
  }

  private updateUniversity(args: UpdateUniversityArgs) {
    const current = this.universities.get(args.where.id)
    if (!current) {
      throw new Error(`Missing university ${args.where.id}`)
    }

    if (args.data.code !== undefined) {
      const code = args.data.code.toUpperCase()
      const duplicate = [...this.universities.values()].find(
        (u) => u.id !== current.id && u.code.toUpperCase() === code,
      )
      if (duplicate) {
        const error = new Error('Unique constraint failed') as Error & {
          code?: string
          meta?: { target?: string[] }
        }
        error.code = 'P2002'
        error.meta = { target: ['code'] }
        throw error
      }
    }

    const updated = {
      ...current,
      ...(args.data.name !== undefined ? { name: args.data.name } : {}),
      ...(args.data.code !== undefined
        ? { code: args.data.code.toUpperCase() }
        : {}),
      ...(args.data.status !== undefined ? { status: args.data.status } : {}),
      ...(args.data.ownerId !== undefined
        ? { ownerId: args.data.ownerId }
        : {}),
      updatedAt: new Date('2026-07-06T12:00:00.000Z'),
    }

    this.universities.set(current.id, updated)
    return this.formatUniversityOutput(updated, args.select)
  }

  private groupByUsers(args: GroupByUserArgs) {
    let filteredUsers = [...this.users.values()]

    if (args.where?.universityId !== undefined) {
      if (typeof args.where.universityId === 'string') {
        const uid = args.where.universityId
        filteredUsers = filteredUsers.filter((u) => u.universityId === uid)
      } else {
        const uids = new Set(args.where.universityId.in)
        filteredUsers = filteredUsers.filter(
          (u) => u.universityId !== null && uids.has(u.universityId),
        )
      }
    }

    if (args.where?.role?.in !== undefined) {
      const roles = new Set(args.where.role.in)
      filteredUsers = filteredUsers.filter((u) => roles.has(u.role))
    }

    const groups = new Map<
      string,
      { universityId: string | null; role: string; count: number }
    >()

    for (const u of filteredUsers) {
      const key = `${u.universityId ?? 'null'}:${u.role}`
      const existing = groups.get(key)
      if (existing) {
        existing.count += 1
      } else {
        groups.set(key, {
          universityId: u.universityId,
          role: u.role,
          count: 1,
        })
      }
    }

    return [...groups.values()].map((g) => ({
      universityId: g.universityId,
      role: g.role,
      _count: { _all: g.count },
    }))
  }
}
