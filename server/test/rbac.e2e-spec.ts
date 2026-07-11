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

  })

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
  })

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
  })

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
  })
})
