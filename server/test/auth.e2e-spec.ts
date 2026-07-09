import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { AUDIT_EVENT_ACTIONS } from '../src/modules/audit/audit.constants'
import { AuditService } from '../src/modules/audit/audit.service'
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

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>
  let store: AuthTestStore

  const auditService = {
    recordEvent: jest.fn().mockResolvedValue(undefined),
  }
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

  it('signs in a valid seeded admin and returns a session summary', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
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
  })

  it('returns the same invalid-credentials response for unknown and wrong-password logins', async () => {
    const unknownEmail = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email: 'unknown@morshid.demo',
        password: 'wrong-password',
      })
      .expect(401)
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
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
    expect(auditService.recordEvent).toHaveBeenCalledTimes(2)
    expect(auditService.recordEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
      }),
    )
    expect(auditService.recordEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
      }),
    )
  })

  it('rejects invalid and extra auth request fields', async () => {
    const invalidRequest = {
      code: AUTH_ERROR_CODES.INVALID_REQUEST,
      message: 'Invalid auth request',
    }

    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
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
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
      }),
    )
  })

  it('blocks /me when an old access token belongs to a now-disabled account', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const signInBody = readSessionBody(signIn)

    store.disableUser('student1@morshid.demo')

    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${signInBody.accessToken}`)
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
      }),
    )
  })

  it('blocks refresh when the account has been disabled', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const refreshToken = readSessionBody(signIn).refreshToken

    store.disableUser('student1@morshid.demo')

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken,
      })
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
      }),
    )
    const storedTokens = [...store.refreshTokens.values()]

    expect(storedTokens).toHaveLength(1)
    expect(storedTokens[0].revokedAt).toBeInstanceOf(Date)
  })

  it('rotates refresh tokens and rejects reuse of the old refresh token', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)

    const signInBody = readSessionBody(signIn)
    const refreshToken = signInBody.refreshToken
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
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
  })

  it('makes logout idempotent and prevents refresh with the logged-out token', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)

    const refreshToken = readSessionBody(signIn).refreshToken

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({
        refreshToken,
      })
      .expect(204)
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({
        refreshToken,
      })
      .expect(204)
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken,
      })
      .expect(401)
  })

  it('returns the current student identity and only role-visible courses from /me', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const signInBody = readSessionBody(signIn)

    await request(app.getHttpServer())
      .get('/api/v1/me')
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
