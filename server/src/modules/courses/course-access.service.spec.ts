import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import type { PrismaService } from '../prisma/prisma.service'
import { CourseAccessService } from './course-access.service'

interface FindUniqueMembershipArgs {
  where: {
    courseId_userId: {
      courseId: string
      userId: string
    }
  }
  select?: {
    role?: boolean
  }
}

interface StoredMembership {
  role: CourseMembershipRole
}

class CourseAccessTestStore {
  private readonly memberships = new Map<string, StoredMembership>()

  readonly findUniqueCourseMembership = jest.fn(
    (args: FindUniqueMembershipArgs) =>
      Promise.resolve(this.findMembership(args)),
  )

  readonly prisma = {
    courseMembership: {
      findUnique: this.findUniqueCourseMembership,
    },
  } as unknown as PrismaService

  addMembership(userId: string, courseId: string, role: CourseMembershipRole) {
    this.memberships.set(this.membershipKey(userId, courseId), {
      role,
    })
  }

  private findMembership(
    args: FindUniqueMembershipArgs,
  ): StoredMembership | null {
    return (
      this.memberships.get(
        this.membershipKey(
          args.where.courseId_userId.userId,
          args.where.courseId_userId.courseId,
        ),
      ) ?? null
    )
  }

  private membershipKey(userId: string, courseId: string) {
    return `${userId}:${courseId}`
  }
}

function buildUser(id: string, role: UserRole): AuthenticatedRequestUser {
  return {
    id,
    email: `${id}@morshid.demo`,
    displayName: id,
    role,
    status: UserStatus.ACTIVE,
  }
}

function buildService() {
  const store = new CourseAccessTestStore()

  return {
    service: new CourseAccessService(store.prisma),
    store,
  }
}

describe('CourseAccessService', () => {
  it('allows an admin to view and manage any course', async () => {
    const { service, store } = buildService()
    const admin = buildUser('admin-user', UserRole.ADMIN)

    await expect(service.canViewCourse(admin, 'any-course')).resolves.toBe(true)
    await expect(service.canManageCourse(admin, 'any-course')).resolves.toBe(
      true,
    )
    expect(store.findUniqueCourseMembership).not.toHaveBeenCalled()
  })

  it('allows an instructor to view and manage courses where they have an instructor membership', async () => {
    const { service, store } = buildService()
    const instructor = buildUser('instructor-user', UserRole.INSTRUCTOR)

    store.addMembership(
      instructor.id,
      'owned-course',
      CourseMembershipRole.INSTRUCTOR,
    )

    await expect(
      service.canViewCourse(instructor, 'owned-course'),
    ).resolves.toBe(true)
    await expect(
      service.canManageCourse(instructor, 'owned-course'),
    ).resolves.toBe(true)
  })

  it('rejects an instructor for courses owned by another instructor', async () => {
    const { service, store } = buildService()
    const instructor = buildUser('instructor-user', UserRole.INSTRUCTOR)

    store.addMembership(
      'other-instructor',
      'other-course',
      CourseMembershipRole.INSTRUCTOR,
    )

    await expect(
      service.canViewCourse(instructor, 'other-course'),
    ).resolves.toBe(false)
    await expect(
      service.canManageCourse(instructor, 'other-course'),
    ).resolves.toBe(false)
  })

  it('allows a student to view assigned courses only', async () => {
    const { service, store } = buildService()
    const student = buildUser('student-user', UserRole.STUDENT)

    store.addMembership(
      student.id,
      'assigned-course',
      CourseMembershipRole.STUDENT,
    )

    await expect(
      service.canViewCourse(student, 'assigned-course'),
    ).resolves.toBe(true)
    await expect(
      service.canViewCourse(student, 'unassigned-course'),
    ).resolves.toBe(false)
  })

  it('never allows a student to manage courses', async () => {
    const { service, store } = buildService()
    const student = buildUser('student-user', UserRole.STUDENT)

    store.addMembership(
      student.id,
      'assigned-course',
      CourseMembershipRole.STUDENT,
    )

    await expect(
      service.canManageCourse(student, 'assigned-course'),
    ).resolves.toBe(false)
  })
})
