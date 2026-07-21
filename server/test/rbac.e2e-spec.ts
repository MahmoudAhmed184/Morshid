import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { AuditService } from '../src/modules/audit/audit.service'
import { AUTH_ERROR_CODES } from '../src/modules/auth/auth.dto'
import type { MeResponse } from '../src/modules/auth/auth.dto'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import { STUDENT_CHAT_ERROR_CODES } from '../src/modules/student-chat/student-chat.errors'
import {
  P0_DEMO_COURSE,
  P0_DEMO_PASSWORD,
  P0_HIDDEN_ISOLATION_COURSE,
} from '../src/seeds/p0-demo.seed'
import { AuthTestStore } from './support/auth-test-store'
import { NoopMaterialProcessingScheduler } from './support/noop-material-processing-scheduler'

const auditUserAgent = 'Morshid e2e'

const ADMIN_ONLY_ENDPOINTS = [
  '/api/v1/admin/users',
  '/api/v1/admin/courses',
  '/api/v1/admin/audit',
] as const

const insufficientRoleBody = {
  code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
  message: 'Insufficient role',
}

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

function loginAsStudent(
  app: INestApplication,
  email = 'student1@morshid.demo',
): Promise<string> {
  return signInAndGetToken(app, email)
}

function loginAsInstructor(app: INestApplication): Promise<string> {
  return signInAndGetToken(app, 'instructor@morshid.demo')
}

function loginAsAdmin(app: INestApplication): Promise<string> {
  return signInAndGetToken(app, 'admin@morshid.demo')
}

function courseIdByCode(store: AuthTestStore, code: string): string {
  const course = [...store.courses.values()].find((c) => c.code === code)

  if (!course) {
    throw new Error(`Missing seeded course ${code}`)
  }

  return course.id
}

describe('RBAC (e2e)', () => {
  let app: INestApplication<App>
  let store: AuthTestStore

  const auditService = {
    recordEvent: jest.fn().mockResolvedValue(undefined),
  }

  const redisMock = {
    ping: jest.fn().mockResolvedValue('PONG'),
  }

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
      .overrideProvider(MaterialProcessingScheduler)
      .useClass(NoopMaterialProcessingScheduler)
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

  it('rejects unauthenticated access to /me with 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('User-Agent', auditUserAgent)
      .expect(401)
  })

  describe('Student boundaries', () => {
    it.each([
      ['student1@morshid.demo', 'P0 Demo Student 1'],
      ['student2@morshid.demo', 'P0 Demo Student 2'],
      ['student3@morshid.demo', 'P0 Demo Student 3'],
    ])(
      'returns the STUDENT role and own identity for %s',
      async (email, displayName) => {
        const token = await loginAsStudent(app, email)

        const response = await request(app.getHttpServer())
          .get('/api/v1/me')
          .set('User-Agent', auditUserAgent)
          .set(...authHeader(token))
          .expect(200)

        const meResponse = response.body as MeResponse

        expect(meResponse.user.role).toBe('STUDENT')
        expect(meResponse.user.status).toBe('ACTIVE')
        expect(meResponse.user.email).toBe(email)
        expect(meResponse.user.displayName).toBe(displayName)
      },
    )

    it.each(ADMIN_ONLY_ENDPOINTS)(
      'denies a student %s with 403 INSUFFICIENT_ROLE',
      async (endpoint) => {
        const token = await loginAsStudent(app)

        await request(app.getHttpServer())
          .get(endpoint)
          .set('User-Agent', auditUserAgent)
          .set(...authHeader(token))
          .expect(403)
          .expect(insufficientRoleBody)
      },
    )

    it('denies a student access to the hidden isolation course with 403', async () => {
      const token = await loginAsStudent(app)
      const hiddenCourseId = courseIdByCode(
        store,
        P0_HIDDEN_ISOLATION_COURSE.code,
      )

      await request(app.getHttpServer())
        .get(`/api/v1/courses/${hiddenCourseId}/chat-sessions`)
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(403)
        .expect((res) => {
          expect(res.body).toMatchObject({
            code: STUDENT_CHAT_ERROR_CODES.ACTIVE_STUDENT_MEMBERSHIP_REQUIRED,
          })
        })
    })
  })

  describe('Instructor boundaries', () => {
    it('returns the correct role and identity for a signed-in instructor', async () => {
      const token = await loginAsInstructor(app)

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse

      expect(meResponse.user.role).toBe('INSTRUCTOR')
      expect(meResponse.user.email).toBe('instructor@morshid.demo')
    })

    it.each(ADMIN_ONLY_ENDPOINTS)(
      'denies an instructor %s with 403 INSUFFICIENT_ROLE',
      async (endpoint) => {
        const token = await loginAsInstructor(app)

        await request(app.getHttpServer())
          .get(endpoint)
          .set('User-Agent', auditUserAgent)
          .set(...authHeader(token))
          .expect(403)
          .expect(insufficientRoleBody)
      },
    )

    it('denies an instructor the Student-only chat endpoints with 403', async () => {
      const token = await loginAsInstructor(app)
      const pythonCourseId = courseIdByCode(store, P0_DEMO_COURSE.code)

      await request(app.getHttpServer())
        .get(`/api/v1/courses/${pythonCourseId}/chat-sessions`)
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(403)
        .expect(insufficientRoleBody)
    })
  })

  describe('Admin boundaries', () => {
    it('returns the correct role and identity for a signed-in admin', async () => {
      const token = await loginAsAdmin(app)

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse

      expect(meResponse.user.role).toBe('ADMIN')
      expect(meResponse.user.email).toBe('admin@morshid.demo')
    })

    it('allows an admin to perform an admin-only operation (list users)', async () => {
      const token = await loginAsAdmin(app)

      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      expect(Array.isArray((response.body as { users: unknown[] }).users)).toBe(
        true,
      )
    })

    it('still requires authentication for admin operations (401 without a token)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('User-Agent', auditUserAgent)
        .expect(401)
    })
  })

  describe('Course boundaries', () => {
    it('student1 sees only the Python course with STUDENT membership role', async () => {
      const token = await loginAsStudent(app)

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse
      const courseCodes = meResponse.user.courses.map((c) => c.code)

      expect(courseCodes).toHaveLength(1)
      expect(courseCodes).not.toContain(P0_HIDDEN_ISOLATION_COURSE.code)
      expect(meResponse.user.courses).toEqual([
        expect.objectContaining({
          code: P0_DEMO_COURSE.code,
          title: P0_DEMO_COURSE.title,
          membershipRole: 'STUDENT',
        }),
      ])
    })

    it('instructor sees only the Python course with INSTRUCTOR membership role', async () => {
      const token = await loginAsInstructor(app)

      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('User-Agent', auditUserAgent)
        .set(...authHeader(token))
        .expect(200)

      const meResponse = response.body as MeResponse
      const courseCodes = meResponse.user.courses.map((c) => c.code)

      expect(courseCodes).toHaveLength(1)
      expect(courseCodes).not.toContain(P0_HIDDEN_ISOLATION_COURSE.code)
      expect(meResponse.user.courses).toEqual([
        expect.objectContaining({
          code: P0_DEMO_COURSE.code,
          title: P0_DEMO_COURSE.title,
          membershipRole: 'INSTRUCTOR',
        }),
      ])
    })

    it('admin sees both courses with null membership roles', async () => {
      const token = await loginAsAdmin(app)

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
  })
})
