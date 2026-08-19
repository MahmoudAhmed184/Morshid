import type { AuthenticatedUser } from '../identity/identity.types'
import { UserRole, UserStatus } from '../identity/identity.roles'
import { CourseAccessService } from './course-access.service'
import { CourseMembershipRole } from './interface/course-membership-role'
import {
  CoursesRepository,
  type AddCourseMemberInput,
  type ArchiveCourseInput,
  type BulkAddCourseMembersInput,
  type CourseAdministrationRecord,
  type CourseAccessRecord,
  type CourseMembershipRecord,
  type CreateCourseInput,
  type RemoveCourseMemberInput,
  type UpdateCourseInput,
  type UpdateMemberRoleInput,
} from './courses.repository'

class CourseAccessTestRepository extends CoursesRepository {
  private readonly courses = new Set([
    'any-course',
    'owned-course',
    'other-course',
    'assigned-course',
    'unassigned-course',
  ])
  private readonly memberships = new Map<string, CourseMembershipRole>()
  readonly findMembershipRole = jest.fn((userId: string, courseId: string) =>
    Promise.resolve(
      this.memberships.get(this.membershipKey(userId, courseId)) ?? null,
    ),
  )

  readonly hasActiveCourseMembership = jest.fn(
    (userId: string, courseId: string, role: CourseMembershipRole) =>
      Promise.resolve(
        this.memberships.get(this.membershipKey(userId, courseId)) === role,
      ),
  )

  findCourseAccess(
    userId: string,
    courseId: string,
  ): Promise<CourseAccessRecord | null> {
    if (!this.courses.has(courseId)) {
      return Promise.resolve(null)
    }

    return Promise.resolve({
      id: courseId,
      membershipRole:
        this.memberships.get(this.membershipKey(userId, courseId)) ?? null,
    })
  }

  listCourseAdministration(): Promise<CourseAdministrationRecord[]> {
    return Promise.resolve([])
  }

  findCourseAdministrationById(
    _courseId: string,
  ): Promise<CourseAdministrationRecord | null> {
    return Promise.resolve(null)
  }

  findCourseAdministrationByCode(
    _code: string,
  ): Promise<CourseAdministrationRecord | null> {
    return Promise.resolve(null)
  }

  createCourse(_input: CreateCourseInput): Promise<CourseAdministrationRecord> {
    return Promise.reject(new Error('not used by CourseAccessService tests'))
  }

  updateCourse(_input: UpdateCourseInput): Promise<CourseAdministrationRecord> {
    return Promise.reject(new Error('not used by CourseAccessService tests'))
  }

  archiveCourse(_input: ArchiveCourseInput): Promise<void> {
    return Promise.reject(new Error('not used by CourseAccessService tests'))
  }

  findUserById(_userId: string): Promise<{ id: string } | null> {
    return Promise.resolve(null)
  }

  findMembership(
    _courseId: string,
    _userId: string,
  ): Promise<CourseMembershipRecord | null> {
    return Promise.resolve(null)
  }

  addMember(_input: AddCourseMemberInput): Promise<CourseMembershipRecord> {
    return Promise.reject(new Error('not used by CourseAccessService tests'))
  }

  addMembers(
    _input: BulkAddCourseMembersInput,
  ): Promise<{ assignedCount: number; skippedCount: number }> {
    return Promise.reject(new Error('not used by CourseAccessService tests'))
  }

  removeMember(_input: RemoveCourseMemberInput): Promise<void> {
    return Promise.reject(new Error('not used by CourseAccessService tests'))
  }

  listMembers(_courseId: string): Promise<CourseMembershipRecord[]> {
    return Promise.resolve([])
  }

  listMemberCourses() {
    return Promise.resolve([])
  }

  updateMemberRole(
    _input: UpdateMemberRoleInput,
  ): Promise<CourseMembershipRecord> {
    return Promise.reject(new Error('not used by CourseAccessService tests'))
  }

  addMembership(userId: string, courseId: string, role: CourseMembershipRole) {
    this.memberships.set(this.membershipKey(userId, courseId), role)
  }

  private membershipKey(userId: string, courseId: string) {
    return `${userId}:${courseId}`
  }
}

function buildUser(id: string, role: UserRole): AuthenticatedUser {
  return {
    id,
    email: `${id}@morshid.demo`,
    displayName: id,
    role,
    status: UserStatus.ACTIVE,
    universityId: 'univ-1',
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

  it('requires an active instructor membership to view and manage a course', async () => {
    const { service, repository } = buildService()
    const instructor = buildUser('instructor-user', UserRole.INSTRUCTOR)

    await expect(
      service.canViewCourse(instructor, 'owned-course'),
    ).resolves.toBe(false)
    await expect(
      service.canManageCourse(instructor, 'owned-course'),
    ).resolves.toBe(false)
    expect(repository.findMembershipRole).toHaveBeenCalled()
  })

  it('rejects an instructor for courses owned by another instructor', async () => {
    const { service } = buildService()
    const instructor = buildUser('instructor-user', UserRole.INSTRUCTOR)

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

  it('returns a single active-membership decision for material management', async () => {
    const { service, repository } = buildService()
    const instructor = buildUser('instructor-user', UserRole.INSTRUCTOR)

    await expect(
      service.authorizeCourseMaterialManagement(instructor, 'owned-course'),
    ).resolves.toEqual({
      allowed: false,
      reason: 'COURSE_MANAGEMENT_REQUIRED',
    })

    repository.addMembership(
      instructor.id,
      'owned-course',
      CourseMembershipRole.INSTRUCTOR,
    )

    await expect(
      service.authorizeCourseMaterialManagement(instructor, 'owned-course'),
    ).resolves.toEqual({ allowed: true })

    await expect(
      service.authorizeCourseMaterialManagement(instructor, 'missing-course'),
    ).resolves.toEqual({
      allowed: false,
      reason: 'COURSE_NOT_FOUND',
    })
  })
})
