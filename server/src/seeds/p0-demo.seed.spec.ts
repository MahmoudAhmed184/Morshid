import {
  createP0DemoPasswordHash,
  P0_ACTIVE_USER_STATUS,
  P0_DEMO_COURSE,
  P0_DEMO_PASSWORD,
  P0_DEMO_USERS,
  P0_HIDDEN_ISOLATION_COURSE,
  P0_INSTRUCTOR_MEMBERSHIP_ROLE,
  P0_STUDENT_MEMBERSHIP_ROLE,
  type P0DemoSeedClient,
  type P0DemoSeedTransaction,
  seedP0DemoData,
} from './p0-demo.seed'

type UserRole = (typeof P0_DEMO_USERS)[number]['role']
type UserStatus = 'ACTIVE' | 'DISABLED'
type CourseMembershipRole = 'INSTRUCTOR' | 'STUDENT'

interface UserRecord {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
  passwordHash: string
  disabledAt: Date | null
  disabledById: string | null
  lastLoginAt: Date | null
}

interface CourseRecord {
  id: string
  code: string
  title: string
  createdById: string | null
}

interface MembershipRecord {
  id: string
  courseId: string
  userId: string
  role: CourseMembershipRole
  createdById: string | null
}

interface UserUpsertArgs {
  where: {
    email: string
  }
  update: Omit<UserRecord, 'email' | 'id'>
  create: Omit<UserRecord, 'disabledAt' | 'disabledById' | 'id' | 'lastLoginAt'>
}

interface CourseUpsertArgs {
  where: {
    code: string
  }
  update: {
    title: string
    createdById?: string | null
  }
  create: {
    code: string
    title: string
    createdById?: string | null
  }
}

interface CourseUpdateManyArgs {
  where: {
    createdById: string
    NOT: {
      code: string
    }
  }
  data: {
    createdById: string | null
  }
}

interface MembershipDeleteManyArgs {
  where:
    | {
        courseId: string
      }
    | {
        userId: {
          in: string[]
        }
        NOT: {
          courseId: string
        }
      }
}

interface MembershipUpsertArgs {
  where: {
    courseId_userId: {
      courseId: string
      userId: string
    }
  }
  update: {
    role: CourseMembershipRole
    createdById?: string | null
  }
  create: {
    courseId: string
    userId: string
    role: CourseMembershipRole
    createdById?: string | null
  }
}

class InMemorySeedPrisma implements P0DemoSeedClient {
  readonly users = new Map<string, UserRecord>()

  readonly courses = new Map<string, CourseRecord>()

  readonly memberships = new Map<string, MembershipRecord>()

  private nextSequence = 1

  readonly user = {
    upsert: jest.fn((args: UserUpsertArgs) => {
      const existing = this.users.get(args.where.email)

      if (existing) {
        const updated = {
          ...existing,
          ...args.update,
        }
        this.users.set(updated.email, updated)

        return Promise.resolve(updated)
      }

      const created = {
        id: this.nextId('user'),
        disabledAt: null,
        disabledById: null,
        lastLoginAt: null,
        ...args.create,
      }
      this.users.set(created.email, created)

      return Promise.resolve(created)
    }),
  }

  readonly course = {
    upsert: jest.fn((args: CourseUpsertArgs) => {
      const existing = this.courses.get(args.where.code)

      if (existing) {
        const updated = {
          ...existing,
          title: args.update.title,
          createdById: args.update.createdById ?? null,
        }
        this.courses.set(updated.code, updated)

        return Promise.resolve(updated)
      }

      const created = {
        id: this.nextId('course'),
        code: args.create.code,
        title: args.create.title,
        createdById: args.create.createdById ?? null,
      }
      this.courses.set(created.code, created)

      return Promise.resolve(created)
    }),
    updateMany: jest.fn((args: CourseUpdateManyArgs) => {
      let count = 0

      for (const course of [...this.courses.values()]) {
        if (
          course.createdById === args.where.createdById &&
          course.code !== args.where.NOT.code
        ) {
          this.courses.set(course.code, {
            ...course,
            createdById: args.data.createdById,
          })
          count += 1
        }
      }

      return Promise.resolve({ count })
    }),
  }

  readonly courseMembership = {
    deleteMany: jest.fn((args: MembershipDeleteManyArgs) => {
      for (const membership of [...this.memberships.values()]) {
        if (this.matchesDeleteMany(membership, args)) {
          this.memberships.delete(this.membershipKey(membership))
        }
      }

      return Promise.resolve({ count: 0 })
    }),
    upsert: jest.fn((args: MembershipUpsertArgs) => {
      const key = this.membershipKey(args.where.courseId_userId)
      const existing = this.memberships.get(key)

      if (existing) {
        const updated = {
          ...existing,
          role: args.update.role,
          createdById: args.update.createdById ?? null,
        }
        this.memberships.set(key, updated)

        return Promise.resolve(updated)
      }

      const created = {
        id: this.nextId('membership'),
        courseId: args.create.courseId,
        userId: args.create.userId,
        role: args.create.role,
        createdById: args.create.createdById ?? null,
      }
      this.memberships.set(key, created)

      return Promise.resolve(created)
    }),
  }

  async $transaction<T>(
    fn: (tx: P0DemoSeedTransaction) => Promise<T>,
  ): Promise<T> {
    return fn(this as unknown as P0DemoSeedTransaction)
  }

  getCourse(code: string) {
    const course = this.courses.get(code)

    if (!course) {
      throw new Error(`Expected course ${code} to exist`)
    }

    return course
  }

  getUser(email: string) {
    const user = this.users.get(email)

    if (!user) {
      throw new Error(`Expected user ${email} to exist`)
    }

    return user
  }

  addMembership(input: Omit<MembershipRecord, 'id'>) {
    const membership = {
      id: this.nextId('membership'),
      ...input,
    }
    this.memberships.set(this.membershipKey(membership), membership)

    return membership
  }

  private matchesDeleteMany(
    membership: MembershipRecord,
    args: MembershipDeleteManyArgs,
  ) {
    if ('courseId' in args.where) {
      return membership.courseId === args.where.courseId
    }

    return (
      args.where.userId.in.includes(membership.userId) &&
      membership.courseId !== args.where.NOT.courseId
    )
  }

  private membershipKey(input: { courseId: string; userId: string }) {
    return `${input.courseId}:${input.userId}`
  }

  private nextId(prefix: string) {
    const id = `${prefix}-${this.nextSequence.toString()}`
    this.nextSequence += 1

    return id
  }
}

describe('seedP0DemoData', () => {
  it('creates all five demo accounts with expected identity, role, status, and hash', async () => {
    const prisma = new InMemorySeedPrisma()

    await seedP0DemoData(prisma)

    expect([...prisma.users.values()]).toHaveLength(5)

    for (const expectedUser of P0_DEMO_USERS) {
      const user = prisma.getUser(expectedUser.email)

      expect(user).toMatchObject({
        email: expectedUser.email,
        displayName: expectedUser.displayName,
        role: expectedUser.role,
        status: P0_ACTIVE_USER_STATUS,
        disabledAt: null,
        disabledById: null,
        lastLoginAt: null,
      })
      expect(user.passwordHash).toBe(
        createP0DemoPasswordHash(expectedUser.passwordSalt),
      )
    }
  })

  it('creates the Python and hidden isolation courses with expected codes and titles', async () => {
    const prisma = new InMemorySeedPrisma()

    await seedP0DemoData(prisma)

    expect(prisma.getCourse(P0_DEMO_COURSE.code)).toMatchObject({
      ...P0_DEMO_COURSE,
      createdById: prisma.getUser('instructor@morshid.demo').id,
    })
    expect(prisma.getCourse(P0_HIDDEN_ISOLATION_COURSE.code)).toMatchObject({
      ...P0_HIDDEN_ISOLATION_COURSE,
      createdById: null,
    })
  })

  it('creates only the expected Python Programming memberships for demo instructor and students', async () => {
    const prisma = new InMemorySeedPrisma()

    await seedP0DemoData(prisma)

    const pythonCourse = prisma.getCourse(P0_DEMO_COURSE.code)
    const memberships = [...prisma.memberships.values()].filter(
      (membership) => membership.courseId === pythonCourse.id,
    )

    expect(memberships).toHaveLength(4)
    expect(memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: prisma.getUser('instructor@morshid.demo').id,
          role: P0_INSTRUCTOR_MEMBERSHIP_ROLE,
        }),
        expect.objectContaining({
          userId: prisma.getUser('student1@morshid.demo').id,
          role: P0_STUDENT_MEMBERSHIP_ROLE,
        }),
        expect.objectContaining({
          userId: prisma.getUser('student2@morshid.demo').id,
          role: P0_STUDENT_MEMBERSHIP_ROLE,
        }),
        expect.objectContaining({
          userId: prisma.getUser('student3@morshid.demo').id,
          role: P0_STUDENT_MEMBERSHIP_ROLE,
        }),
      ]),
    )
    expect(
      memberships.some(
        (membership) =>
          membership.userId === prisma.getUser('admin@morshid.demo').id,
      ),
    ).toBe(false)
  })

  it('leaves the hidden isolation course without memberships', async () => {
    const prisma = new InMemorySeedPrisma()

    await seedP0DemoData(prisma)

    const hiddenCourse = prisma.getCourse(P0_HIDDEN_ISOLATION_COURSE.code)

    expect(
      [...prisma.memberships.values()].filter(
        (membership) => membership.courseId === hiddenCourse.id,
      ),
    ).toEqual([])
  })

  it('resets deterministic data on rerun without creating duplicates', async () => {
    const prisma = new InMemorySeedPrisma()

    await seedP0DemoData(prisma)

    const instructor = prisma.getUser('instructor@morshid.demo')
    const student = prisma.getUser('student1@morshid.demo')
    const pythonCourse = prisma.getCourse(P0_DEMO_COURSE.code)
    const hiddenCourse = prisma.getCourse(P0_HIDDEN_ISOLATION_COURSE.code)

    prisma.users.set(instructor.email, {
      ...instructor,
      displayName: 'Changed',
      role: 'STUDENT',
      status: 'DISABLED',
      passwordHash: P0_DEMO_PASSWORD,
      disabledAt: new Date('2026-07-06T00:00:00.000Z'),
      disabledById: 'admin-user',
      lastLoginAt: new Date('2026-07-06T01:00:00.000Z'),
    })
    prisma.courses.set(pythonCourse.code, {
      ...pythonCourse,
      title: 'Changed Python',
    })
    prisma.courses.set(hiddenCourse.code, {
      ...hiddenCourse,
      title: 'Changed Hidden',
    })
    prisma.courses.set('EXTRA-INSTRUCTOR-OWNED', {
      id: 'extra-instructor-owned',
      code: 'EXTRA-INSTRUCTOR-OWNED',
      title: 'Extra Instructor-Owned Course',
      createdById: instructor.id,
    })

    prisma.addMembership({
      courseId: hiddenCourse.id,
      userId: student.id,
      role: P0_STUDENT_MEMBERSHIP_ROLE,
      createdById: null,
    })
    prisma.addMembership({
      courseId: 'external-course',
      userId: instructor.id,
      role: P0_STUDENT_MEMBERSHIP_ROLE,
      createdById: null,
    })

    await seedP0DemoData(prisma)

    expect([...prisma.users.values()]).toHaveLength(5)
    expect([...prisma.courses.values()]).toHaveLength(3)
    expect([...prisma.memberships.values()]).toHaveLength(4)

    expect(prisma.getUser('instructor@morshid.demo')).toMatchObject({
      displayName: 'P0 Demo Instructor',
      role: 'INSTRUCTOR',
      status: P0_ACTIVE_USER_STATUS,
      disabledAt: null,
      disabledById: null,
      lastLoginAt: null,
    })
    expect(prisma.getUser('instructor@morshid.demo').passwordHash).toBe(
      createP0DemoPasswordHash('morshid-p0-demo-instructor'),
    )
    expect(prisma.getCourse(P0_DEMO_COURSE.code).title).toBe(
      P0_DEMO_COURSE.title,
    )
    expect(prisma.getCourse(P0_DEMO_COURSE.code).createdById).toBe(
      instructor.id,
    )
    expect(prisma.getCourse(P0_HIDDEN_ISOLATION_COURSE.code).title).toBe(
      P0_HIDDEN_ISOLATION_COURSE.title,
    )
    expect(prisma.getCourse(P0_HIDDEN_ISOLATION_COURSE.code).createdById).toBe(
      null,
    )
    expect(prisma.getCourse('EXTRA-INSTRUCTOR-OWNED').createdById).toBeNull()
  })

  it('uses parseable non-plaintext per-account scrypt hashes', () => {
    const hashes = P0_DEMO_USERS.map((user) =>
      createP0DemoPasswordHash(user.passwordSalt),
    )

    for (const hash of hashes) {
      expect(hash).not.toBe(P0_DEMO_PASSWORD)
      expect(hash).toMatch(
        /^scrypt:v1:N=16384,r=8,p=1,keylen=64:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/,
      )
    }
    expect(new Set(hashes).size).toBe(P0_DEMO_USERS.length)
  })
})
