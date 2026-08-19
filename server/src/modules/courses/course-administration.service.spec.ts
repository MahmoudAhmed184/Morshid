import { ConflictException, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../identity/identity.types'
import { UserRole, UserStatus } from '../identity/identity.roles'
import { COURSE_ADMINISTRATION_ERROR_CODES } from './course-administration.errors'
import { CourseAdministrationService } from './course-administration.service'
import { CourseMembershipRole } from './interface/course-membership-role'
import {
  CoursesRepository,
  CourseMemberNotFoundError,
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

const createdAt = new Date('2026-07-11T10:00:00.000Z')
const updatedAt = new Date('2026-07-11T10:01:00.000Z')

const actor: AuthenticatedUser = {
  id: 'admin-user',
  email: 'admin@morshid.demo',
  displayName: 'Demo Admin',
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
  universityId: 'univ-1',
}

const user = {
  id: 'user-1',
  email: 'user-1@morshid.demo',
  displayName: 'Demo User',
  role: UserRole.STUDENT,
  status: UserStatus.ACTIVE,
}

const membership: CourseMembershipRecord = {
  id: 'membership-1',
  userId: user.id,
  role: CourseMembershipRole.STUDENT,
  createdAt,
  user,
}

const course: CourseAdministrationRecord = {
  id: 'course-1',
  universityId: 'univ-1',
  code: 'CS-1',
  title: 'Computer Science',
  createdById: actor.id,
  createdBy: actor,
  createdAt,
  updatedAt,
  memberships: [membership],
  materials: [{ deletedAt: null }, { deletedAt: new Date() }],
}

class FakeCoursesRepository extends CoursesRepository {
  readonly listCourseAdministration = jest.fn(() => Promise.resolve([course]))
  readonly findCourseAdministrationById = jest.fn<
    Promise<CourseAdministrationRecord | null>,
    [string]
  >(() => Promise.resolve(course))
  readonly findCourseAdministrationByCode = jest.fn<
    Promise<CourseAdministrationRecord | null>,
    [string]
  >(() => Promise.resolve(null))
  readonly createCourse = jest.fn((input: CreateCourseInput) =>
    Promise.resolve({
      ...course,
      id: 'created-course',
      code: input.code,
      title: input.title,
      createdById: input.actorUserId,
    }),
  )
  readonly updateCourse = jest.fn((input: UpdateCourseInput) =>
    Promise.resolve({
      ...course,
      code: input.code ?? course.code,
      title: input.title ?? course.title,
    }),
  )
  readonly archiveCourse = jest.fn((_input: ArchiveCourseInput) =>
    Promise.resolve(),
  )
  readonly findUserById = jest.fn(() => Promise.resolve({ id: user.id }))
  readonly findCourseAccess = jest.fn(() =>
    Promise.resolve<CourseAccessRecord>({
      id: course.id,
      membershipRole: CourseMembershipRole.STUDENT,
    }),
  )
  readonly findMembership = jest.fn(() => Promise.resolve(membership))
  readonly addMember = jest.fn((input: AddCourseMemberInput) =>
    Promise.resolve({ ...membership, role: input.role }),
  )
  readonly addMembers = jest.fn((_input: BulkAddCourseMembersInput) =>
    Promise.resolve({ assignedCount: 0, skippedCount: 0 }),
  )
  readonly removeMember = jest.fn((_input: RemoveCourseMemberInput) =>
    Promise.resolve(),
  )
  readonly listMembers = jest.fn(() => Promise.resolve([membership]))
  readonly updateMemberRole = jest.fn((input: UpdateMemberRoleInput) =>
    Promise.resolve({ ...membership, role: input.role }),
  )
  readonly findMembershipRole = jest.fn(() =>
    Promise.resolve(CourseMembershipRole.STUDENT),
  )
  readonly hasActiveCourseMembership = jest.fn(() => Promise.resolve(true))
  readonly listMemberCourses = jest.fn(() => Promise.resolve([]))
}

describe('CourseAdministrationService', () => {
  function buildService() {
    const repository = new FakeCoursesRepository()
    return {
      repository,
      service: new CourseAdministrationService(repository),
    }
  }

  it('maps active membership and material metadata', async () => {
    const { service } = buildService()

    const response = await service.listCourses()

    expect(response.courses[0]?.adminMetadata).toMatchObject({
      memberCount: 1,
      studentCount: 1,
      instructorCount: 0,
      materialCount: 2,
      activeMaterialCount: 1,
    })
  })

  it('uses Courses-owned administration queries', async () => {
    const { repository, service } = buildService()

    await service.getCourse(course.id)
    await service.createCourse({ code: 'CS-2', title: 'New Course' }, actor)
    await service.updateCourse(course.id, { title: 'Updated' }, actor)

    expect(repository.findCourseAdministrationById).toHaveBeenCalled()
    expect(repository.findCourseAdministrationByCode).toHaveBeenCalled()
    expect(repository.createCourse).toHaveBeenCalled()
    expect(repository.updateCourse).toHaveBeenCalled()
  })

  it('assigns several users to several courses through one repository command', async () => {
    const { repository, service } = buildService()
    repository.findCourseAdministrationById.mockResolvedValue(course)
    repository.findUserById.mockResolvedValue({ id: user.id })
    repository.addMembers.mockResolvedValue({
      assignedCount: 4,
      skippedCount: 0,
    })

    await expect(
      service.addMembers(
        {
          courseIds: ['course-1', 'course-2'],
          userIds: ['user-1', 'user-2'],
          role: CourseMembershipRole.STUDENT,
        },
        actor,
      ),
    ).resolves.toEqual({ assignedCount: 4, skippedCount: 0 })
    expect(repository.addMembers).toHaveBeenCalledTimes(1)
    expect(repository.addMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        courseIds: ['course-1', 'course-2'],
        userIds: ['user-1', 'user-2'],
      }),
    )
  })

  it('archives a course through the repository command', async () => {
    const { repository, service } = buildService()

    await service.archiveCourse(course.id, actor)

    expect(repository.archiveCourse).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: course.id, actorUserId: actor.id }),
    )
  })

  it('maps missing courses to the Courses error contract', async () => {
    const { repository, service } = buildService()
    repository.findCourseAdministrationById.mockResolvedValueOnce(null)

    const request = service.getCourse('missing-course')

    await expect(request).rejects.toBeInstanceOf(NotFoundException)
    await expect(request).rejects.toMatchObject({
      response: { code: COURSE_ADMINISTRATION_ERROR_CODES.COURSE_NOT_FOUND },
    })
  })

  it('maps duplicate course codes to a conflict', async () => {
    const { repository, service } = buildService()
    repository.findCourseAdministrationByCode.mockResolvedValueOnce(course)

    const request = service.createCourse(
      { code: course.code, title: 'Duplicate' },
      actor,
    )

    await expect(request).rejects.toBeInstanceOf(ConflictException)
    expect(repository.createCourse).not.toHaveBeenCalled()
  })

  it('removes and updates only the active membership returned by Courses', async () => {
    const { repository, service } = buildService()

    await service.removeMember(course.id, user.id, actor)
    await service.updateMemberRole(
      course.id,
      user.id,
      { role: CourseMembershipRole.INSTRUCTOR },
      actor,
    )

    expect(repository.removeMember).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: course.id, userId: user.id }),
    )
    expect(repository.updateMemberRole).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: course.id,
        userId: user.id,
        role: CourseMembershipRole.INSTRUCTOR,
      }),
    )
  })

  it('maps a concurrent membership removal to not found', async () => {
    const { repository, service } = buildService()
    repository.removeMember.mockRejectedValueOnce(
      new CourseMemberNotFoundError(course.id, user.id),
    )

    const request = service.removeMember(course.id, user.id, actor)

    await expect(request).rejects.toBeInstanceOf(NotFoundException)
    await expect(request).rejects.toMatchObject({
      response: { code: COURSE_ADMINISTRATION_ERROR_CODES.MEMBER_NOT_FOUND },
    })
  })
})
