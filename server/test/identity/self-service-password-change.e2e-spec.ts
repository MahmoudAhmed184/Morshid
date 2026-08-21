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
import {
  IDENTITY_ERROR_CODES,
  type IdentitySessionResponse,
  type MeResponse,
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

function readCookieHeader(response: { headers: Record<string, unknown> }) {
  const setCookie = response.headers['set-cookie']
  if (Array.isArray(setCookie)) {
    return setCookie.join('; ')
  }
  return typeof setCookie === 'string' ? setCookie : ''
}

const auditUserAgent = 'Morshid password change e2e'

describe('Self-Service Password Change (e2e)', () => {
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

  async function signInUser(email: string, password = P0_DEMO_PASSWORD) {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email,
        password,
      })
      .expect(200)

    return {
      session: readSessionBody(signIn),
      cookie: readCookieHeader(signIn),
    }
  }

  it('allows Student, Instructor, and Admin to change password and continue with rotated session', async () => {
    const testAccounts = [
      {
        email: 'student1@morshid.demo',
        newPassword: 'a brand new valid learner passphrase 2026',
      },
      {
        email: 'instructor@morshid.demo',
        newPassword: 'a brand new valid teacher passphrase 2026',
      },
      {
        email: 'admin@morshid.demo',
        newPassword: 'a brand new valid manager passphrase 2026',
      },
    ]

    for (const { email, newPassword } of testAccounts) {
      // 1. Initial sign-in (first browser/session)
      const { session: firstSession, cookie: firstCookie } =
        await signInUser(email)

      // 2. Second sign-in (second browser/session)
      const { session: secondSession, cookie: secondCookie } =
        await signInUser(email)

      // 3. User changes password from second session
      const changeResponse = await request(app.getHttpServer())
        .patch('/api/v1/me/password')
        .set('Authorization', `Bearer ${secondSession.accessToken}`)
        .set('Cookie', secondCookie)
        .set('User-Agent', auditUserAgent)
        .send({
          currentPassword: P0_DEMO_PASSWORD,
          newPassword,
          confirmation: newPassword,
        })
        .expect(200)

      const rotatedSession = readSessionBody(changeResponse)
      const rotatedCookie = readCookieHeader(changeResponse)

      expect(rotatedSession.accessToken).toBeDefined()
      expect(rotatedSession.user.email).toBe(email)
      expect(rotatedCookie).toContain('morshid_refresh=')

      // 4. Old password immediately fails sign-in
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .send({
          email,
          password: P0_DEMO_PASSWORD,
        })
        .expect(401)

      // 5. New password succeeds sign-in
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .send({
          email,
          password: newPassword,
        })
        .expect(200)

      // 6. Old access token from first/second session immediately fails protected endpoint
      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${firstSession.accessToken}`)
        .expect(401)

      await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${secondSession.accessToken}`)
        .expect(401)

      // 7. Other session (first session refresh token) is revoked and fails refresh
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', firstCookie)
        .expect(401)

      // 8. Rotated session works on protected endpoint
      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${rotatedSession.accessToken}`)
        .expect(200)

      const me = meResponse.body as MeResponse
      expect(me.user.email).toBe(email)

      // 9. Rotated session can refresh
      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', rotatedCookie)
        .expect(200)

      expect(readSessionBody(refreshResponse).accessToken).toBeDefined()
    }
  })

  it('preserves spaces and does not trim password', async () => {
    const email = 'student1@morshid.demo'
    const newPasswordWithSpaces =
      '   passphrase with leading and trailing spaces   '

    const { session, cookie } = await signInUser(email)

    await request(app.getHttpServer())
      .patch('/api/v1/me/password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .send({
        currentPassword: P0_DEMO_PASSWORD,
        newPassword: newPasswordWithSpaces,
        confirmation: newPasswordWithSpaces,
      })
      .expect(200)

    // Sign in using exact spaces
    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email,
        password: newPasswordWithSpaces,
      })
      .expect(200)

    // Trimmed version should fail
    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email,
        password: newPasswordWithSpaces.trim(),
      })
      .expect(401)
  })

  it('supports unicode passphrases', async () => {
    const email = 'student1@morshid.demo'
    const unicodePassword = 'كلمة_مرور_جديدة_وقوية_جدا_٢٠٢٦'

    const { session, cookie } = await signInUser(email)

    await request(app.getHttpServer())
      .patch('/api/v1/me/password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .send({
        currentPassword: P0_DEMO_PASSWORD,
        newPassword: unicodePassword,
        confirmation: unicodePassword,
      })
      .expect(200)

    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email,
        password: unicodePassword,
      })
      .expect(200)
  })

  it('rejects incorrect current password with a generic invalid credentials error', async () => {
    const email = 'student1@morshid.demo'
    const { session, cookie } = await signInUser(email)

    const response = await request(app.getHttpServer())
      .patch('/api/v1/me/password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .send({
        currentPassword: 'wrong-current-password',
        newPassword: 'a valid fifteen character password',
        confirmation: 'a valid fifteen character password',
      })
      .expect(401)

    expect(response.body).toMatchObject({
      code: IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid email or password',
    })
  })

  it('rejects passwords failing policy (length, blocklist, context-specific, mismatch)', async () => {
    const email = 'student1@morshid.demo'
    const { session, cookie } = await signInUser(email)

    // 1. Password shorter than 9 chars
    await request(app.getHttpServer())
      .patch('/api/v1/me/password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .send({
        currentPassword: P0_DEMO_PASSWORD,
        newPassword: 'Short1!',
        confirmation: 'Short1!',
      })
      .expect(400)

    // 2. Mismatch between new password and confirmation
    await request(app.getHttpServer())
      .patch('/api/v1/me/password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .send({
        currentPassword: P0_DEMO_PASSWORD,
        newPassword: 'a valid fifteen character password',
        confirmation: 'a different fifteen character password',
      })
      .expect(400)

    // 3. Same as current password
    await request(app.getHttpServer())
      .patch('/api/v1/me/password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .send({
        currentPassword: P0_DEMO_PASSWORD,
        newPassword: P0_DEMO_PASSWORD,
        confirmation: P0_DEMO_PASSWORD,
      })
      .expect(400)

    // 4. Blocklisted common passphrase
    await request(app.getHttpServer())
      .patch('/api/v1/me/password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .send({
        currentPassword: P0_DEMO_PASSWORD,
        newPassword: 'correct horse battery staple',
        confirmation: 'correct horse battery staple',
      })
      .expect(400)

    // 5. Context-specific password containing email local-part
    await request(app.getHttpServer())
      .patch('/api/v1/me/password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .send({
        currentPassword: P0_DEMO_PASSWORD,
        newPassword: 'student1_secure_passphrase_2026',
        confirmation: 'student1_secure_passphrase_2026',
      })
      .expect(400)
  })

  it('rejects password change for disabled account and records disabled account audit log', async () => {
    const email = 'student1@morshid.demo'
    const { session, cookie } = await signInUser(email)

    store.disableUser(email)

    await request(app.getHttpServer())
      .patch('/api/v1/me/password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .send({
        currentPassword: P0_DEMO_PASSWORD,
        newPassword: 'a valid fifteen character password',
        confirmation: 'a valid fifteen character password',
      })
      .expect(403)

    const blockAudit = [...store.auditLogs.values()].filter(
      (log) =>
        log.action === AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
    )
    expect(blockAudit).toHaveLength(1)
  })

  it('rejects unauthenticated password change requests', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/me/password')
      .send({
        currentPassword: P0_DEMO_PASSWORD,
        newPassword: 'a valid fifteen character password',
        confirmation: 'a valid fifteen character password',
      })
      .expect(401)
  })

  it('records an audit event on password change with no password material', async () => {
    const email = 'student1@morshid.demo'
    const user = store.findUserByEmail(email)
    if (!user) throw new Error('Missing user')

    const { session, cookie } = await signInUser(email)

    await request(app.getHttpServer())
      .patch('/api/v1/me/password')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .set('User-Agent', auditUserAgent)
      .send({
        currentPassword: P0_DEMO_PASSWORD,
        newPassword: 'a valid fifteen character password',
        confirmation: 'a valid fifteen character password',
      })
      .expect(200)

    const passwordAuditLogs = [...store.auditLogs.values()].filter(
      (log) => log.action === AUDIT_EVENT_ACTIONS.AUTH_PASSWORD_CHANGED,
    )

    expect(passwordAuditLogs).toHaveLength(1)
    expect(passwordAuditLogs[0]).toEqual(
      expect.objectContaining({
        actorUserId: user.id,
        action: AUDIT_EVENT_ACTIONS.AUTH_PASSWORD_CHANGED,
        targetType: AUDIT_TARGET_TYPES.USER,
        targetId: user.id,
        metadata: {},
      }),
    )
    expect(passwordAuditLogs[0].metadata).not.toHaveProperty('password')
    expect(passwordAuditLogs[0].metadata).not.toHaveProperty('newPassword')
    expect(passwordAuditLogs[0].metadata).not.toHaveProperty('currentPassword')
  })
})
