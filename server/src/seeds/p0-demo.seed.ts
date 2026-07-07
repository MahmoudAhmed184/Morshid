import type {
  CourseMembershipRole,
  Prisma,
  UserRole,
  UserStatus,
} from '../generated/prisma/client'
import { hashPassword } from '../modules/auth/utils/password.util'

export const P0_DEMO_PASSWORD = 'MorshidDemoP0!'

export const P0_DEMO_COURSE = {
  code: 'PYTHON-PROG-P0',
  title: 'Python Programming',
} as const

export const P0_HIDDEN_ISOLATION_COURSE = {
  code: 'HIDDEN-ISOLATION',
  title: 'Hidden Isolation Test Course',
} as const

export const P0_ACTIVE_USER_STATUS = 'ACTIVE' satisfies UserStatus

export const P0_INSTRUCTOR_MEMBERSHIP_ROLE =
  'INSTRUCTOR' satisfies CourseMembershipRole

export const P0_STUDENT_MEMBERSHIP_ROLE =
  'STUDENT' satisfies CourseMembershipRole

const P0_DEMO_USER_KEYS = {
  admin: 'admin',
  instructor: 'instructor',
  student1: 'student1',
  student2: 'student2',
  student3: 'student3',
} as const

type P0DemoUserKey = (typeof P0_DEMO_USER_KEYS)[keyof typeof P0_DEMO_USER_KEYS]

interface P0DemoUserDefinition {
  key: P0DemoUserKey
  email: string
  displayName: string
  role: UserRole
  pythonMembershipRole: CourseMembershipRole | null
}

export const P0_DEMO_USERS = [
  {
    key: P0_DEMO_USER_KEYS.admin,
    email: 'admin@morshid.demo',
    displayName: 'P0 Demo Admin',
    role: 'ADMIN' satisfies UserRole,
    pythonMembershipRole: null,
  },
  {
    key: P0_DEMO_USER_KEYS.instructor,
    email: 'instructor@morshid.demo',
    displayName: 'P0 Demo Instructor',
    role: 'INSTRUCTOR' satisfies UserRole,
    pythonMembershipRole: P0_INSTRUCTOR_MEMBERSHIP_ROLE,
  },
  {
    key: P0_DEMO_USER_KEYS.student1,
    email: 'student1@morshid.demo',
    displayName: 'P0 Demo Student 1',
    role: 'STUDENT' satisfies UserRole,
    pythonMembershipRole: P0_STUDENT_MEMBERSHIP_ROLE,
  },
  {
    key: P0_DEMO_USER_KEYS.student2,
    email: 'student2@morshid.demo',
    displayName: 'P0 Demo Student 2',
    role: 'STUDENT' satisfies UserRole,
    pythonMembershipRole: P0_STUDENT_MEMBERSHIP_ROLE,
  },
  {
    key: P0_DEMO_USER_KEYS.student3,
    email: 'student3@morshid.demo',
    displayName: 'P0 Demo Student 3',
    role: 'STUDENT' satisfies UserRole,
    pythonMembershipRole: P0_STUDENT_MEMBERSHIP_ROLE,
  },
] as const satisfies readonly P0DemoUserDefinition[]

export type P0DemoSeedTransaction = Pick<
  Prisma.TransactionClient,
  'course' | 'courseMembership' | 'user'
>

export interface P0DemoSeedClient {
  $transaction<T>(
    fn: (tx: P0DemoSeedTransaction) => Promise<T>,
    options?: { timeout?: number },
  ): Promise<T>
}

interface SeededUser {
  id: string
  email: string
}

interface SeededCourse {
  id: string
  code: string
}

export interface P0DemoSeedResult {
  users: SeededUser[]
  courses: {
    pythonProgramming: SeededCourse
    hiddenIsolation: SeededCourse
  }
}

export async function createP0DemoPasswordHash() {
  return hashPassword(P0_DEMO_PASSWORD)
}

export async function seedP0DemoData(
  prisma: P0DemoSeedClient,
): Promise<P0DemoSeedResult> {
  return prisma.$transaction(async (tx) => seedP0DemoDataInTransaction(tx), {
    timeout: 30_000,
  })
}

async function seedP0DemoDataInTransaction(
  tx: P0DemoSeedTransaction,
): Promise<P0DemoSeedResult> {
  const users = []
  const usersByKey = new Map<P0DemoUserKey, SeededUser>()
  const pythonMemberships: {
    role: CourseMembershipRole
    user: SeededUser
  }[] = []

  for (const seedUser of P0_DEMO_USERS) {
    const passwordHash = await createP0DemoPasswordHash()
    const user = await tx.user.upsert({
      where: {
        email: seedUser.email,
      },
      update: {
        displayName: seedUser.displayName,
        role: seedUser.role,
        status: P0_ACTIVE_USER_STATUS,
        passwordHash,
        disabledAt: null,
        disabledById: null,
        lastLoginAt: null,
      },
      create: {
        email: seedUser.email,
        displayName: seedUser.displayName,
        role: seedUser.role,
        status: P0_ACTIVE_USER_STATUS,
        passwordHash,
      },
    })

    users.push(user)
    usersByKey.set(seedUser.key, user)

    if (seedUser.pythonMembershipRole !== null) {
      pythonMemberships.push({
        role: seedUser.pythonMembershipRole,
        user,
      })
    }
  }

  const adminUser = requireSeededUser(usersByKey, P0_DEMO_USER_KEYS.admin)
  const instructorUser = requireSeededUser(
    usersByKey,
    P0_DEMO_USER_KEYS.instructor,
  )

  const pythonProgramming = await upsertSeedCourse(
    tx,
    P0_DEMO_COURSE,
    instructorUser.id,
  )

  const hiddenIsolation = await upsertSeedCourse(
    tx,
    P0_HIDDEN_ISOLATION_COURSE,
    null,
  )

  await tx.course.updateMany({
    where: {
      createdById: instructorUser.id,
      NOT: {
        code: P0_DEMO_COURSE.code,
      },
    },
    data: {
      createdById: null,
    },
  })

  const pythonMembershipUserIds = pythonMemberships.map(({ user }) => user.id)

  await tx.courseMembership.deleteMany({
    where: {
      courseId: hiddenIsolation.id,
    },
  })

  await tx.courseMembership.deleteMany({
    where: {
      userId: {
        in: pythonMembershipUserIds,
      },
      NOT: {
        courseId: pythonProgramming.id,
      },
    },
  })

  for (const membership of pythonMemberships) {
    await tx.courseMembership.upsert({
      where: {
        courseId_userId: {
          courseId: pythonProgramming.id,
          userId: membership.user.id,
        },
      },
      update: {
        role: membership.role,
        createdById: adminUser.id,
      },
      create: {
        courseId: pythonProgramming.id,
        userId: membership.user.id,
        role: membership.role,
        createdById: adminUser.id,
      },
    })
  }

  return {
    users,
    courses: {
      pythonProgramming,
      hiddenIsolation,
    },
  }
}

function requireSeededUser(
  usersByKey: ReadonlyMap<P0DemoUserKey, SeededUser>,
  key: P0DemoUserKey,
) {
  const user = usersByKey.get(key)

  if (!user) {
    throw new Error(`P0 demo seed requires the ${key} user.`)
  }

  return user
}

async function upsertSeedCourse(
  tx: P0DemoSeedTransaction,
  course: typeof P0_DEMO_COURSE | typeof P0_HIDDEN_ISOLATION_COURSE,
  createdById: string | null,
) {
  return tx.course.upsert({
    where: {
      code: course.code,
    },
    update: {
      title: course.title,
      createdById,
    },
    create: {
      code: course.code,
      title: course.title,
      createdById,
    },
  })
}
