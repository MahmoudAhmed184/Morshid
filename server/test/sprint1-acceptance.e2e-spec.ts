import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { AUTH_ERROR_CODES } from '../src/modules/auth/auth.dto'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import {
  P0_DEMO_COURSE,
  P0_DEMO_PASSWORD,
  P0_HIDDEN_ISOLATION_COURSE,
} from '../src/seeds/p0-demo.seed'
import { AuthTestStore } from './support/auth-test-store'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const pythonCourseId = '00000000-0000-4000-8000-000000000101'
const pythonMaterialId = '00000000-0000-4000-8000-000000000401'

// ---------------------------------------------------------------------------
// Shared env setup (mirrors every other e2e spec)
// ---------------------------------------------------------------------------

function setTestEnv() {
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
}

// ===========================================================================
// 1. Seeded Role Authentication
// ===========================================================================

describe('acceptance/authentication — seeded role sign-in', () => {
  setTestEnv()

  let app: INestApplication<App>
  let store: AuthTestStore

  const redisService = { ping: jest.fn().mockResolvedValue('PONG') }

  beforeEach(async () => {
    store = new AuthTestStore()
    jest.clearAllMocks()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(store.prisma)
      .overrideProvider(RedisService)
      .useValue(redisService)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('admin can sign in and receives a valid Bearer session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email: 'admin@morshid.demo', password: P0_DEMO_PASSWORD })
      .expect(200)

    const body = res.body as AuthSessionResponse
    expect(body.tokenType).toBe('Bearer')
    expect(body.accessToken).toEqual(expect.any(String))
    expect(body.user).toMatchObject({
      email: 'admin@morshid.demo',
      role: 'ADMIN',
      status: 'ACTIVE',
    })
    expect(body.user.courses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: P0_DEMO_COURSE.code,
          membershipRole: null,
        }),
        expect.objectContaining({
          code: P0_HIDDEN_ISOLATION_COURSE.code,
          membershipRole: null,
        }),
      ]),
    )
  })

  it('instructor can sign in and receives a valid Bearer session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email: 'instructor@morshid.demo', password: P0_DEMO_PASSWORD })
      .expect(200)

    const body = res.body as AuthSessionResponse
    expect(body.tokenType).toBe('Bearer')
    expect(body.accessToken).toEqual(expect.any(String))
    expect(body.user).toMatchObject({
      email: 'instructor@morshid.demo',
      role: 'INSTRUCTOR',
      status: 'ACTIVE',
    })
    expect(body.user.courses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: P0_DEMO_COURSE.code,
          membershipRole: 'INSTRUCTOR',
        }),
      ]),
    )
  })

  it('student can sign in and receives a valid Bearer session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email: 'student1@morshid.demo', password: P0_DEMO_PASSWORD })
      .expect(200)

    const body = res.body as AuthSessionResponse
    expect(body.tokenType).toBe('Bearer')
    expect(body.accessToken).toEqual(expect.any(String))
    expect(body.user).toMatchObject({
      email: 'student1@morshid.demo',
      role: 'STUDENT',
      status: 'ACTIVE',
    })
    expect(body.user.courses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: P0_DEMO_COURSE.code,
          membershipRole: 'STUDENT',
        }),
      ]),
    )
  })

  it('disabled user cannot sign in — returns 403 ACCOUNT_DISABLED', async () => {
    store.disableUser('student1@morshid.demo')

    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email: 'student1@morshid.demo', password: P0_DEMO_PASSWORD })
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })
  })

  it('disabled user cannot access protected resources with a valid token', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email: 'student1@morshid.demo', password: P0_DEMO_PASSWORD })
      .expect(200)
    const token = (signIn.body as AuthSessionResponse).accessToken

    store.disableUser('student1@morshid.demo')

    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })
  })
})

// ===========================================================================
// 2. Role Boundaries
// ===========================================================================

describe('acceptance/authorization — role boundaries', () => {
  setTestEnv()

  let app: INestApplication<App>
  let store: AuthTestStore

  const redisService = { ping: jest.fn().mockResolvedValue('PONG') }

  function requireUserByEmail(email: string) {
    const user = store.findUserByEmail(email)
    if (user === null) throw new Error(`Missing test user ${email}`)
    return user
  }

  async function signInAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)
    return (res.body as AuthSessionResponse).accessToken
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
      .useValue(redisService)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('unauthenticated requests to protected endpoints return 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/courses').expect(401)
    await request(app.getHttpServer()).get('/api/v1/admin/courses').expect(401)
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401)
    await request(app.getHttpServer()).get('/api/v1/me').expect(401)
  })

  it('student cannot access admin courses endpoints — returns 403', async () => {
    const token = await signInAs('student1@morshid.demo')
    const insufficientRole = {
      code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
      message: 'Insufficient role',
    }

    await request(app.getHttpServer())
      .get('/api/v1/admin/courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect(insufficientRole)

    await request(app.getHttpServer())
      .get(`/api/v1/admin/courses/${pythonCourseId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect(insufficientRole)

    await request(app.getHttpServer())
      .get(`/api/v1/admin/courses/${pythonCourseId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect(insufficientRole)
  })

  it('student cannot access admin users endpoints — returns 403', async () => {
    const token = await signInAs('student1@morshid.demo')
    const insufficientRole = {
      code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
      message: 'Insufficient role',
    }

    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect(insufficientRole)

    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'new@morshid.demo',
        displayName: 'New',
        role: 'STUDENT',
        password: 'Abc1!abc',
      })
      .expect(403)
      .expect(insufficientRole)
  })

  it('instructor cannot access admin endpoints — returns 403', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const insufficientRole = {
      code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
      message: 'Insufficient role',
    }

    await request(app.getHttpServer())
      .get('/api/v1/admin/courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect(insufficientRole)

    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect(insufficientRole)
  })

  it('student privilege escalation to admin is impossible', async () => {
    const token = await signInAs('student1@morshid.demo')
    const student = requireUserByEmail('student1@morshid.demo')

    expect(student.role).toBe('STUDENT')

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${student.id}/disable`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)

    expect(requireUserByEmail('student1@morshid.demo').role).toBe('STUDENT')
  })
})

// ===========================================================================
// 3. Course Scoping
// ===========================================================================

describe('acceptance/course-scoping — resources scoped to the authenticated user', () => {
  setTestEnv()

  let app: INestApplication<App>

  const redisService = { ping: jest.fn().mockResolvedValue('PONG') }

  async function signInAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)
    return (res.body as AuthSessionResponse).accessToken
  }

  beforeEach(async () => {
    const store = new AuthTestStore()
    jest.clearAllMocks()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(store.prisma)
      .overrideProvider(RedisService)
      .useValue(redisService)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('admin receives all courses including those with no memberships', async () => {
    const token = await signInAs('admin@morshid.demo')
    const res = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const codes = (res.body as { courses: { code: string }[] }).courses.map(
      (c) => c.code,
    )
    expect(codes).toContain(P0_DEMO_COURSE.code)
    expect(codes).toContain(P0_HIDDEN_ISOLATION_COURSE.code)
  })

  it('instructor only receives courses they teach', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const res = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const courses = (
      res.body as { courses: { code: string; membershipRole: string }[] }
    ).courses
    expect(courses.every((c) => c.membershipRole === 'INSTRUCTOR')).toBe(true)
    expect(courses.map((c) => c.code)).toContain(P0_DEMO_COURSE.code)
    expect(courses.map((c) => c.code)).not.toContain(
      P0_HIDDEN_ISOLATION_COURSE.code,
    )
  })

  it('student only receives courses they are enrolled in', async () => {
    const token = await signInAs('student1@morshid.demo')
    const res = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const courses = (
      res.body as { courses: { code: string; membershipRole: string }[] }
    ).courses
    expect(courses.every((c) => c.membershipRole === 'STUDENT')).toBe(true)
    expect(courses.map((c) => c.code)).toContain(P0_DEMO_COURSE.code)
    expect(courses.map((c) => c.code)).not.toContain(
      P0_HIDDEN_ISOLATION_COURSE.code,
    )
  })
})

// ===========================================================================
// 4. Admin Audit Events
// ===========================================================================

describe('acceptance/admin-audit — every admin mutation emits an audit record', () => {
  setTestEnv()

  let app: INestApplication<App>
  let store: AuthTestStore

  const redisService = { ping: jest.fn().mockResolvedValue('PONG') }

  function requireUserByEmail(email: string) {
    const user = store.findUserByEmail(email)
    if (user === null) throw new Error(`Missing test user ${email}`)
    return user
  }

  async function signInAsAdmin(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email: 'admin@morshid.demo', password: P0_DEMO_PASSWORD })
      .expect(200)
    return (res.body as AuthSessionResponse).accessToken
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
      .useValue(redisService)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('adding a course member emits ADMIN_COURSE_MEMBER_ADDED audit record', async () => {
    const token = await signInAsAdmin()
    const admin = requireUserByEmail('admin@morshid.demo')

    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${pythonCourseId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: admin.id, role: 'STUDENT' })
      .expect(201)

    const memberAdded = [...store.auditLogs.values()].filter(
      (l) => l.action === 'admin.course_member_added',
    )
    expect(memberAdded).toHaveLength(1)
    expect(memberAdded[0]).toMatchObject({
      actorUserId: admin.id,
      action: 'admin.course_member_added',
      targetType: 'course_membership',
      courseId: pythonCourseId,
    })
  })

  it('removing a course member emits ADMIN_COURSE_MEMBER_REMOVED audit record', async () => {
    const token = await signInAsAdmin()
    const admin = requireUserByEmail('admin@morshid.demo')
    const student = requireUserByEmail('student1@morshid.demo')

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/courses/${pythonCourseId}/members/${student.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)

    const memberRemoved = [...store.auditLogs.values()].filter(
      (l) => l.action === 'admin.course_member_removed',
    )
    expect(memberRemoved).toHaveLength(1)
    expect(memberRemoved[0]).toMatchObject({
      actorUserId: admin.id,
      action: 'admin.course_member_removed',
      targetType: 'course_membership',
      courseId: pythonCourseId,
    })
  })

  it('updating a member role emits ADMIN_COURSE_MEMBER_ROLE_CHANGED audit record', async () => {
    const token = await signInAsAdmin()
    const admin = requireUserByEmail('admin@morshid.demo')
    const student = requireUserByEmail('student1@morshid.demo')

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/courses/${pythonCourseId}/members/${student.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'INSTRUCTOR' })
      .expect(200)

    const roleChanged = [...store.auditLogs.values()].filter(
      (l) => l.action === 'admin.course_member_role_changed',
    )
    expect(roleChanged).toHaveLength(1)
    expect(roleChanged[0]).toMatchObject({
      actorUserId: admin.id,
      action: 'admin.course_member_role_changed',
      targetType: 'course_membership',
      courseId: pythonCourseId,
    })
  })

  it('updating a material title emits ADMIN_COURSE_UPDATED audit record', async () => {
    const token = await signInAsAdmin()
    const admin = requireUserByEmail('admin@morshid.demo')

    await request(app.getHttpServer())
      .patch(
        `/api/v1/admin/courses/${pythonCourseId}/materials/${pythonMaterialId}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Accepted Title' })
      .expect(200)

    const updated = [...store.auditLogs.values()].filter(
      (l) => l.action === 'admin.course_updated',
    )
    expect(updated).toHaveLength(1)
    expect(updated[0]).toMatchObject({
      actorUserId: admin.id,
      action: 'admin.course_updated',
      targetType: 'material',
      targetId: pythonMaterialId,
      courseId: pythonCourseId,
      metadata: { title: 'Accepted Title' },
    })
  })

  it('creating a user emits ADMIN_ACCOUNT_CREATED audit record without leaking credentials', async () => {
    const token = await signInAsAdmin()
    const admin = requireUserByEmail('admin@morshid.demo')

    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'acceptance@morshid.demo',
        displayName: 'Acceptance User',
        role: 'STUDENT',
        password: 'Acceptance1!',
      })
      .expect(201)

    const created = [...store.auditLogs.values()].filter(
      (l) => l.action === 'admin.account_created',
    )
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      actorUserId: admin.id,
      action: 'admin.account_created',
      targetType: 'user',
    })
    expect(created[0]?.metadata).toMatchObject({
      email: 'acceptance@morshid.demo',
      role: 'STUDENT',
    })
    expect(JSON.stringify(created[0]?.metadata)).not.toContain('Acceptance1!')
  })

  it('disabling a user emits ADMIN_ACCOUNT_DISABLED audit record', async () => {
    const token = await signInAsAdmin()
    const admin = requireUserByEmail('admin@morshid.demo')
    const student = requireUserByEmail('student1@morshid.demo')

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${student.id}/disable`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const disabled = [...store.auditLogs.values()].filter(
      (l) => l.action === 'admin.account_disabled',
    )
    expect(disabled).toHaveLength(1)
    expect(disabled[0]).toMatchObject({
      actorUserId: admin.id,
      action: 'admin.account_disabled',
      targetType: 'user',
      targetId: student.id,
    })
  })
})

// ===========================================================================
// 5. Role Shells — reachability
// ===========================================================================

describe('acceptance/role-shells — each role shell endpoint responds successfully', () => {
  setTestEnv()

  let app: INestApplication<App>
  let store: AuthTestStore

  const redisService = { ping: jest.fn().mockResolvedValue('PONG') }

  async function signInAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)
    return (res.body as AuthSessionResponse).accessToken
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
      .useValue(redisService)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('landing shell: /health/live returns 200', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(200)
  })

  it('admin shell: /api/v1/admin/courses returns 200 for admin', async () => {
    const token = await signInAs('admin@morshid.demo')
    await request(app.getHttpServer())
      .get('/api/v1/admin/courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
  })

  it('admin shell: /api/v1/admin/users returns 200 for admin', async () => {
    const token = await signInAs('admin@morshid.demo')
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
  })

  it('instructor shell: /api/v1/courses returns 200 for instructor', async () => {
    const token = await signInAs('instructor@morshid.demo')
    await request(app.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
  })

  it('student shell: /api/v1/courses returns 200 for student', async () => {
    const token = await signInAs('student1@morshid.demo')
    await request(app.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
  })

  it('all role shells require authentication — 401 without token', async () => {
    await request(app.getHttpServer()).get('/api/v1/courses').expect(401)
    await request(app.getHttpServer()).get('/api/v1/admin/courses').expect(401)
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401)
    await request(app.getHttpServer()).get('/api/v1/me').expect(401)
  })

  // Keep store reference used above; suppress unused warning
  afterAll(() => {
    void store
  })
})

// ===========================================================================
// 6. Swagger / OpenAPI
// ===========================================================================

describe('acceptance/swagger — OpenAPI endpoints are reachable', () => {
  setTestEnv()

  let app: INestApplication<App>

  const redisService = { ping: jest.fn().mockResolvedValue('PONG') }

  beforeEach(async () => {
    const store = new AuthTestStore()
    jest.clearAllMocks()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(store.prisma)
      .overrideProvider(RedisService)
      .useValue(redisService)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('GET /docs-json returns 200 and a valid OpenAPI document', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json').expect(200)

    const doc = res.body as {
      openapi: string
      info: { title: string; version: string }
      paths: Record<string, unknown>
    }
    expect(doc.openapi).toMatch(/^3\./)
    expect(doc.info.title).toBe('Morshid API')
    expect(doc.info.version).toEqual(expect.any(String))
    expect(Object.keys(doc.paths).length).toBeGreaterThan(0)
  })

  it('GET /docs returns 200 — Swagger UI is reachable', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200)
  })

  it('OpenAPI document exposes the auth sign-in path', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json').expect(200)
    const doc = res.body as { paths: Record<string, unknown> }
    expect(doc.paths).toHaveProperty('/api/v1/auth/sign-in')
  })

  it('OpenAPI document exposes admin endpoints', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json').expect(200)
    const doc = res.body as { paths: Record<string, unknown> }
    const adminPaths = Object.keys(doc.paths).filter((p) =>
      p.startsWith('/api/v1/admin'),
    )
    expect(adminPaths.length).toBeGreaterThan(0)
  })
})
