import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../../src/modules/audit/audit.public'
import type { IdentitySessionResponse } from '../../src/modules/identity/identity.types'
import { COURSE_ADMINISTRATION_ERROR_CODES } from '../../src/modules/courses/course-administration.errors'
import type {
  CourseAdministrationDetailResponseDto,
  CourseAdministrationListResponseDto,
  CourseAdministrationMemberListResponseDto,
  CourseAdministrationMemberResponseDto,
} from '../../src/modules/courses/course-administration.types'
import type {
  MaterialAdministrationListResponseDto,
  MaterialAdministrationResponseDto,
} from '../../src/modules/materials/catalog/material-administration.types'
import { MaterialProcessingScheduler } from '../../src/modules/materials/processing/material-processing.scheduler'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
import { P0_DEMO_PASSWORD } from '../../src/seeds/p0-demo.seed'
import { CourseMembershipRole } from '../../src/generated/prisma/client'
import { IdentityTestStore } from '../support/identity-test-store'
import { NoopMaterialProcessingScheduler } from '../support/noop-material-processing-scheduler'

const auditUserAgent = 'Morshid admin courses e2e'
const anyString = expect.any(String) as unknown as string

describe('Course administration (e2e)', () => {
  let app: INestApplication<App>
  let store: IdentityTestStore

  function requireUserByEmail(email: string) {
    const user = store.findUserByEmail(email)

    if (user === null) {
      throw new Error(`Missing test user ${email}`)
    }

    return user
  }

  const redisService = {
    ping: jest.fn().mockResolvedValue('PONG'),
  }

  beforeAll(() => {
    process.env.DATABASE_URL =
      'postgresql://morshid:morshid_local_password@localhost:5432/morshid'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.AUTH_ACCESS_TOKEN_SECRET =
      'test-access-token-secret-with-at-least-32-characters'
    process.env.AUTH_REFRESH_TOKEN_HASH_SECRET =
      'test-refresh-token-hash-secret-with-at-least-32-characters'
    process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS = '900'
    process.env.AUTH_REFRESH_TOKEN_TTL_DAYS = '7'
  })

  beforeEach(async () => {
    store = new IdentityTestStore()
    jest.clearAllMocks()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(store.prisma)
      .overrideProvider(RedisService)
      .useValue(redisService)
      .overrideProvider(MaterialProcessingScheduler)
      .useClass(NoopMaterialProcessingScheduler)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  async function signInAs(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    return (response.body as IdentitySessionResponse).accessToken
  }

  const pythonCourseId = '00000000-0000-4000-8000-000000000101'
  const pythonMaterialId = '00000000-0000-4000-8000-000000000401'

  describe('GET /api/v1/admin/courses', () => {
    it('returns all courses and their metadata for admins', async () => {
      const token = await signInAs('admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const body = response.body as CourseAdministrationListResponseDto

      expect(body.courses).toHaveLength(2)
      expect(body.courses.map((c) => c.code)).toEqual([
        'HIDDEN-ISOLATION',
        'PYTHON-PROG-P0',
      ])

      const pythonCourse = body.courses[1]
      expect(pythonCourse.id).toBe(pythonCourseId)
      expect(pythonCourse.adminMetadata.memberCount).toBeGreaterThan(0)
      expect(pythonCourse.adminMetadata.memberships).toBeInstanceOf(Array)
    })

    it('does not count removed memberships in course administration', async () => {
      const student = requireUserByEmail('student1@morshid.demo')
      const membership = store.memberships.find(
        (candidate) =>
          candidate.userId === student.id &&
          candidate.courseId === pythonCourseId,
      )

      if (membership === undefined) {
        throw new Error('Expected the student membership to exist')
      }

      membership.removedAt = new Date('2026-07-08T00:00:00.000Z')

      const token = await signInAs('admin@morshid.demo')
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const pythonCourse = (
        response.body as CourseAdministrationListResponseDto
      ).courses.find((course) => course.id === pythonCourseId)

      expect(pythonCourse?.adminMetadata.memberCount).toBe(3)
      expect(
        pythonCourse?.adminMetadata.memberships.some(
          (candidate) => candidate.userId === student.id,
        ),
      ).toBe(false)
    })

    it('rejects non-admin users', async () => {
      const token = await signInAs('instructor@morshid.demo')

      await request(app.getHttpServer())
        .get('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${token}`)
        .expect(403)
    })
  })

  describe('GET /api/v1/admin/courses/:courseId', () => {
    it('returns a single course and its metadata', async () => {
      const token = await signInAs('admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/courses/${pythonCourseId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const body = response.body as CourseAdministrationDetailResponseDto
      expect(body.course.id).toBe(pythonCourseId)
      expect(body.course.code).toBe('PYTHON-PROG-P0')
    })

    it('rejects malformed course ids with a stable 400 instead of a database error', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .get('/api/v1/admin/courses/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400)
    })

    it('returns 404 for non-existent course', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .get('/api/v1/admin/courses/00000000-0000-4000-8000-000000009999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404)
        .expect({
          code: COURSE_ADMINISTRATION_ERROR_CODES.COURSE_NOT_FOUND,
          message: 'Course was not found',
          courseId: '00000000-0000-4000-8000-000000009999',
        })
    })
  })

  describe('POST /api/v1/admin/courses', () => {
    it('creates a course and records an audit event', async () => {
      const token = await signInAs('admin@morshid.demo')
      const admin = requireUserByEmail('admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', auditUserAgent)
        .send({ code: 'CS-201', title: 'Data Structures' })
        .expect(201)

      const body = response.body as CourseAdministrationDetailResponseDto
      expect(body.course).toMatchObject({
        code: 'CS-201',
        title: 'Data Structures',
      })
      expect(Object.keys(body.course).sort()).toEqual([
        'adminMetadata',
        'code',
        'id',
        'title',
      ])
      expect(body.course.adminMetadata).toMatchObject({
        createdById: admin.id,
        memberCount: 0,
        instructorCount: 0,
        studentCount: 0,
        materialCount: 0,
        activeMaterialCount: 0,
        memberships: [],
      })
      expect(
        [...store.auditLogs.values()].filter(
          (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_COURSE_CREATED,
        ),
      ).toEqual([
        expect.objectContaining({
          actorUserId: admin.id,
          targetId: body.course.id,
          courseId: body.course.id,
          metadata: { code: 'CS-201', title: 'Data Structures' },
        }),
      ])
    })

    it('rejects duplicate course codes', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .post('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'PYTHON-PROG-P0', title: 'Duplicate' })
        .expect(409)
        .expect({
          code: COURSE_ADMINISTRATION_ERROR_CODES.COURSE_CODE_ALREADY_EXISTS,
          message: 'A course with this code already exists',
          courseCode: 'PYTHON-PROG-P0',
        })

      expect(store.courses.size).toBe(2)
    })

    it('returns field-level validation errors for invalid payloads', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .post('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'C', title: 'ab', description: 'unsupported' })
        .expect(400)
        .expect((response) => {
          const body = response.body as {
            code: string
            message: string
            errors: { field: string; message: string }[]
          }

          expect(body.code).toBe(
            COURSE_ADMINISTRATION_ERROR_CODES.INVALID_REQUEST,
          )
          expect(body.message).toBe('Invalid course administration request')
          expect([...new Set(body.errors.map((error) => error.field))].sort())
            // `body` is the unrecognized-key issue raised by the strict schema.
            .toEqual(['body', 'code', 'title'])
        })

      expect(store.courses.size).toBe(2)
      expect(
        [...store.auditLogs.values()].filter(
          (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_COURSE_CREATED,
        ),
      ).toEqual([])
    })

    it('rejects non-admin course creation', async () => {
      const token = await signInAs('instructor@morshid.demo')

      await request(app.getHttpServer())
        .post('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'CS-999', title: 'Unauthorized Course' })
        .expect(403)

      expect(store.courses.size).toBe(2)
    })
  })

  describe('PATCH /api/v1/admin/courses/:courseId', () => {
    it('updates a course and records before/after audit evidence', async () => {
      const token = await signInAs('admin@morshid.demo')
      const admin = requireUserByEmail('admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/admin/courses/${pythonCourseId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', auditUserAgent)
        .send({ code: 'PYTHON-201', title: 'Advanced Python' })
        .expect(200)

      const body = response.body as CourseAdministrationDetailResponseDto
      expect(body.course).toMatchObject({
        id: pythonCourseId,
        code: 'PYTHON-201',
        title: 'Advanced Python',
      })
      expect(
        [...store.auditLogs.values()].filter(
          (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_COURSE_UPDATED,
        ),
      ).toEqual([
        expect.objectContaining({
          actorUserId: admin.id,
          targetId: pythonCourseId,
          metadata: {
            before: {
              code: 'PYTHON-PROG-P0',
              title: 'Python Programming',
            },
            after: {
              code: 'PYTHON-201',
              title: 'Advanced Python',
            },
            changedFields: ['code', 'title'],
          },
        }),
      ])
    })

    it('rejects an empty update without writing an audit event', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/courses/${pythonCourseId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400)
        .expect((response) => {
          expect(response.body).toMatchObject({
            code: COURSE_ADMINISTRATION_ERROR_CODES.INVALID_REQUEST,
          })
        })

      expect(
        [...store.auditLogs.values()].filter(
          (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_COURSE_UPDATED,
        ),
      ).toEqual([])
    })

    it('rejects a code that is already taken by another course', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/courses/${pythonCourseId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'HIDDEN-ISOLATION' })
        .expect(409)
        .expect({
          code: COURSE_ADMINISTRATION_ERROR_CODES.COURSE_CODE_ALREADY_EXISTS,
          message: 'A course with this code already exists',
          courseCode: 'HIDDEN-ISOLATION',
        })

      expect(store.courses.get(pythonCourseId)?.code).toBe('PYTHON-PROG-P0')
      expect(
        [...store.auditLogs.values()].filter(
          (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_COURSE_UPDATED,
        ),
      ).toEqual([])
    })

    it('returns not found for an unknown course', async () => {
      const token = await signInAs('admin@morshid.demo')
      const missingCourseId = '00000000-0000-4000-8000-000000009999'

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/courses/${missingCourseId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Nope' })
        .expect(404)
        .expect({
          code: COURSE_ADMINISTRATION_ERROR_CODES.COURSE_NOT_FOUND,
          message: 'Course was not found',
          courseId: missingCourseId,
        })
    })

    it('rejects malformed course ids', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .patch('/api/v1/admin/courses/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Nope' })
        .expect(400)
    })

    it('rejects non-admin updates', async () => {
      const token = await signInAs('instructor@morshid.demo')

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/courses/${pythonCourseId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Nope' })
        .expect(403)
    })
  })

  describe('POST /api/v1/admin/courses/:courseId/members', () => {
    it('adds a member and creates an audit log', async () => {
      const token = await signInAs('admin@morshid.demo')
      const admin = requireUserByEmail('admin@morshid.demo')
      const targetUser = requireUserByEmail('admin@morshid.demo') // Not in python course initially

      const response = await request(app.getHttpServer())
        .post(`/api/v1/admin/courses/${pythonCourseId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', auditUserAgent)
        .send({
          userId: targetUser.id,
          role: CourseMembershipRole.STUDENT,
        })
        .expect(201)

      const body = response.body as CourseAdministrationMemberResponseDto
      expect(body.member.userId).toBe(targetUser.id)
      expect(body.member.role).toBe(CourseMembershipRole.STUDENT)

      const auditLogs = [...store.auditLogs.values()].filter(
        (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_COURSE_MEMBER_ADDED,
      )

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0]).toEqual(
        expect.objectContaining({
          actorUserId: admin.id,
          action: AUDIT_EVENT_ACTIONS.ADMIN_COURSE_MEMBER_ADDED,
          targetType: AUDIT_TARGET_TYPES.COURSE_MEMBERSHIP,
          courseId: pythonCourseId,
          ip: anyString,
          userAgent: auditUserAgent,
        }),
      )
      expect(auditLogs[0]?.metadata).toEqual(
        expect.objectContaining({
          userId: targetUser.id,
          role: CourseMembershipRole.STUDENT,
        }),
      )
    })

    it('rejects duplicate membership', async () => {
      const token = await signInAs('admin@morshid.demo')
      const targetUser = requireUserByEmail('student1@morshid.demo') // Already in python course

      await request(app.getHttpServer())
        .post(`/api/v1/admin/courses/${pythonCourseId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: targetUser.id,
          role: CourseMembershipRole.STUDENT,
        })
        .expect(409)
        .expect({
          code: COURSE_ADMINISTRATION_ERROR_CODES.MEMBER_ALREADY_EXISTS,
          message: 'User is already a member of this course',
          courseId: pythonCourseId,
          userId: targetUser.id,
        })
    })

    it('rejects validation errors', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .post(`/api/v1/admin/courses/${pythonCourseId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: 'not-a-uuid',
          role: 'INVALID_ROLE',
        })
        .expect(400)
    })
  })

  describe('DELETE /api/v1/admin/courses/:courseId/members/:userId', () => {
    it('removes a member and creates an audit log', async () => {
      const token = await signInAs('admin@morshid.demo')
      const admin = requireUserByEmail('admin@morshid.demo')
      const targetUser = requireUserByEmail('student1@morshid.demo')

      await request(app.getHttpServer())
        .delete(
          `/api/v1/admin/courses/${pythonCourseId}/members/${targetUser.id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', auditUserAgent)
        .expect(204)

      const auditLogs = [...store.auditLogs.values()].filter(
        (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_COURSE_MEMBER_REMOVED,
      )

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0]).toEqual(
        expect.objectContaining({
          actorUserId: admin.id,
          action: AUDIT_EVENT_ACTIONS.ADMIN_COURSE_MEMBER_REMOVED,
          targetType: AUDIT_TARGET_TYPES.COURSE_MEMBERSHIP,
          courseId: pythonCourseId,
        }),
      )
      expect(auditLogs[0]?.metadata).toEqual(
        expect.objectContaining({
          userId: targetUser.id,
        }),
      )
    })

    it('returns 404 for non-existent membership', async () => {
      const token = await signInAs('admin@morshid.demo')
      const targetUser = requireUserByEmail('admin@morshid.demo')

      await request(app.getHttpServer())
        .delete(
          `/api/v1/admin/courses/${pythonCourseId}/members/${targetUser.id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404)
        .expect({
          code: COURSE_ADMINISTRATION_ERROR_CODES.MEMBER_NOT_FOUND,
          message: 'Course membership was not found',
          courseId: pythonCourseId,
          userId: targetUser.id,
        })
    })
  })

  describe('GET /api/v1/admin/courses/:courseId/members', () => {
    it('lists members for a course', async () => {
      const token = await signInAs('admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/courses/${pythonCourseId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const body = response.body as CourseAdministrationMemberListResponseDto
      const member = body.members[0]
      expect(member.id).toEqual(anyString)
      expect(member.userId).toEqual(anyString)
      expect(member.role).toEqual(anyString)
      expect(member.user.id).toEqual(anyString)
      expect(member.user.email).toEqual(anyString)
      expect(member.user.displayName).toEqual(anyString)
    })

    it('returns 404 for non-existent course', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .get(
          '/api/v1/admin/courses/00000000-0000-4000-8000-000000009999/members',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404)
        .expect({
          code: COURSE_ADMINISTRATION_ERROR_CODES.COURSE_NOT_FOUND,
          message: 'Course was not found',
          courseId: '00000000-0000-4000-8000-000000009999',
        })
    })
  })

  describe('PATCH /api/v1/admin/courses/:courseId/members/:userId', () => {
    it('updates a member role and creates an audit log', async () => {
      const token = await signInAs('admin@morshid.demo')
      const admin = requireUserByEmail('admin@morshid.demo')
      const targetUser = requireUserByEmail('student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .patch(
          `/api/v1/admin/courses/${pythonCourseId}/members/${targetUser.id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', auditUserAgent)
        .send({
          role: CourseMembershipRole.INSTRUCTOR,
        })
        .expect(200)

      const body = response.body as CourseAdministrationMemberResponseDto
      expect(body.member.userId).toBe(targetUser.id)
      expect(body.member.role).toBe(CourseMembershipRole.INSTRUCTOR)

      const auditLogs = [...store.auditLogs.values()].filter(
        (log) =>
          log.action === AUDIT_EVENT_ACTIONS.ADMIN_COURSE_MEMBER_ROLE_CHANGED,
      )

      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0]).toEqual(
        expect.objectContaining({
          actorUserId: admin.id,
          action: AUDIT_EVENT_ACTIONS.ADMIN_COURSE_MEMBER_ROLE_CHANGED,
          targetType: AUDIT_TARGET_TYPES.COURSE_MEMBERSHIP,
          courseId: pythonCourseId,
          ip: anyString,
          userAgent: auditUserAgent,
        }),
      )
      expect(auditLogs[0]?.metadata).toEqual(
        expect.objectContaining({
          userId: targetUser.id,
          role: CourseMembershipRole.INSTRUCTOR,
        }),
      )
    })

    it('returns 404 for non-existent membership', async () => {
      const token = await signInAs('admin@morshid.demo')
      const targetUser = requireUserByEmail('admin@morshid.demo')

      await request(app.getHttpServer())
        .patch(
          `/api/v1/admin/courses/${pythonCourseId}/members/${targetUser.id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .send({
          role: CourseMembershipRole.INSTRUCTOR,
        })
        .expect(404)
        .expect({
          code: COURSE_ADMINISTRATION_ERROR_CODES.MEMBER_NOT_FOUND,
          message: 'Course membership was not found',
          courseId: pythonCourseId,
          userId: targetUser.id,
        })
    })

    it('rejects validation errors', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .patch(
          `/api/v1/admin/courses/${pythonCourseId}/members/${pythonCourseId}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .send({
          role: 'INVALID_ROLE',
        })
        .expect(400)
    })
  })

  describe('GET /api/v1/admin/courses/:courseId/materials', () => {
    it('lists materials for a course', async () => {
      const token = await signInAs('admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/courses/${pythonCourseId}/materials`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const body = response.body as MaterialAdministrationListResponseDto
      expect(body.materials).toHaveLength(1)
      expect(body.materials[0]?.title).toBe('Python Basics')
    })
  })

  describe('GET /api/v1/admin/courses/:courseId/materials/:materialId', () => {
    it('gets a specific material', async () => {
      const token = await signInAs('admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/admin/courses/${pythonCourseId}/materials/${pythonMaterialId}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const body = response.body as MaterialAdministrationResponseDto
      expect(body.material.id).toBe(pythonMaterialId)
    })
  })

  describe('PATCH /api/v1/admin/courses/:courseId/materials/:materialId', () => {
    it('updates material title and creates audit log', async () => {
      const token = await signInAs('admin@morshid.demo')
      const admin = requireUserByEmail('admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .patch(
          `/api/v1/admin/courses/${pythonCourseId}/materials/${pythonMaterialId}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', auditUserAgent)
        .send({
          title: 'Updated Python Basics',
        })
        .expect(200)

      const body = response.body as MaterialAdministrationResponseDto
      expect(body.material.title).toBe('Updated Python Basics')

      const auditLogs = [...store.auditLogs.values()].filter(
        (log) => log.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPDATED,
      )

      expect(auditLogs).toEqual([
        expect.objectContaining({
          actorUserId: admin.id,
          action: AUDIT_EVENT_ACTIONS.MATERIAL_UPDATED,
          targetType: AUDIT_TARGET_TYPES.MATERIAL,
          targetId: pythonMaterialId,
          courseId: pythonCourseId,
          metadata: {
            title: 'Updated Python Basics',
          },
        }),
      ])
    })

    it('rejects validation errors', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .patch(
          `/api/v1/admin/courses/${pythonCourseId}/materials/${pythonMaterialId}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '', // Too short
        })
        .expect(400)
    })
  })
})
