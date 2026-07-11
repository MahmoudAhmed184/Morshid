import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
  type Course,
  type CourseMembership,
  type Material,
  type User,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import {
  CoursesRepository,
  type MemberCourseRecord as RepositoryMemberCourseRecord,
} from './courses.repository'
import { CoursesService, type CourseListResponse } from './courses.service'

type CourseRecord = Pick<
  Course,
  'id' | 'code' | 'title' | 'createdById' | 'createdAt' | 'updatedAt'
>
type MembershipRecord = Pick<
  CourseMembership,
  'id' | 'courseId' | 'userId' | 'role' | 'createdAt'
>
type MaterialRecord = Pick<Material, 'courseId' | 'deletedAt'>
type UserRecord = Pick<User, 'id' | 'email' | 'displayName' | 'role' | 'status'>

interface AdminMembershipRecord extends MembershipRecord {
  user: UserRecord
}

interface AdminCourseRecord extends CourseRecord {
  createdBy: UserRecord | null
  memberships: AdminMembershipRecord[]
  materials: Pick<MaterialRecord, 'deletedAt'>[]
}

class CoursesServiceTestRepository extends CoursesRepository {
  private readonly users = new Map<string, UserRecord>()
  private readonly courses = new Map<string, CourseRecord>()
  private readonly memberships: MembershipRecord[] = []
  private readonly materials: MaterialRecord[] = []

  readonly listAdminCourses = jest.fn(() =>
    Promise.resolve(this.findAdminCourses()),
  )

  readonly listMemberCourses = jest.fn(
    (userId: string, role: CourseMembershipRole) =>
      Promise.resolve(this.findMemberCourses(userId, role)),
  )

  readonly findMembershipRole = jest.fn((userId: string, courseId: string) =>
    Promise.resolve(
      this.memberships.find(
        (membership) =>
          membership.userId === userId && membership.courseId === courseId,
      )?.role ?? null,
    ),
  )

  constructor() {
    super()
    this.seed()
  }

  private seed() {
    const createdAt = new Date('2026-07-06T00:00:00.000Z')
    const updatedAt = new Date('2026-07-06T01:00:00.000Z')

    this.addUser({
      id: 'admin-user',
      email: 'admin@morshid.demo',
      displayName: 'Demo Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    })
    this.addUser({
      id: 'instructor-user',
      email: 'instructor@morshid.demo',
      displayName: 'Demo Instructor',
      role: UserRole.INSTRUCTOR,
      status: UserStatus.ACTIVE,
    })
    this.addUser({
      id: 'other-instructor',
      email: 'other-instructor@morshid.demo',
      displayName: 'Other Instructor',
      role: UserRole.INSTRUCTOR,
      status: UserStatus.ACTIVE,
    })
    this.addUser({
      id: 'student-user',
      email: 'student@morshid.demo',
      displayName: 'Demo Student',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    })
    this.addUser({
      id: 'other-student',
      email: 'other-student@morshid.demo',
      displayName: 'Other Student',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    })

    this.addCourse({
      id: 'python-course',
      code: 'PYTHON-PROG-P0',
      title: 'Python Programming',
      createdById: 'admin-user',
      createdAt,
      updatedAt,
    })
    this.addCourse({
      id: 'database-course',
      code: 'DB-P0',
      title: 'Database Systems',
      createdById: 'admin-user',
      createdAt,
      updatedAt,
    })
    this.addCourse({
      id: 'hidden-course',
      code: 'HIDDEN-ISOLATION',
      title: 'Hidden Isolation Test Course',
      createdById: null,
      createdAt,
      updatedAt,
    })

    this.addMembership({
      id: 'python-instructor-membership',
      courseId: 'python-course',
      userId: 'instructor-user',
      role: CourseMembershipRole.INSTRUCTOR,
      createdAt,
    })
    this.addMembership({
      id: 'python-student-membership',
      courseId: 'python-course',
      userId: 'student-user',
      role: CourseMembershipRole.STUDENT,
      createdAt,
    })
    this.addMembership({
      id: 'database-instructor-membership',
      courseId: 'database-course',
      userId: 'other-instructor',
      role: CourseMembershipRole.INSTRUCTOR,
      createdAt,
    })
    this.addMembership({
      id: 'database-student-membership',
      courseId: 'database-course',
      userId: 'other-student',
      role: CourseMembershipRole.STUDENT,
      createdAt,
    })

    this.materials.push(
      {
        courseId: 'python-course',
        deletedAt: null,
      },
      {
        courseId: 'python-course',
        deletedAt: new Date('2026-07-07T00:00:00.000Z'),
      },
      {
        courseId: 'database-course',
        deletedAt: null,
      },
    )
  }

  private addUser(user: UserRecord) {
    this.users.set(user.id, user)
  }

  private addCourse(course: CourseRecord) {
    this.courses.set(course.id, course)
  }

  private addMembership(membership: MembershipRecord) {
    this.memberships.push(membership)
  }

  private findAdminCourses(): AdminCourseRecord[] {
    return [...this.courses.values()]
      .map((course) => ({
        ...course,
        createdBy:
          course.createdById === null
            ? null
            : this.requireUser(course.createdById),
        memberships: this.memberships
          .filter((membership) => membership.courseId === course.id)
          .map((membership) => ({
            ...membership,
            user: this.requireUser(membership.userId),
          })),
        materials: this.materials
          .filter((material) => material.courseId === course.id)
          .map((material) => ({
            deletedAt: material.deletedAt,
          })),
      }))
      .sort(compareCourseRecords)
  }

  private findMemberCourses(
    userId: string,
    role: CourseMembershipRole,
  ): RepositoryMemberCourseRecord[] {
    return this.memberships
      .filter(
        (membership) =>
          membership.userId === userId && membership.role === role,
      )
      .map((membership) => {
        const course = this.requireCourse(membership.courseId)

        return {
          id: course.id,
          code: course.code,
          title: course.title,
          membershipRole: membership.role,
        }
      })
      .sort(compareCourseRecords)
  }

  private requireCourse(courseId: string) {
    const course = this.courses.get(courseId)

    if (!course) {
      throw new Error(`Missing course ${courseId}`)
    }

    return course
  }

  private requireUser(userId: string) {
    const user = this.users.get(userId)

    if (!user) {
      throw new Error(`Missing user ${userId}`)
    }

    return user
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
  const repository = new CoursesServiceTestRepository()

  return {
    service: new CoursesService(repository),
    repository,
  }
}

function findCourse(response: CourseListResponse, code: string) {
  const course = response.courses.find((item) => item.code === code)

  if (!course) {
    throw new Error(`Missing course ${code}`)
  }

  return course
}

function compareCourseRecords(
  a: Pick<CourseRecord, 'code'>,
  b: Pick<CourseRecord, 'code'>,
) {
  return a.code.localeCompare(b.code)
}

describe('CoursesService', () => {
  it('returns all courses with admin metadata for admins', async () => {
    const { service, repository } = buildService()
    const admin = buildUser('admin-user', UserRole.ADMIN)

    const response = await service.listCoursesForUser(admin)
    const pythonCourse = findCourse(response, 'PYTHON-PROG-P0')
    const hiddenCourse = findCourse(response, 'HIDDEN-ISOLATION')

    expect(response.courses.map((course) => course.code)).toEqual([
      'DB-P0',
      'HIDDEN-ISOLATION',
      'PYTHON-PROG-P0',
    ])
    expect(pythonCourse.membershipRole).toBeNull()
    expect(pythonCourse.adminMetadata).toMatchObject({
      createdById: 'admin-user',
      createdBy: {
        email: 'admin@morshid.demo',
        role: UserRole.ADMIN,
      },
      memberCount: 2,
      instructorCount: 1,
      studentCount: 1,
      materialCount: 2,
      activeMaterialCount: 1,
    })
    expect(
      pythonCourse.adminMetadata?.memberships.map((membership) => ({
        email: membership.user.email,
        role: membership.role,
      })),
    ).toEqual([
      {
        email: 'instructor@morshid.demo',
        role: CourseMembershipRole.INSTRUCTOR,
      },
      {
        email: 'student@morshid.demo',
        role: CourseMembershipRole.STUDENT,
      },
    ])
    expect(hiddenCourse.adminMetadata).toMatchObject({
      createdById: null,
      createdBy: null,
      memberCount: 0,
      materialCount: 0,
      activeMaterialCount: 0,
    })
    expect(repository.listAdminCourses).toHaveBeenCalledWith()
  })

  it('returns only instructor membership courses for instructors', async () => {
    const { service, repository } = buildService()
    const instructor = buildUser('instructor-user', UserRole.INSTRUCTOR)

    const response = await service.listCoursesForUser(instructor)

    expect(response.courses).toEqual([
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: CourseMembershipRole.INSTRUCTOR,
      },
    ])
    expect(response.courses[0].adminMetadata).toBeUndefined()
    expect(repository.listMemberCourses).toHaveBeenCalledWith(
      'instructor-user',
      CourseMembershipRole.INSTRUCTOR,
    )
  })

  it('returns only student membership courses for students', async () => {
    const { service, repository } = buildService()
    const student = buildUser('student-user', UserRole.STUDENT)

    const response = await service.listCoursesForUser(student)

    expect(response.courses).toEqual([
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: CourseMembershipRole.STUDENT,
      },
    ])
    expect(response.courses[0].adminMetadata).toBeUndefined()
    expect(repository.listMemberCourses).toHaveBeenCalledWith(
      'student-user',
      CourseMembershipRole.STUDENT,
    )
  })
})
