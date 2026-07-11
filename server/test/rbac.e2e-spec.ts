import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { AuditService } from '../src/modules/audit/audit.service'
import type { MeResponse } from '../src/modules/auth/auth.dto'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import {
  P0_DEMO_COURSE,
  P0_DEMO_PASSWORD,
  P0_HIDDEN_ISOLATION_COURSE,
} from '../src/seeds/p0-demo.seed'
import { AuthTestStore } from './support/auth-test-store'

// ── Helpers ──────────────────────────────────────────────────────

const auditUserAgent = 'Morshid e2e'

async function signInAndGetToken(
  app: INestApplication,
  email: string,
): Promise<string> {
  const response = await request(app.getHttpServer() as App)
    .post('/api/v1/auth/sign-in')
    .set('User-Agent', auditUserAgent)
    .send({ email, password: P0_DEMO_PASSWORD })
    .expect(200)

  return (response.body as { accessToken: string }).accessToken
}

function authHeader(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`]
}

// ── Suite ─────────────────────────────────────────────────────────

describe('RBAC (e2e)', () => {
  let app: INestApplication<App>
  let store: AuthTestStore

  const auditService = {
    recordEvent: jest.fn().mockResolvedValue(undefined),
  }

  const redisMock = {
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
    store = new AuthTestStore()
    jest.clearAllMocks()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(store.prisma)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(AuditService)
      .useValue(auditService)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  // ── Student boundaries ───────────────────────────────────────────

  describe('Student boundaries', () => {
    it('returns the correct role and identity for a signed-in student', async () => {
      const token = await signInAndGetToken(app, 'student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse

      expect(meResponse.user.role).toBe('STUDENT')
      expect(meResponse.user.email).toBe('student1@morshid.demo')
      expect(meResponse.user.status).toBe('ACTIVE')
    })

    it('shows only the assigned Python course and not the hidden isolation course', async () => {
      const token = await signInAndGetToken(app, 'student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse
      const courseCodes = meResponse.user.courses.map((c) => c.code)

      expect(courseCodes).toHaveLength(1)
      expect(courseCodes).toContain(P0_DEMO_COURSE.code)
      expect(courseCodes).not.toContain(P0_HIDDEN_ISOLATION_COURSE.code)
    })

    it('returns a different identity for student2', async () => {
      const token = await signInAndGetToken(app, 'student2@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse

      expect(meResponse.user.email).toBe('student2@morshid.demo')
      expect(meResponse.user.displayName).toBe('P0 Demo Student 2')
    })

    it('returns a different identity for student3', async () => {
      const token = await signInAndGetToken(app, 'student3@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse

      expect(meResponse.user.email).toBe('student3@morshid.demo')
      expect(meResponse.user.displayName).toBe('P0 Demo Student 3')
    })

    /*
     * Skipped: The POST /api/v1/admin/users endpoint does not exist yet.
     * When implemented, a student must be rejected with 403 FORBIDDEN.
     */
    it.skip('student cannot call POST /api/v1/admin/users', async () => {
      const token = await signInAndGetToken(app, 'student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/users')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .send({
          email: 'newstudent@morshid.demo',
          displayName: 'New Student',
          role: 'STUDENT',
          password: 'TempPass123!',
        })

      expect(response.status).toBe(403)
    })

    /*
     * Skipped: The GET /api/v1/admin/users endpoint does not exist yet.
     * When implemented, a student must be rejected with 403 FORBIDDEN.
     */
    it.skip('student cannot list users via GET /api/v1/admin/users', async () => {
      const token = await signInAndGetToken(app, 'student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))

      expect(response.status).toBe(403)
    })

    /*
     * Skipped: The PATCH /api/v1/admin/users/:id endpoint does not exist yet.
     * When implemented, a student must be rejected with 403 FORBIDDEN.
     */
    it.skip('student cannot update a user via PATCH /api/v1/admin/users/:id', async () => {
      const token = await signInAndGetToken(app, 'student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .patch('/api/v1/admin/users/00000000-0000-4000-8000-000000000001')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .send({ displayName: 'Hacked Name' })

      expect(response.status).toBe(403)
    })

    /*
     * Skipped: The POST /api/v1/admin/courses endpoint does not exist yet.
     * When implemented, a student must be rejected with 403 FORBIDDEN.
     */
    it.skip('student cannot create a course via POST /api/v1/admin/courses', async () => {
      const token = await signInAndGetToken(app, 'student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/courses')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .send({
          code: 'NEW-COURSE',
          title: 'New Course',
        })

      expect(response.status).toBe(403)
    })

    /*
     * Skipped: The POST /api/v1/instructor/courses/:courseId/materials
     * endpoint does not exist yet.
     * When implemented, a student must be rejected with 403 FORBIDDEN.
     */
    it.skip('student cannot upload materials via instructor endpoints', async () => {
      const token = await signInAndGetToken(app, 'student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .post(
          '/api/v1/instructor/courses/00000000-0000-4000-8000-000000000101/materials',
        )
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))

      expect(response.status).toBe(403)
    })

    /*
     * Skipped: The GET /api/v1/instructor/reviews endpoint does not exist yet.
     * When implemented, a student must be rejected with 403 FORBIDDEN.
     */
    it.skip('student cannot access the instructor review queue', async () => {
      const token = await signInAndGetToken(app, 'student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/instructor/reviews')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))

      expect(response.status).toBe(403)
    })
  })

  // ── Instructor boundaries ────────────────────────────────────────

  describe('Instructor boundaries', () => {
    it('returns the correct role and identity for a signed-in instructor', async () => {
      const token = await signInAndGetToken(app, 'instructor@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse

      expect(meResponse.user.role).toBe('INSTRUCTOR')
      expect(meResponse.user.email).toBe('instructor@morshid.demo')
    })

    it('shows the Python course with INSTRUCTOR membership role in /me', async () => {
      const token = await signInAndGetToken(app, 'instructor@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse
      const courseCodes = meResponse.user.courses.map((c) => c.code)

      expect(courseCodes).toContain(P0_DEMO_COURSE.code)
      expect(meResponse.user.courses[0].membershipRole).toBe('INSTRUCTOR')
    })

    /*
     * Skipped: The GET /api/v1/admin/users endpoint does not exist yet.
     * When implemented, an instructor must be rejected with 403 FORBIDDEN.
     */
    it.skip('instructor cannot list users via GET /api/v1/admin/users', async () => {
      const token = await signInAndGetToken(app, 'instructor@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))

      expect(response.status).toBe(403)
    })

    /*
     * Skipped: The POST /api/v1/admin/users endpoint does not exist yet.
     * When implemented, an instructor must be rejected with 403 FORBIDDEN.
     */
    it.skip('instructor cannot create a user via POST /api/v1/admin/users', async () => {
      const token = await signInAndGetToken(app, 'instructor@morshid.demo')

      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/users')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .send({
          email: 'newstudent@morshid.demo',
          displayName: 'New Student',
          role: 'STUDENT',
          password: 'TempPass123!',
        })

      expect(response.status).toBe(403)
    })

    /*
     * Skipped: The PATCH /api/v1/admin/users/:id/disable endpoint
     * does not exist yet.
     * When implemented, an instructor must be rejected with 403 FORBIDDEN.
     */
    it.skip('instructor cannot disable a user via PATCH /api/v1/admin/users/:id/disable', async () => {
      const token = await signInAndGetToken(app, 'instructor@morshid.demo')

      const response = await request(app.getHttpServer())
        .patch(
          '/api/v1/admin/users/00000000-0000-4000-8000-000000000003/disable',
        )
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))

      expect(response.status).toBe(403)
    })

    /*
     * Skipped: The POST /api/v1/admin/courses endpoint does not exist yet.
     * When implemented, an instructor must be rejected with 403 FORBIDDEN.
     */
    it.skip('instructor cannot create a course via POST /api/v1/admin/courses', async () => {
      const token = await signInAndGetToken(app, 'instructor@morshid.demo')

      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/courses')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .send({
          code: 'NEW-COURSE',
          title: 'New Course',
        })

      expect(response.status).toBe(403)
    })

    /*
     * Skipped: The GET /api/v1/instructor/courses/:courseId/materials endpoint
     * does not exist yet.
     * When implemented, an instructor must be rejected with 403 FORBIDDEN when
     * requesting materials for a course they do not own.
     */
    it.skip('instructor cannot access materials of an unowned course', async () => {
      const token = await signInAndGetToken(app, 'instructor@morshid.demo')

      const response = await request(app.getHttpServer())
        .get(
          '/api/v1/instructor/courses/00000000-0000-4000-8000-000000000102/materials',
        )
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))

      expect(response.status).toBe(403)
    })
  })

  // ── Admin boundaries ─────────────────────────────────────────────

  describe('Admin boundaries', () => {
    it('returns the correct role and identity for a signed-in admin', async () => {
      const token = await signInAndGetToken(app, 'admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse

      expect(meResponse.user.role).toBe('ADMIN')
      expect(meResponse.user.email).toBe('admin@morshid.demo')
    })

    /*
     * Skipped: The POST /api/v1/admin/users endpoint does not exist yet.
     * When implemented, an admin must be able to create a user (201 CREATED).
     */
    it.skip('admin can create a user via POST /api/v1/admin/users', async () => {
      const token = await signInAndGetToken(app, 'admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/users')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .send({
          email: 'newstudent@morshid.demo',
          displayName: 'New Student',
          role: 'STUDENT',
          password: 'TempPass123!',
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        email: 'newstudent@morshid.demo',
        displayName: 'New Student',
        role: 'STUDENT',
      })
    })

    /*
     * Skipped: The GET /api/v1/admin/users endpoint does not exist yet.
     * When implemented, an admin must be able to list users (200 OK).
     */
    it.skip('admin can list users via GET /api/v1/admin/users', async () => {
      const token = await signInAndGetToken(app, 'admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))

      expect(response.status).toBe(200)
      const body = response.body as { users?: unknown }
      expect(Array.isArray(body.users ?? body)).toBe(true)
    })

    /*
     * Skipped: The PATCH /api/v1/admin/users/:id/disable endpoint
     * does not exist yet.
     * When implemented, an admin must be able to disable a user (200 OK).
     */
    it.skip('admin can disable a user via PATCH /api/v1/admin/users/:id/disable', async () => {
      const token = await signInAndGetToken(app, 'admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .patch(
          '/api/v1/admin/users/00000000-0000-4000-8000-000000000003/disable',
        )
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))

      expect(response.status).toBe(200)
    })

    /*
     * Skipped: The PATCH /api/v1/admin/users/:id/enable endpoint
     * does not exist yet.
     * When implemented, an admin must be able to enable a user (200 OK).
     */
    it.skip('admin can enable a user via PATCH /api/v1/admin/users/:id/enable', async () => {
      const token = await signInAndGetToken(app, 'admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .patch(
          '/api/v1/admin/users/00000000-0000-4000-8000-000000000003/enable',
        )
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))

      expect(response.status).toBe(200)
    })

    /*
     * Skipped: The POST /api/v1/admin/courses endpoint does not exist yet.
     * When implemented, an admin must be able to create a course (201 CREATED).
     */
    it.skip('admin can create a course via POST /api/v1/admin/courses', async () => {
      const token = await signInAndGetToken(app, 'admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/courses')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .send({
          code: 'NEW-COURSE',
          title: 'New Course',
        })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        code: 'NEW-COURSE',
        title: 'New Course',
      })
    })

    /*
     * Skipped: The POST /api/v1/admin/courses/:courseId/members endpoint
     * does not exist yet.
     * When implemented, an admin must be able to add a member (201 CREATED).
     */
    it.skip('admin can add a member via POST /api/v1/admin/courses/:courseId/members', async () => {
      const token = await signInAndGetToken(app, 'admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .post(
          '/api/v1/admin/courses/00000000-0000-4000-8000-000000000101/members',
        )
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .send({
          userId: '00000000-0000-4000-8000-000000000001',
          role: 'INSTRUCTOR',
        })

      expect(response.status).toBe(201)
    })

    /*
     * Skipped: The DELETE /api/v1/admin/courses/:courseId/members/:userId
     * endpoint does not exist yet.
     * When implemented, an admin must be able to remove a member (200 OK / 204 NO CONTENT).
     */
    it.skip('admin can remove a member via DELETE /api/v1/admin/courses/:courseId/members/:userId', async () => {
      const token = await signInAndGetToken(app, 'admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .delete(
          '/api/v1/admin/courses/00000000-0000-4000-8000-000000000101/members/00000000-0000-4000-8000-000000000003',
        )
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))

      expect(response.status).toBe(200)
    })
  })

  // ── Course boundaries ────────────────────────────────────────────

  describe('Course boundaries', () => {
    it('student1 sees only the Python course with STUDENT membership role', async () => {
      const token = await signInAndGetToken(app, 'student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse

      expect(meResponse.user.courses).toEqual([
        expect.objectContaining({
          code: P0_DEMO_COURSE.code,
          title: P0_DEMO_COURSE.title,
          membershipRole: 'STUDENT',
        }),
      ])
    })

    it('instructor sees the Python course with INSTRUCTOR membership role', async () => {
      const token = await signInAndGetToken(app, 'instructor@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse

      expect(meResponse.user.courses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: P0_DEMO_COURSE.code,
            title: P0_DEMO_COURSE.title,
            membershipRole: 'INSTRUCTOR',
          }),
        ]),
      )
    })

    it('admin sees both courses with null membership roles', async () => {
      const token = await signInAndGetToken(app, 'admin@morshid.demo')

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse

      expect(meResponse.user.courses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: P0_DEMO_COURSE.code,
            title: P0_DEMO_COURSE.title,
            membershipRole: null,
          }),
          expect.objectContaining({
            code: P0_HIDDEN_ISOLATION_COURSE.code,
            title: P0_HIDDEN_ISOLATION_COURSE.title,
            membershipRole: null,
          }),
        ]),
      )
      expect(meResponse.user.courses).toHaveLength(2)
    })

    /*
     * Skipped: The POST /api/v1/student/courses/:courseId/sessions endpoint
     * does not exist yet.
     * When implemented, a student must be rejected with 403 FORBIDDEN when
     * trying to create a session in an unassigned course.
     */
    it.skip('student cannot create a session for an unassigned course', async () => {
      const token = await signInAndGetToken(app, 'student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .post(
          '/api/v1/student/courses/00000000-0000-4000-8000-000000000102/sessions',
        )
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .send({ title: 'Test Session' })

      expect(response.status).toBe(403)
    })

    /*
     * Skipped: The GET /api/v1/student/courses/:courseId/materials endpoint
     * does not exist yet.
     * When implemented, a student must be rejected with 403 FORBIDDEN when
     * trying to list materials for an unassigned course.
     */
    it.skip('student cannot access materials of an unassigned course', async () => {
      const token = await signInAndGetToken(app, 'student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .get(
          '/api/v1/student/courses/00000000-0000-4000-8000-000000000102/materials',
        )
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))

      expect(response.status).toBe(403)
    })
  })
})
