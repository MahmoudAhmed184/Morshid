import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { AUTH_ERROR_CODES } from '../src/modules/auth/auth.dto'
import type {
  AuthSessionResponse,
  MeResponse,
} from '../src/modules/auth/auth.dto'
import { AuditService } from '../src/modules/audit/audit.service'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import {
  P0_DEMO_COURSE,
  P0_DEMO_PASSWORD,
  P0_HIDDEN_ISOLATION_COURSE,
} from '../src/seeds/p0-demo.seed'
import { AuthTestStore } from './support/auth-test-store'

function readSessionBody(response: { body: unknown }): AuthSessionResponse {
  return response.body as AuthSessionResponse
}

function readMeBody(response: { body: unknown }): MeResponse {
  return response.body as MeResponse
}

async function signInAs(app: INestApplication<App>, email: string) {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/sign-in')
    .send({ email, password: P0_DEMO_PASSWORD })
    .expect(200)

  return readSessionBody(response)
}

describe('RBAC Boundary Tests (e2e)', () => {
  let app: INestApplication<App>
  let store: AuthTestStore

  const auditService = {
    recordEvent: jest.fn().mockResolvedValue(undefined),
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
      .useValue(store.redis)
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

  // =========================================================================
  // ACCEPTANCE CRITERION 1: Student is denied Admin and Instructor-only APIs
  // =========================================================================

  describe('Student role boundaries', () => {
    it('student sign-in returns STUDENT role', async () => {
      const session = await signInAs(app, 'student1@morshid.demo')

      expect(session.user.role).toBe('STUDENT')
      expect(session.user.status).toBe('ACTIVE')
    })

    it('student /me returns only enrolled courses, not all courses', async () => {
      const session = await signInAs(app, 'student1@morshid.demo')

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)

      const me = readMeBody(meResponse)

      expect(me.user.role).toBe('STUDENT')
      expect(me.user.courses).toHaveLength(1)
      expect(me.user.courses[0].code).toBe(P0_DEMO_COURSE.code)
      expect(me.user.courses[0].membershipRole).toBe('STUDENT')
    })

    it('student course list never includes HIDDEN-ISOLATION', async () => {
      const session = await signInAs(app, 'student1@morshid.demo')

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)

      const me = readMeBody(meResponse)
      const courseCodes = me.user.courses.map((c) => c.code)

      expect(courseCodes).not.toContain(P0_HIDDEN_ISOLATION_COURSE.code)
    })

    // Future API specs — become runnable once endpoints are built
    it.todo(
      'student cannot call POST /api/v1/admin/users (admin-only endpoint)',
    )
    it.todo(
      'student cannot call GET /api/v1/admin/courses (admin-only endpoint)',
    )
    it.todo(
      'student cannot call POST /api/v1/courses/:id/materials (instructor-only)',
    )
    it.todo('student cannot access the instructor review queue')
    it.todo(
      'student cannot disable another user account (admin-only operation)',
    )
  })

  // =========================================================================
  // ACCEPTANCE CRITERION 2: Student cannot access the hidden test course
  // =========================================================================

  describe('Course isolation — SCN-006: hidden course boundary', () => {
    it('student3 sign-in response does not include HIDDEN-ISOLATION course', async () => {
      const session = await signInAs(app, 'student3@morshid.demo')
      const courseCodes = session.user.courses.map((c) => c.code)

      expect(courseCodes).toContain(P0_DEMO_COURSE.code)
      expect(courseCodes).not.toContain(P0_HIDDEN_ISOLATION_COURSE.code)
      expect(session.user.courses).toHaveLength(1)
    })

    it('student3 /me response courses contain only PYTHON-PROG-P0', async () => {
      const session = await signInAs(app, 'student3@morshid.demo')

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)

      const me = readMeBody(meResponse)

      expect(me.user.courses).toHaveLength(1)
      expect(me.user.courses[0].code).toBe(P0_DEMO_COURSE.code)
      expect(me.user.courses[0].title).toBe(P0_DEMO_COURSE.title)
    })

    it('no student sees HIDDEN-ISOLATION in their course list', async () => {
      const studentEmails = [
        'student1@morshid.demo',
        'student2@morshid.demo',
        'student3@morshid.demo',
      ]

      for (const email of studentEmails) {
        const session = await signInAs(app, email)
        const courseCodes = session.user.courses.map((c) => c.code)

        expect(courseCodes).not.toContain(P0_HIDDEN_ISOLATION_COURSE.code)
        expect(session.user.courses).toHaveLength(1)
      }
    })

    // Future API specs
    it.todo('student3 cannot create a chat session in HIDDEN-ISOLATION course')
    it.todo('student3 cannot query materials from HIDDEN-ISOLATION course')
    it.todo('student3 cannot send messages targeting HIDDEN-ISOLATION course')
    it.todo(
      'course-isolation denial is audited as ACCESS_COURSE_BOUNDARY_DENIED',
    )
  })

  // =========================================================================
  // ACCEPTANCE CRITERION 3: Instructor cannot access courses they do not own
  // =========================================================================

  describe('Instructor course boundaries', () => {
    it('instructor sign-in shows only PYTHON-PROG-P0 with INSTRUCTOR membership role', async () => {
      const session = await signInAs(app, 'instructor@morshid.demo')

      expect(session.user.role).toBe('INSTRUCTOR')
      expect(session.user.courses).toHaveLength(1)
      expect(session.user.courses[0].code).toBe(P0_DEMO_COURSE.code)
      expect(session.user.courses[0].membershipRole).toBe('INSTRUCTOR')
    })

    it('instructor /me does not include HIDDEN-ISOLATION course', async () => {
      const session = await signInAs(app, 'instructor@morshid.demo')

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)

      const me = readMeBody(meResponse)
      const courseCodes = me.user.courses.map((c) => c.code)

      expect(courseCodes).not.toContain(P0_HIDDEN_ISOLATION_COURSE.code)
      expect(me.user.courses).toHaveLength(1)
    })

    it('instructor can only see courses where they have membership', async () => {
      const session = await signInAs(app, 'instructor@morshid.demo')

      // Instructor should see exactly 1 course
      expect(session.user.courses).toHaveLength(1)

      // And that course must have INSTRUCTOR membership role
      for (const course of session.user.courses) {
        expect(course.membershipRole).toBe('INSTRUCTOR')
      }
    })

    // Future API specs
    it.todo(
      'instructor cannot upload materials to a course they are not assigned to',
    )
    it.todo('instructor cannot view review queue for courses they do not own')
    it.todo('instructor cannot access student chat sessions from other courses')
    it.todo(
      'instructor cannot perform admin-only operations like disabling users',
    )
  })

  // =========================================================================
  // ACCEPTANCE CRITERION 4: Admin can access P0 Admin operations while still
  //                          requiring authentication
  // =========================================================================

  describe('Admin authentication and visibility', () => {
    it('admin sign-in succeeds and returns ADMIN role', async () => {
      const session = await signInAs(app, 'admin@morshid.demo')

      expect(session.user.role).toBe('ADMIN')
      expect(session.user.status).toBe('ACTIVE')
      expect(session.tokenType).toBe('Bearer')
      expect(session.accessToken).toEqual(expect.any(String))
    })

    it('admin /me returns all courses including HIDDEN-ISOLATION', async () => {
      const session = await signInAs(app, 'admin@morshid.demo')

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)

      const me = readMeBody(meResponse)
      const courseCodes = me.user.courses.map((c) => c.code)

      expect(me.user.role).toBe('ADMIN')
      expect(courseCodes).toContain(P0_DEMO_COURSE.code)
      expect(courseCodes).toContain(P0_HIDDEN_ISOLATION_COURSE.code)
      expect(me.user.courses).toHaveLength(2)
    })

    it('admin has no direct course memberships (membershipRole is null)', async () => {
      const session = await signInAs(app, 'admin@morshid.demo')

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)

      const me = readMeBody(meResponse)

      for (const course of me.user.courses) {
        expect(course.membershipRole).toBeNull()
      }
    })

    it('unauthenticated GET /me is rejected with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .expect(401)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            code: AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN,
          })
        })
    })

    // Future API specs
    it.todo('admin can list all users (future admin endpoint)')
    it.todo('admin can create courses (future admin endpoint)')
    it.todo('admin can disable/enable user accounts (future admin endpoint)')
    it.todo('admin without valid token cannot access admin APIs')
  })

  // =========================================================================
  // CROSS-CUTTING: Authentication baseline for guarded routes
  // =========================================================================

  describe('Authentication baseline', () => {
    it('request without Authorization header to /me returns 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .expect(401)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            code: AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN,
          })
        })
    })

    it('request with invalid Bearer token to /me returns 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', 'Bearer completely-invalid-token')
        .expect(401)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            code: AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN,
          })
        })
    })

    it('request with malformed Authorization header to /me returns 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', 'NotBearer some-token')
        .expect(401)
    })

    it('request with empty Bearer value to /me returns 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', 'Bearer ')
        .expect(401)
    })
  })

  // =========================================================================
  // CROSS-CUTTING: Role-course visibility consistency
  // =========================================================================

  describe('Role-course visibility consistency', () => {
    it('sign-in and /me return consistent course lists for student', async () => {
      const session = await signInAs(app, 'student1@morshid.demo')

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)

      const me = readMeBody(meResponse)

      expect(me.user.courses).toEqual(session.user.courses)
    })

    it('sign-in and /me return consistent course lists for instructor', async () => {
      const session = await signInAs(app, 'instructor@morshid.demo')

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)

      const me = readMeBody(meResponse)

      expect(me.user.courses).toEqual(session.user.courses)
    })

    it('sign-in and /me return consistent course lists for admin', async () => {
      const session = await signInAs(app, 'admin@morshid.demo')

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)

      const me = readMeBody(meResponse)

      expect(me.user.courses).toEqual(session.user.courses)
    })
  })
})
