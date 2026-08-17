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
  ActiveSessionListResponseDto,
  IdentitySessionResponse,
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

const CHROME_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const FIREFOX_WIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
const SAFARI_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'

describe('Active Session Management (e2e)', () => {
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

  it('rejects unauthenticated requests to session endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/sessions').expect(401)

    await request(app.getHttpServer())
      .delete('/api/v1/auth/sessions/00000000-0000-4000-8000-000000000001')
      .expect(401)

    await request(app.getHttpServer())
      .delete('/api/v1/auth/sessions')
      .expect(401)
  })

  it('lists active sessions with device labels, masked IPs, and current marker', async () => {
    // 1. Sign in with Session A (Chrome macOS)
    const sessionAResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', CHROME_MAC_UA)
      .set('X-Forwarded-For', '192.168.1.100')
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)

    const sessionA = readSessionBody(sessionAResponse)
    const sessionACookie = sessionAResponse.headers['set-cookie']

    // 2. Sign in with Session B (Firefox Windows)
    const sessionBResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', FIREFOX_WIN_UA)
      .set('X-Forwarded-For', '10.0.0.45')
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)

    const _sessionB = readSessionBody(sessionBResponse)

    // 3. List sessions using Session A's access token and cookie
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${sessionA.accessToken}`)
      .set('Cookie', sessionACookie)
      .expect(200)

    const body = listRes.body as ActiveSessionListResponseDto
    expect(body.sessions).toHaveLength(2)

    const currentSession = body.sessions.find((s) => s.isCurrent)
    const otherSession = body.sessions.find((s) => !s.isCurrent)

    expect(currentSession).toBeDefined()
    expect(currentSession?.device).toBe('Chrome on macOS')
    expect(currentSession?.ip).toBe('127.0.0.***')

    expect(otherSession).toBeDefined()
    expect(otherSession?.device).toBe('Firefox on Windows')
    expect(otherSession?.ip).toBe('127.0.0.***')
  })

  it('keeps single session family entry across token rotation', async () => {
    // 1. Sign in
    const signInRes = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', CHROME_MAC_UA)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)

    const cookie1 = signInRes.headers['set-cookie']

    // 2. Refresh token
    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie1)
      .expect(200)

    const rotatedSession = readSessionBody(refreshRes)
    const cookie2 = refreshRes.headers['set-cookie']

    // 3. List sessions
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${rotatedSession.accessToken}`)
      .set('Cookie', cookie2)
      .expect(200)

    const body = listRes.body as ActiveSessionListResponseDto
    // Exactly 1 active session family, not 2
    expect(body.sessions).toHaveLength(1)
    expect(body.sessions[0].isCurrent).toBe(true)
  })

  it('prevents revoking current active session via DELETE /sessions/:id', async () => {
    // 1. Sign in
    const signInRes = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', CHROME_MAC_UA)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)

    const session = readSessionBody(signInRes)
    const cookie = signInRes.headers['set-cookie']

    // 2. List sessions to get familyId
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .expect(200)

    const body = listRes.body as ActiveSessionListResponseDto
    const currentFamilyId = body.sessions[0].id

    // 3. Attempt to delete current session
    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${currentFamilyId}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Cookie', cookie)
      .expect(400)

    expect((deleteRes.body as { code?: string }).code).toBe(
      IDENTITY_ERROR_CODES.CANNOT_REVOKE_CURRENT_SESSION,
    )
  })

  it('immediately invalidates access token and refresh token when remote session is revoked', async () => {
    // 1. Sign in Session A (Chrome)
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', CHROME_MAC_UA)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const sessionA = readSessionBody(resA)
    const cookieA = resA.headers['set-cookie']

    // 2. Sign in Session B (Firefox)
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', FIREFOX_WIN_UA)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const sessionB = readSessionBody(resB)
    const cookieB = resB.headers['set-cookie']

    // Verify Session B's access token works before revocation
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${sessionB.accessToken}`)
      .expect(200)

    // 3. List sessions from Session A
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${sessionA.accessToken}`)
      .set('Cookie', cookieA)
      .expect(200)

    const body = listRes.body as ActiveSessionListResponseDto
    const sessionBRecord = body.sessions.find((s) => !s.isCurrent)
    expect(sessionBRecord).toBeDefined()
    const targetSessionId = sessionBRecord?.id ?? ''

    // 4. Session A revokes Session B
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${targetSessionId}`)
      .set('Authorization', `Bearer ${sessionA.accessToken}`)
      .set('Cookie', cookieA)
      .expect(204)

    // 5. Session B's access token is IMMEDIATELY invalidated
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${sessionB.accessToken}`)
      .expect(401)

    // 6. Session B's refresh token fails
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieB)
      .expect(401)

    // 7. Session A remains active and healthy
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${sessionA.accessToken}`)
      .expect(200)

    // 8. Verify audit log
    const auditEvents = readAuditEvents(store)
    const revokeAudit = auditEvents.find(
      (e) => e.action === AUDIT_EVENT_ACTIONS.AUTH_SESSION_REVOKED,
    )
    expect(revokeAudit).toBeDefined()
    expect(revokeAudit?.targetType).toBe(AUDIT_TARGET_TYPES.AUTH_SESSION)
    expect(revokeAudit?.targetId).toBe(targetSessionId)
  })

  it('revokes all other sessions and keeps current session active', async () => {
    // 1. Sign in Session A (Chrome)
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', CHROME_MAC_UA)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const sessionA = readSessionBody(resA)
    const cookieA = resA.headers['set-cookie']

    // 2. Sign in Session B (Firefox)
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', FIREFOX_WIN_UA)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const sessionB = readSessionBody(resB)
    const cookieB = resB.headers['set-cookie']

    // 3. Sign in Session C (Safari iOS)
    const resC = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', SAFARI_IOS_UA)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const sessionC = readSessionBody(resC)
    const cookieC = resC.headers['set-cookie']

    // 4. Session A revokes all other sessions
    await request(app.getHttpServer())
      .delete('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${sessionA.accessToken}`)
      .set('Cookie', cookieA)
      .expect(204)

    // 5. Session B and Session C access tokens are invalidated
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${sessionB.accessToken}`)
      .expect(401)

    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${sessionC.accessToken}`)
      .expect(401)

    // 6. Session B and Session C refresh tokens are invalidated
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieB)
      .expect(401)

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieC)
      .expect(401)

    // 7. Session A remains active
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${sessionA.accessToken}`)
      .expect(200)

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${sessionA.accessToken}`)
      .set('Cookie', cookieA)
      .expect(200)

    const body = listRes.body as ActiveSessionListResponseDto
    expect(body.sessions).toHaveLength(1)
    expect(body.sessions[0].isCurrent).toBe(true)

    // 8. Verify audit log
    const auditEvents = readAuditEvents(store)
    const revokeAllAudit = auditEvents.find(
      (e) => e.action === AUDIT_EVENT_ACTIONS.AUTH_SESSION_REVOKED_ALL_OTHERS,
    )
    expect(revokeAllAudit).toBeDefined()
    expect(revokeAllAudit?.metadata).toMatchObject({ revokedCount: 2 })
  })

  it('isolates sessions between different users', async () => {
    // 1. Sign in User 1 (student.primary)
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', CHROME_MAC_UA)
      .send({
        email: 'student1@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const session1 = readSessionBody(res1)
    const cookie1 = res1.headers['set-cookie']

    // 2. Sign in User 2 (instructor.lead)
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', FIREFOX_WIN_UA)
      .send({
        email: 'instructor@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    const session2 = readSessionBody(res2)
    const _cookie2 = res2.headers['set-cookie']

    // 3. User 1 cannot see User 2's session
    const listRes1 = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${session1.accessToken}`)
      .set('Cookie', cookie1)
      .expect(200)

    const body1 = listRes1.body as ActiveSessionListResponseDto
    expect(body1.sessions).toHaveLength(1)
    expect(body1.sessions[0].device).toBe('Chrome on macOS')

    // 4. User 1 attempts to revoke a random UUID
    await request(app.getHttpServer())
      .delete('/api/v1/auth/sessions/00000000-0000-4000-8000-999999999999')
      .set('Authorization', `Bearer ${session1.accessToken}`)
      .set('Cookie', cookie1)
      .expect(204)

    // User 2 is untouched
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${session2.accessToken}`)
      .expect(200)
  })
})
