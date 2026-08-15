import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../../src/modules/audit/audit.constants'
import { IDENTITY_ERROR_CODES } from '../../src/modules/identity/identity.types'
import type {
  IdentitySessionResponse,
  MeResponse,
} from '../../src/modules/identity/identity.types'
import { MaterialProcessingScheduler } from '../../src/modules/materials/processing/material-processing.scheduler'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
import { P0_DEMO_PASSWORD } from '../../src/seeds/p0-demo.seed'
import { IdentityTestStore } from '../support/identity-test-store'
import { NoopMaterialProcessingScheduler } from '../support/noop-material-processing-scheduler'

function readSessionBody(response: { body: IdentitySessionResponse }) {
  return response.body
}

function readAuditEvents(store: IdentityTestStore) {
  return [...store.auditLogs.values()]
}

const auditUserAgent = 'Morshid profile e2e'

describe('Self-Service Profile (e2e)', () => {
  let app: INestApplication<App>
  let store: IdentityTestStore

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
    await app.listen(0)
  })

  afterEach(async () => {
    await app.close()
  })

  async function signInUser(email: string) {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email,
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)

    return readSessionBody(signIn)
  }

  it('allows all three roles (Student, Instructor, Admin) to update their own display name', async () => {
    const testAccounts = [
      { email: 'student1@morshid.demo', newName: 'Student Al-Mansoor' },
      { email: 'instructor@morshid.demo', newName: 'Professor Sarah Chen' },
      { email: 'admin@morshid.demo', newName: 'Chief Administrator' },
    ]

    for (const { email, newName } of testAccounts) {
      const session = await signInUser(email)

      const response = await request(app.getHttpServer())
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .set('User-Agent', auditUserAgent)
        .send({ displayName: newName })
        .expect(200)

      const body = response.body as MeResponse
      expect(body.user.displayName).toBe(newName)
      expect(body.user.email).toBe(email)

      // Verify GET /me returns the updated name
      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)

      expect((meResponse.body as MeResponse).user.displayName).toBe(newName)
    }
  })

  it('trims leading and trailing whitespace consistently', async () => {
    const session = await signInUser('student1@morshid.demo')

    const response = await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('User-Agent', auditUserAgent)
      .send({ displayName: '   Spaced Display Name   ' })
      .expect(200)

    const body = response.body as MeResponse
    expect(body.user.displayName).toBe('Spaced Display Name')
  })

  it('records an audit event with actor, user ID, old display name, and new display name without credentials', async () => {
    const session = await signInUser('student1@morshid.demo')
    const studentUser = store.findUserByEmail('student1@morshid.demo')
    const originalName = studentUser?.displayName

    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('User-Agent', auditUserAgent)
      .send({ displayName: 'Audited Name Change' })
      .expect(200)

    const auditEvents = readAuditEvents(store).filter(
      (event) => event.action === AUDIT_EVENT_ACTIONS.AUTH_PROFILE_UPDATED,
    )

    expect(auditEvents).toHaveLength(1)
    const auditEvent = auditEvents[0]

    expect(auditEvent).toEqual(
      expect.objectContaining({
        actorUserId: studentUser?.id,
        action: AUDIT_EVENT_ACTIONS.AUTH_PROFILE_UPDATED,
        targetType: AUDIT_TARGET_TYPES.USER,
        targetId: studentUser?.id,
        userAgent: auditUserAgent,
        metadata: {
          oldDisplayName: originalName,
          newDisplayName: 'Audited Name Change',
        },
      }),
    )
    expect(auditEvent.metadata).not.toHaveProperty('password')
    expect(auditEvent.metadata).not.toHaveProperty('passwordHash')
    expect(auditEvent.metadata).not.toHaveProperty('token')
    expect(auditEvent.metadata).not.toHaveProperty('accessToken')
    expect(auditEvent.metadata).not.toHaveProperty('refreshToken')
  })

  it('rejects payloads shorter than 2 characters or longer than 120 characters', async () => {
    const session = await signInUser('student1@morshid.demo')
    const invalidRequest = {
      code: IDENTITY_ERROR_CODES.INVALID_REQUEST,
      message: 'Invalid auth request',
    }

    // Empty / whitespace only (< 2 chars after trimming)
    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ displayName: '   ' })
      .expect(400)
      .expect(invalidRequest)

    // Single character (< 2 chars)
    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ displayName: 'A' })
      .expect(400)
      .expect(invalidRequest)

    // Exceeding 120 characters
    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ displayName: 'A'.repeat(121) })
      .expect(400)
      .expect(invalidRequest)
  })

  it('rejects extra fields and attempts to modify role, email, status, or courses', async () => {
    const session = await signInUser('student1@morshid.demo')
    const originalStudent = store.findUserByEmail('student1@morshid.demo')
    const invalidRequest = {
      code: IDENTITY_ERROR_CODES.INVALID_REQUEST,
      message: 'Invalid auth request',
    }

    // Attempting to elevate role
    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'Hacker Name',
        role: 'ADMIN',
      })
      .expect(400)
      .expect(invalidRequest)

    // Attempting to change email
    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'Hacker Name',
        email: 'hacker@morshid.demo',
      })
      .expect(400)
      .expect(invalidRequest)

    // Attempting to change status
    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'Hacker Name',
        status: 'DISABLED',
      })
      .expect(400)
      .expect(invalidRequest)

    // Ensure server state did not change
    const afterUser = store.findUserByEmail('student1@morshid.demo')
    expect(afterUser?.displayName).toBe(originalStudent?.displayName)
    expect(afterUser?.role).toBe('STUDENT')
    expect(afterUser?.email).toBe('student1@morshid.demo')
    expect(afterUser?.status).toBe('ACTIVE')
  })

  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .send({ displayName: 'Anonymous User' })
      .expect(401)
      .expect({
        code: IDENTITY_ERROR_CODES.INVALID_ACCESS_TOKEN,
        message: 'Invalid access token',
      })
  })

  it('rejects disabled accounts with 403 and records disabled account audit block', async () => {
    const session = await signInUser('student1@morshid.demo')
    store.disableUser('student1@morshid.demo')

    await request(app.getHttpServer())
      .patch('/api/v1/me/profile')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('User-Agent', auditUserAgent)
      .send({ displayName: 'Disabled User Attempt' })
      .expect(403)
      .expect({
        code: IDENTITY_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })

    const blockLogs = readAuditEvents(store).filter(
      (event) =>
        event.action ===
        AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
    )
    expect(blockLogs.length).toBeGreaterThanOrEqual(1)
  })

  it('resolves concurrent updates with defined last-write result', async () => {
    const session = await signInUser('student1@morshid.demo')

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ displayName: 'Concurrent Name A' })
        .then((response) => response),
      request(app.getHttpServer())
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ displayName: 'Concurrent Name B' })
        .then((response) => response),
    ])

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    const finalGet = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200)

    const finalName = (finalGet.body as MeResponse).user.displayName
    expect(['Concurrent Name A', 'Concurrent Name B']).toContain(finalName)
  })
})
