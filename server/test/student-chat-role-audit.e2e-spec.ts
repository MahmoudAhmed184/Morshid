import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { AUTH_ERROR_CODES } from '../src/modules/auth/auth.dto'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../src/modules/audit/audit.constants'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import { P0_DEMO_PASSWORD } from '../src/seeds/p0-demo.seed'
import { AuthTestStore } from './support/auth-test-store'

// The Python demo course id seeded by AuthTestStore.
const DEMO_COURSE_ID = '00000000-0000-4000-8000-000000000101'
const UNKNOWN_COURSE_ID = '11111111-1111-4111-8111-111111111111'

describe('Student chat role-denial auditing (e2e)', () => {
  let app: INestApplication<App>
  let store: AuthTestStore

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

  async function signInAs(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    return (response.body as AuthSessionResponse).accessToken
  }

  function rbacDeniedAudits() {
    return [...store.auditLogs.values()].filter(
      (log) => log.action === AUDIT_EVENT_ACTIONS.ACCESS_RBAC_DENIED,
    )
  }

  function chatAccessDeniedAudits() {
    return [...store.auditLogs.values()].filter(
      (log) => log.action === AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED,
    )
  }

  it('rejects an Instructor with 403 and audits exactly one generic RBAC denial with the course context', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const instructor = store.findUserByEmail('instructor@morshid.demo')

    await request(app.getHttpServer())
      .get(`/api/v1/courses/${DEMO_COURSE_ID}/chat-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
        message: 'Insufficient role',
      })

    // The global RolesGuard is the single source of truth for role denials, so
    // there is exactly one audit row and it is the generic RBAC-denied event —
    // no duplicate chat-scoped role-denial row.
    const denials = rbacDeniedAudits()
    expect(denials).toHaveLength(1)
    expect(denials[0]).toMatchObject({
      action: AUDIT_EVENT_ACTIONS.ACCESS_RBAC_DENIED,
      targetType: AUDIT_TARGET_TYPES.SYSTEM,
      targetId: null,
      actorUserId: instructor?.id,
      courseId: null,
      metadata: {
        requiredRoles: ['STUDENT'],
        actorRole: 'INSTRUCTOR',
        method: 'GET',
        unverifiedCourseId: DEMO_COURSE_ID,
      },
    })
    expect(chatAccessDeniedAudits()).toHaveLength(0)
  })

  it('keeps the raw course id out of the FK column for a role denial on an unknown course', async () => {
    const token = await signInAs('instructor@morshid.demo')

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${UNKNOWN_COURSE_ID}/chat-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should never be created' })
      .expect(403)

    const denials = rbacDeniedAudits()
    expect(denials).toHaveLength(1)
    // The guard never verifies the course, so the raw id is kept out of the FK
    // column and preserved only in unconstrained JSONB metadata.
    expect(denials[0].courseId).toBeNull()
    expect(denials[0].metadata).toMatchObject({
      actorRole: 'INSTRUCTOR',
      method: 'POST',
      unverifiedCourseId: UNKNOWN_COURSE_ID,
    })
  })

  it('still rejects an Admin from the Student-only chat endpoints and audits one RBAC denial', async () => {
    const token = await signInAs('admin@morshid.demo')

    await request(app.getHttpServer())
      .get(`/api/v1/courses/${DEMO_COURSE_ID}/chat-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)

    expect(rbacDeniedAudits()).toHaveLength(1)
    expect(chatAccessDeniedAudits()).toHaveLength(0)
  })
})
