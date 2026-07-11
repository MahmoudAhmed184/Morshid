import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { CourseAccessService } from './course-access.service'
import { CoursesRepository } from './courses.repository'

class CourseAccessTestRepository extends CoursesRepository {
  private readonly memberships = new Map<string, CourseMembershipRole>()

  readonly findMembershipRole = jest.fn((userId: string, courseId: string) =>
    Promise.resolve(
      this.memberships.get(this.membershipKey(userId, courseId)) ?? null,
    ),
  )

  listAdminCourses() {
    return Promise.resolve([])
  }

  listMemberCourses() {
    return Promise.resolve([])
  }

  addMembership(userId: string, courseId: string, role: CourseMembershipRole) {
    this.memberships.set(this.membershipKey(userId, courseId), role)
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
  const repository = new CourseAccessTestRepository()

  return {
    service: new CourseAccessService(repository),
    repository,
  }
}

describe('CourseAccessService', () => {
  it('allows an admin to view and manage any course', async () => {
    const { service, repository } = buildService()
    const admin = buildUser('admin-user', UserRole.ADMIN)

    await expect(service.canViewCourse(admin, 'any-course')).resolves.toBe(true)
    await expect(service.canManageCourse(admin, 'any-course')).resolves.toBe(
      true,
    )
    expect(repository.findMembershipRole).not.toHaveBeenCalled()
  })

  it('allows an instructor to view and manage courses where they have an instructor membership', async () => {
    const { service, repository } = buildService()
    const instructor = buildUser('instructor-user', UserRole.INSTRUCTOR)

    repository.addMembership(
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
    const { service, repository } = buildService()
    const instructor = buildUser('instructor-user', UserRole.INSTRUCTOR)

    repository.addMembership(
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
    const { service, repository } = buildService()
    const student = buildUser('student-user', UserRole.STUDENT)

    repository.addMembership(
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
    const { service, repository } = buildService()
    const student = buildUser('student-user', UserRole.STUDENT)

    repository.addMembership(
      student.id,
      'assigned-course',
      CourseMembershipRole.STUDENT,
    )

    await expect(
      service.canManageCourse(student, 'assigned-course'),
    ).resolves.toBe(false)
  })
})
