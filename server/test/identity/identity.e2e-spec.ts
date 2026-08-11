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
import { MaterialProcessingScheduler } from '../../src/modules/materials/material-processing.scheduler'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
import { P0_DEMO_PASSWORD } from '../../src/seeds/p0-demo.seed'
import { IdentityTestStore } from '../support/identity-test-store'
import { NoopMaterialProcessingScheduler } from '../support/noop-material-processing-scheduler'

function readSessionBody(response: { body: IdentitySessionResponse }) {
  return response.body
}

function readRefreshCookie(response: { headers: Record<string, unknown> }) {
  const cookies = response.headers['set-cookie']

  if (!isStringArray(cookies)) {
    throw new Error('Expected a morshid_refresh cookie')
  }

  const refreshCookie = cookies.find((cookie) =>
    cookie.startsWith('morshid_refresh='),
  )

  if (refreshCookie === undefined) {
    throw new Error('Expected a morshid_refresh cookie')
  }

  return refreshCookie.split(';')[0]
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => typeof item === 'string')
  )
}

function readAuditEvents(store: IdentityTestStore) {
  return [...store.auditLogs.values()]
}

const auditUserAgent = 'Morshid e2e'
const anyString = expect.any(String) as unknown as string
const anyDate = expect.any(Date) as unknown as Date

describe('IdentityController (e2e)', () => {
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
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('signs in a valid seeded admin and returns a session summary', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email: 'admin@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)

    const body = readSessionBody(response)
    const refreshCookies = response.headers['set-cookie'] as unknown as string[]

    expect(body.tokenType).toBe('Bearer')
    expect(body.accessToken).toEqual(expect.any(String))
    expect(body.accessTokenExpiresAt).toEqual(expect.any(String))
    expect(body).not.toHaveProperty('refreshToken')
    expect(body).not.toHaveProperty('refreshTokenExpiresAt')
    expect(body.user).toMatchObject({
      email: 'admin@morshid.demo',
      displayName: 'P0 Demo Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    })
    expect(body.user).not.toHaveProperty('courses')
    expect(refreshCookies[0]).toContain('morshid_refresh=')
    expect(refreshCookies[0]).toContain('HttpOnly')
    expect(refreshCookies[0]).toContain('Path=/api/v1/auth')
    expect(refreshCookies[0]).toContain('SameSite=Lax')

    const admin = store.findUserByEmail('admin@morshid.demo')
    const refreshToken = [...store.refreshTokens.values()][0]

    expect(admin).not.toBeNull()
    expect(refreshToken).toEqual(expect.objectContaining({ userId: admin?.id }))
    expect(readAuditEvents(store)).toEqual([
      expect.objectContaining({
        actorUserId: admin?.id,
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
        targetType: AUDIT_TARGET_TYPES.AUTH_SESSION,
        targetId: refreshToken.id,
        courseId: null,
        ip: anyString,
        userAgent: anyString,
        metadata: {},
        createdAt: anyDate,
      }),
    ])
  })

  it('refreshes a browser session from the HttpOnly cookie', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const refreshCookie = readRefreshCookie(signIn)

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .send({ refreshToken: 'body-token-is-ignored' })
      .expect(200)

    expect(readRefreshCookie(refreshed)).not.toBe(refreshCookie)
    expect(readSessionBody(refreshed)).not.toHaveProperty('refreshToken')
    expect(refreshed.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('HttpOnly')]),
    )
  })

  it('rejects a malformed refresh cookie as an invalid token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'morshid_refresh=%')
      .expect(401)
      .expect({
        code: IDENTITY_ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token',
      })
  })

  it('returns the same invalid-credentials response for unknown and wrong-password logins', async () => {
    const unknownEmail = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email: 'unknown@morshid.demo',
        password: 'wrong-password',
      })
      .expect(401)
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email: 'admin@morshid.demo',
        password: 'wrong-password',
      })
      .expect(401)

    expect(unknownEmail.body).toEqual({
      code: IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid email or password',
    })
    expect(wrongPassword.body).toEqual(unknownEmail.body)
    expect(readAuditEvents(store)).toEqual([
      expect.objectContaining({
        actorUserId: null,
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
        targetType: AUDIT_TARGET_TYPES.AUTH_SESSION,
        targetId: null,
        ip: anyString,
        userAgent: anyString,
        metadata: {
          email: 'unknown@morshid.demo',
        },
        createdAt: anyDate,
      }),
      expect.objectContaining({
        actorUserId: null,
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
        targetType: AUDIT_TARGET_TYPES.AUTH_SESSION,
        targetId: null,
        ip: anyString,
        userAgent: anyString,
        metadata: {
          email: 'admin@morshid.demo',
        },
        createdAt: anyDate,
      }),
    ])
  })

  it('uses cookies as the only refresh-session input', async () => {
    const invalidRequest = {
      code: IDENTITY_ERROR_CODES.INVALID_REQUEST,
      message: 'Invalid auth request',
    }

    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email: 'not-an-email',
        password: P0_DEMO_PASSWORD,
      })
      .expect(400)
      .expect(invalidRequest)

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'refresh-token' })
      .expect(401)
      .expect({
        code: IDENTITY_ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token',
      })

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'refresh-token' })
      .expect(204)
  })

  it('blocks sign-in for a disabled account', async () => {
    store.disableUser('student1@morshid.demo')

    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(403)
      .expect({
        code: IDENTITY_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })
    const disabledUser = store.findUserByEmail('student1@morshid.demo')

    expect(disabledUser).not.toBeNull()
    expect(readAuditEvents(store)).toEqual([
      expect.objectContaining({
        actorUserId: disabledUser?.id,
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
        targetType: AUDIT_TARGET_TYPES.USER,
        targetId: disabledUser?.id,
        ip: anyString,
        userAgent: anyString,
        metadata: {},
        createdAt: anyDate,
      }),
    ])
  })

  it('blocks /me when an old access token belongs to a now-disabled account', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const signInBody = readSessionBody(signIn)

    store.disableUser('student1@morshid.demo')

    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('User-Agent', auditUserAgent)
      .set('Authorization', `Bearer ${signInBody.accessToken}`)
      .expect(403)
      .expect({
        code: IDENTITY_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })
    const disabledUser = store.findUserByEmail('student1@morshid.demo')

    expect(disabledUser).not.toBeNull()
    expect(readAuditEvents(store)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: disabledUser?.id,
          action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
          targetType: AUDIT_TARGET_TYPES.AUTH_SESSION,
          targetId: anyString,
        }),
        expect.objectContaining({
          actorUserId: disabledUser?.id,
          action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
          targetType: AUDIT_TARGET_TYPES.USER,
          targetId: disabledUser?.id,
          ip: anyString,
          userAgent: anyString,
          metadata: {},
          createdAt: anyDate,
        }),
      ]),
    )
  })

  it('blocks refresh when the account has been disabled', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const refreshCookie = readRefreshCookie(signIn)

    store.disableUser('student1@morshid.demo')

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .set('User-Agent', auditUserAgent)
      .expect(403)
      .expect({
        code: IDENTITY_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })
    const disabledUser = store.findUserByEmail('student1@morshid.demo')
    const storedTokens = [...store.refreshTokens.values()]

    expect(disabledUser).not.toBeNull()
    expect(readAuditEvents(store)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: disabledUser?.id,
          action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
          targetType: AUDIT_TARGET_TYPES.AUTH_SESSION,
          targetId: storedTokens[0].id,
        }),
        expect.objectContaining({
          actorUserId: disabledUser?.id,
          action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
          targetType: AUDIT_TARGET_TYPES.USER,
          targetId: disabledUser?.id,
          ip: anyString,
          userAgent: anyString,
          metadata: {},
          createdAt: anyDate,
        }),
      ]),
    )
    expect(storedTokens).toHaveLength(1)
    expect(storedTokens[0].revokedAt).toBeInstanceOf(Date)
  })

  it('rotates refresh tokens and rejects reuse of the old refresh token', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)

    const refreshCookie = readRefreshCookie(signIn)
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .set('User-Agent', auditUserAgent)
      .expect(200)

    expect(readRefreshCookie(refreshed)).not.toBe(refreshCookie)
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(401)
      .expect({
        code: IDENTITY_ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token',
      })

    const student = store.findUserByEmail('student1@morshid.demo')
    const storedTokens = [...store.refreshTokens.values()]
    const previousRefreshToken = storedTokens[0]
    const nextRefreshToken = storedTokens[1]

    expect(student).not.toBeNull()
    expect(previousRefreshToken).toEqual(
      expect.objectContaining({
        revokedAt: anyDate,
        replacedByTokenId: nextRefreshToken.id,
      }),
    )
    expect(readAuditEvents(store)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: student?.id,
          action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
          targetType: AUDIT_TARGET_TYPES.AUTH_SESSION,
          targetId: previousRefreshToken.id,
        }),
        expect.objectContaining({
          actorUserId: student?.id,
          action: AUDIT_EVENT_ACTIONS.AUTH_REFRESH_TOKEN_ROTATED,
          targetType: AUDIT_TARGET_TYPES.AUTH_SESSION,
          targetId: nextRefreshToken.id,
          ip: anyString,
          userAgent: anyString,
          metadata: {
            previousRefreshTokenId: previousRefreshToken.id,
          },
          createdAt: anyDate,
        }),
      ]),
    )
  })

  it('makes logout idempotent and prevents refresh with the logged-out token', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)

    const refreshCookie = readRefreshCookie(signIn)

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshCookie)
      .set('User-Agent', auditUserAgent)
      .expect(204)
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshCookie)
      .set('User-Agent', auditUserAgent)
      .expect(204)
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .set('User-Agent', auditUserAgent)
      .expect(401)

    const student = store.findUserByEmail('student1@morshid.demo')
    const refreshTokenRecord = [...store.refreshTokens.values()][0]
    const logoutEvents = readAuditEvents(store).filter(
      (auditLog) => auditLog.action === AUDIT_EVENT_ACTIONS.AUTH_LOGOUT,
    )

    expect(student).not.toBeNull()
    expect(refreshTokenRecord.revokedAt).toBeInstanceOf(Date)
    expect(logoutEvents).toHaveLength(1)
    expect(readAuditEvents(store)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: student?.id,
          action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
          targetType: AUDIT_TARGET_TYPES.AUTH_SESSION,
          targetId: refreshTokenRecord.id,
        }),
        expect.objectContaining({
          actorUserId: student?.id,
          action: AUDIT_EVENT_ACTIONS.AUTH_LOGOUT,
          targetType: AUDIT_TARGET_TYPES.AUTH_SESSION,
          targetId: refreshTokenRecord.id,
          ip: anyString,
          userAgent: anyString,
          metadata: {
            refreshTokenCreatedAt: refreshTokenRecord.createdAt.toISOString(),
            refreshTokenExpiresAt: refreshTokenRecord.expiresAt.toISOString(),
            refreshTokenIp: refreshTokenRecord.ip,
            refreshTokenRevokedAt: refreshTokenRecord.revokedAt?.toISOString(),
            refreshTokenUserAgent: refreshTokenRecord.userAgent,
          },
          createdAt: anyDate,
        }),
      ]),
    )
  })

  it('returns the current student identity without course projections from /me', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const signInBody = readSessionBody(signIn)

    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('User-Agent', auditUserAgent)
      .set('Authorization', `Bearer ${signInBody.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const meResponse = body as MeResponse

        expect(meResponse).toMatchObject({
          user: {
            email: 'student1@morshid.demo',
            displayName: 'P0 Demo Student 1',
            role: 'STUDENT',
            status: 'ACTIVE',
          },
        })
        expect(meResponse.user).not.toHaveProperty('courses')
      })
  })
})
