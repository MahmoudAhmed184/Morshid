import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../src/modules/audit/audit.constants'
import { AUTH_ERROR_CODES } from '../src/modules/auth/auth.dto'
import type {
  AuthSessionResponse,
  MeResponse,
} from '../src/modules/auth/auth.dto'
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

function readAuditEvents(store: AuthTestStore) {
  return [...store.auditLogs.values()]
}

const auditUserAgent = 'Morshid e2e'
const anyString = expect.any(String) as unknown as string
const anyDate = expect.any(Date) as unknown as Date

describe('AuthController (e2e)', () => {
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

    expect(body.tokenType).toBe('Bearer')
    expect(body.accessToken).toEqual(expect.any(String))
    expect(body.accessTokenExpiresAt).toEqual(expect.any(String))
    expect(body.refreshToken).toEqual(expect.any(String))
    expect(body.refreshTokenExpiresAt).toEqual(expect.any(String))
    expect(body.user).toMatchObject({
      email: 'admin@morshid.demo',
      displayName: 'P0 Demo Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    })
    expect(body.user.courses).toEqual(
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
      code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
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

  it('rejects invalid and extra auth request fields', async () => {
    const invalidRequest = {
      code: AUTH_ERROR_CODES.INVALID_REQUEST,
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
      .send({
        refreshToken: 'refresh-token',
        unexpected: true,
      })
      .expect(400)
      .expect(invalidRequest)

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({
        refreshToken: 'refresh-token',
        unexpected: true,
      })
      .expect(400)
      .expect(invalidRequest)
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
        code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
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
        code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
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
    const refreshToken = readSessionBody(signIn).refreshToken

    store.disableUser('student1@morshid.demo')

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('User-Agent', auditUserAgent)
      .send({
        refreshToken,
      })
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
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

    const signInBody = readSessionBody(signIn)
    const refreshToken = signInBody.refreshToken
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('User-Agent', auditUserAgent)
      .send({
        refreshToken,
      })
      .expect(200)

    expect(readSessionBody(refreshed).refreshToken).not.toBe(refreshToken)
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken,
      })
      .expect(401)
      .expect({
        code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
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

    const refreshToken = readSessionBody(signIn).refreshToken

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('User-Agent', auditUserAgent)
      .send({
        refreshToken,
      })
      .expect(204)
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('User-Agent', auditUserAgent)
      .send({
        refreshToken,
      })
      .expect(204)
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('User-Agent', auditUserAgent)
      .send({
        refreshToken,
      })
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

  it('returns the current student identity and only role-visible courses from /me', async () => {
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
            courses: [
              {
                code: P0_DEMO_COURSE.code,
                title: P0_DEMO_COURSE.title,
                membershipRole: 'STUDENT',
              },
            ],
          },
        })
      })
  })
})
