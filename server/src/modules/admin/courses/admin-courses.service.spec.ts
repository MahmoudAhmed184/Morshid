import { ConflictException, NotFoundException } from '@nestjs/common'

import {
  CourseMembershipRole,
  MaterialStatus,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../../auth/auth.dto'
import { ADMIN_COURSES_ERROR_CODES } from './admin-courses.errors'
import {
  AdminCoursesRepository,
  type AddCourseMemberInput,
  type AdminCourseMembershipRecord,
  type AdminCourseRecord,
  type AdminMaterialRecord,
  type RemoveCourseMemberInput,
  type UpdateMemberRoleInput,
  type UpdateMaterialInput,
} from './admin-courses.repository'
import { AdminCoursesService } from './admin-courses.service'

const createdAt = new Date('2026-07-11T10:00:00.000Z')
const updatedAt = new Date('2026-07-11T10:01:00.000Z')

class AdminCoursesServiceTestRepository extends AdminCoursesRepository {
  readonly courses = new Map<string, AdminCourseRecord>()
  readonly memberships = new Map<string, AdminCourseMembershipRecord>()
  readonly materials = new Map<string, AdminMaterialRecord>()
  readonly users = new Map<string, { id: string }>()

  readonly addMember = jest.fn((input: AddCourseMemberInput) =>
    Promise.resolve(this.insertMembership(input)),
  )
  readonly removeMember = jest.fn((input: RemoveCourseMemberInput) => {
    this.deleteMembership(input)

    return Promise.resolve()
  })
  readonly updateMemberRole = jest.fn((input: UpdateMemberRoleInput) =>
    Promise.resolve(this.changeMembershipRole(input)),
  )
  readonly updateMaterial = jest.fn((input: UpdateMaterialInput) =>
    Promise.resolve(this.modifyMaterial(input)),
  )

  listCourses(): Promise<AdminCourseRecord[]> {
    return Promise.resolve(
      [...this.courses.values()].sort((a, b) => a.code.localeCompare(b.code)),
    )
  }

  findCourseById(courseId: string): Promise<AdminCourseRecord | null> {
    return Promise.resolve(this.courses.get(courseId) ?? null)
  }

  findUserById(userId: string): Promise<{ id: string } | null> {
    return Promise.resolve(this.users.get(userId) ?? null)
  }

  findMembership(
    courseId: string,
    userId: string,
  ): Promise<AdminCourseMembershipRecord | null> {
    const id = `${courseId}_${userId}`
    return Promise.resolve(this.memberships.get(id) ?? null)
  }

  listMembers(courseId: string): Promise<AdminCourseMembershipRecord[]> {
    const course = this.courses.get(courseId)
    const memberIds = new Set((course?.memberships ?? []).map((cm) => cm.id))
    const members = [...this.memberships.values()]
      .filter((m) => memberIds.has(m.id))
      .sort(
        (a, b) =>
          a.role.localeCompare(b.role) ||
          a.user.email.localeCompare(b.user.email),
      )
    return Promise.resolve(members)
  }

  listMaterials(courseId: string): Promise<AdminMaterialRecord[]> {
    return Promise.resolve(
      [...this.materials.values()]
        .filter((m) => m.courseId === courseId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    )
  }

  findMaterialById(
    courseId: string,
    materialId: string,
  ): Promise<AdminMaterialRecord | null> {
    const material = this.materials.get(materialId)
    if (material?.courseId === courseId) {
      return Promise.resolve(material)
    }
    return Promise.resolve(null)
  }

  private insertMembership(
    input: AddCourseMemberInput,
  ): AdminCourseMembershipRecord {
    const id = `${input.courseId}_${input.userId}`
    const membership: AdminCourseMembershipRecord = {
      id,
      userId: input.userId,
      role: input.role,
      createdAt,
      user: {
        id: input.userId,
        email: `user_${input.userId}@demo.com`,
        displayName: 'Demo User',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      },
    }

    this.memberships.set(id, membership)

    // Also update the course's memberships array so tests see it
    const course = this.courses.get(input.courseId)
    if (course) {
      course.memberships.push(membership)
    }

    return membership
  }

  private deleteMembership(input: RemoveCourseMemberInput): void {
    const id = `${input.courseId}_${input.userId}`
    this.memberships.delete(id)

    const course = this.courses.get(input.courseId)
    if (course) {
      course.memberships = course.memberships.filter((m) => m.id !== id)
    }
  }

  private changeMembershipRole(
    input: UpdateMemberRoleInput,
  ): AdminCourseMembershipRecord {
    const id = `${input.courseId}_${input.userId}`
    const membership = this.memberships.get(id)
    if (!membership) {
      throw new Error('Membership not found in mock')
    }
    const updated = { ...membership, role: input.role }
    this.memberships.set(id, updated)
    return updated
  }

  private modifyMaterial(input: UpdateMaterialInput): AdminMaterialRecord {
    const material = this.materials.get(input.materialId)
    if (!material) {
      throw new Error('Material not found in mock')
    }

    const updated = { ...material, title: input.title, updatedAt: new Date() }
    this.materials.set(input.materialId, updated)
    return updated
  }
}

describe('AdminCoursesService', () => {
  const actor: AuthenticatedRequestUser = {
    id: 'admin-user',
    email: 'admin@morshid.demo',
    displayName: 'Demo Admin',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  }
  const requestContext = {
    ip: '203.0.113.10',
    userAgent: 'Jest',
  }

  function buildService() {
    const repository = new AdminCoursesServiceTestRepository()
    return {
      repository,
      service: new AdminCoursesService(repository),
    }
  }

  const dummyCourse: AdminCourseRecord = {
    id: 'course-1',
    code: 'TEST-1',
    title: 'Test Course',
    createdById: null,
    createdBy: null,
    createdAt,
    updatedAt,
    memberships: [],
    materials: [],
  }

  describe('courses', () => {
    it('lists courses and maps admin metadata correctly', async () => {
      const { repository, service } = buildService()

      repository.courses.set(dummyCourse.id, {
        ...dummyCourse,
        materials: [{ deletedAt: null }, { deletedAt: new Date() }],
        memberships: [
          {
            id: 'mem-1',
            userId: 'user-1',
            role: CourseMembershipRole.INSTRUCTOR,
            createdAt,
            user: {
              id: 'user-1',
              email: 'instructor@demo.com',
              displayName: 'Instructor',
              role: UserRole.INSTRUCTOR,
              status: UserStatus.ACTIVE,
            },
          },
          {
            id: 'mem-2',
            userId: 'user-2',
            role: CourseMembershipRole.STUDENT,
            createdAt,
            user: {
              id: 'user-2',
              email: 'student@demo.com',
              displayName: 'Student',
              role: UserRole.STUDENT,
              status: UserStatus.ACTIVE,
            },
          },
        ],
      })

      const response = await service.listCourses()

      expect(response.courses).toHaveLength(1)
      expect(response.courses[0].adminMetadata).toMatchObject({
        memberCount: 2,
        instructorCount: 1,
        studentCount: 1,
        materialCount: 2,
        activeMaterialCount: 1,
      })
      expect(response.courses[0].adminMetadata.memberships).toHaveLength(2)
      // Sorted by role (INSTRUCTOR before STUDENT)
      expect(response.courses[0].adminMetadata.memberships[0].role).toBe(
        CourseMembershipRole.INSTRUCTOR,
      )
      expect(response.courses[0].adminMetadata.memberships[1].role).toBe(
        CourseMembershipRole.STUDENT,
      )
    })

    it('gets a single course', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)

      const response = await service.getCourse(dummyCourse.id)
      expect(response.course.id).toBe(dummyCourse.id)
    })

    it('throws not found for missing course', async () => {
      const { service } = buildService()

      const getCourse = service.getCourse('missing')
      await expect(getCourse).rejects.toBeInstanceOf(NotFoundException)
      await expect(getCourse).rejects.toMatchObject({
        response: { code: ADMIN_COURSES_ERROR_CODES.COURSE_NOT_FOUND },
      })
    })
  })

  describe('members', () => {
    it('adds a member to a course', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)
      repository.users.set('user-1', { id: 'user-1' })

      const response = await service.addMember(
        dummyCourse.id,
        { userId: 'user-1', role: CourseMembershipRole.STUDENT },
        actor,
        requestContext,
      )

      expect(repository.addMember).toHaveBeenCalledTimes(1)
      expect(response.member.userId).toBe('user-1')
      expect(response.member.role).toBe(CourseMembershipRole.STUDENT)
    })

    it('throws user not found if user missing when adding member', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)

      const addMember = service.addMember(
        dummyCourse.id,
        { userId: 'missing-user', role: CourseMembershipRole.STUDENT },
        actor,
      )

      await expect(addMember).rejects.toBeInstanceOf(NotFoundException)
      await expect(addMember).rejects.toMatchObject({
        response: { code: ADMIN_COURSES_ERROR_CODES.USER_NOT_FOUND },
      })
    })

    it('throws conflict if membership already exists', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)
      repository.users.set('user-1', { id: 'user-1' })
      repository.memberships.set(`${dummyCourse.id}_user-1`, {
        id: 'mem-1',
        userId: 'user-1',
        role: CourseMembershipRole.STUDENT,
        createdAt,
        user: {
          id: 'user-1',
          email: 'user_1@demo.com',
          displayName: 'User 1',
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
        },
      })

      const addMember = service.addMember(
        dummyCourse.id,
        { userId: 'user-1', role: CourseMembershipRole.STUDENT },
        actor,
      )

      await expect(addMember).rejects.toBeInstanceOf(ConflictException)
      await expect(addMember).rejects.toMatchObject({
        response: { code: ADMIN_COURSES_ERROR_CODES.MEMBER_ALREADY_EXISTS },
      })
    })

    it('removes a member from a course', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)
      repository.memberships.set(`${dummyCourse.id}_user-1`, {
        id: 'mem-1',
        userId: 'user-1',
        role: CourseMembershipRole.STUDENT,
        createdAt,
        user: {
          id: 'user-1',
          email: 'user_1@demo.com',
          displayName: 'User 1',
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
        },
      })

      await service.removeMember(
        dummyCourse.id,
        'user-1',
        actor,
        requestContext,
      )

      expect(repository.removeMember).toHaveBeenCalledTimes(1)
      expect(repository.removeMember).toHaveBeenCalledWith({
        courseId: dummyCourse.id,
        userId: 'user-1',
        actorUserId: actor.id,
        requestContext,
      })
    })

    it('throws not found if membership missing when removing', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)

      const removeMember = service.removeMember(
        dummyCourse.id,
        'missing',
        actor,
      )

      await expect(removeMember).rejects.toBeInstanceOf(NotFoundException)
      await expect(removeMember).rejects.toMatchObject({
        response: { code: ADMIN_COURSES_ERROR_CODES.MEMBER_NOT_FOUND },
      })
    })

    it('lists members for a course', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, {
        ...dummyCourse,
        memberships: [
          {
            id: 'mem-1',
            userId: 'user-1',
            role: CourseMembershipRole.STUDENT,
            createdAt,
            user: {
              id: 'user-1',
              email: 'student@demo.com',
              displayName: 'Student',
              role: UserRole.STUDENT,
              status: UserStatus.ACTIVE,
            },
          },
          {
            id: 'mem-2',
            userId: 'user-2',
            role: CourseMembershipRole.INSTRUCTOR,
            createdAt,
            user: {
              id: 'user-2',
              email: 'instructor@demo.com',
              displayName: 'Instructor',
              role: UserRole.INSTRUCTOR,
              status: UserStatus.ACTIVE,
            },
          },
        ],
      })
      repository.memberships.set(`${dummyCourse.id}_user-1`, {
        id: 'mem-1',
        userId: 'user-1',
        role: CourseMembershipRole.STUDENT,
        createdAt,
        user: {
          id: 'user-1',
          email: 'student@demo.com',
          displayName: 'Student',
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
        },
      })
      repository.memberships.set(`${dummyCourse.id}_user-2`, {
        id: 'mem-2',
        userId: 'user-2',
        role: CourseMembershipRole.INSTRUCTOR,
        createdAt,
        user: {
          id: 'user-2',
          email: 'instructor@demo.com',
          displayName: 'Instructor',
          role: UserRole.INSTRUCTOR,
          status: UserStatus.ACTIVE,
        },
      })

      const response = await service.listMembers(dummyCourse.id)

      expect(response.members).toHaveLength(2)
      expect(response.members[0].role).toBe(CourseMembershipRole.INSTRUCTOR)
      expect(response.members[1].role).toBe(CourseMembershipRole.STUDENT)
    })

    it('throws not found if course missing when listing members', async () => {
      const { service } = buildService()

      const listMembers = service.listMembers('missing')

      await expect(listMembers).rejects.toBeInstanceOf(NotFoundException)
      await expect(listMembers).rejects.toMatchObject({
        response: { code: ADMIN_COURSES_ERROR_CODES.COURSE_NOT_FOUND },
      })
    })

    it('updates a member role', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)
      repository.memberships.set(`${dummyCourse.id}_user-1`, {
        id: 'mem-1',
        userId: 'user-1',
        role: CourseMembershipRole.STUDENT,
        createdAt,
        user: {
          id: 'user-1',
          email: 'student@demo.com',
          displayName: 'Student',
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
        },
      })

      const response = await service.updateMemberRole(
        dummyCourse.id,
        'user-1',
        { role: CourseMembershipRole.INSTRUCTOR },
        actor,
        requestContext,
      )

      expect(repository.updateMemberRole).toHaveBeenCalledTimes(1)
      expect(repository.updateMemberRole).toHaveBeenCalledWith({
        courseId: dummyCourse.id,
        userId: 'user-1',
        role: CourseMembershipRole.INSTRUCTOR,
        actorUserId: actor.id,
        requestContext,
      })
      expect(response.member.role).toBe(CourseMembershipRole.INSTRUCTOR)
    })

    it('throws not found if membership missing when updating role', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)

      const updateMemberRole = service.updateMemberRole(
        dummyCourse.id,
        'missing',
        { role: CourseMembershipRole.INSTRUCTOR },
        actor,
      )

      await expect(updateMemberRole).rejects.toBeInstanceOf(NotFoundException)
      await expect(updateMemberRole).rejects.toMatchObject({
        response: { code: ADMIN_COURSES_ERROR_CODES.MEMBER_NOT_FOUND },
      })
    })
  })

  describe('materials', () => {
    const dummyMaterial: AdminMaterialRecord = {
      id: 'mat-1',
      courseId: dummyCourse.id,
      uploadedById: 'user-1',
      uploadedBy: {
        id: 'user-1',
        email: 'instructor@morshid.demo',
        displayName: 'Demo Instructor',
        role: UserRole.INSTRUCTOR,
        status: UserStatus.ACTIVE,
      },
      title: 'Old Title',
      originalFilename: 'file.pdf',
      storagePath: '/path/file.pdf',
      sha256Hash: 'hash',
      status: MaterialStatus.PROCESSING,
      extractedTextLength: null,
      chunkCount: null,
      errorMessage: null,
      createdAt,
      updatedAt,
    }

    it('lists materials for a course', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)
      repository.materials.set(dummyMaterial.id, dummyMaterial)

      const response = await service.listMaterials(dummyCourse.id)
      expect(response.materials).toHaveLength(1)
      expect(response.materials[0].id).toBe(dummyMaterial.id)
    })

    it('gets a single material', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)
      repository.materials.set(dummyMaterial.id, dummyMaterial)

      const response = await service.getMaterial(
        dummyCourse.id,
        dummyMaterial.id,
      )
      expect(response.material.id).toBe(dummyMaterial.id)
    })

    it('updates a material title', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)
      repository.materials.set(dummyMaterial.id, dummyMaterial)

      const response = await service.updateMaterial(
        dummyCourse.id,
        dummyMaterial.id,
        { title: 'New Title' },
        actor,
        requestContext,
      )

      expect(repository.updateMaterial).toHaveBeenCalledTimes(1)
      expect(response.material.title).toBe('New Title')
    })

    it('throws not found if updating missing material', async () => {
      const { repository, service } = buildService()
      repository.courses.set(dummyCourse.id, dummyCourse)

      const updateMaterial = service.updateMaterial(
        dummyCourse.id,
        'missing',
        { title: 'New Title' },
        actor,
      )

      await expect(updateMaterial).rejects.toBeInstanceOf(NotFoundException)
      await expect(updateMaterial).rejects.toMatchObject({
        response: { code: ADMIN_COURSES_ERROR_CODES.MATERIAL_NOT_FOUND },
      })
    })
  })
})
