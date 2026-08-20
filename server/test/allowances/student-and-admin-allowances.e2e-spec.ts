import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
import { seedP0DemoData, P0_DEMO_PASSWORD } from '../../src/seeds/p0-demo.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

interface SignInResponseBody {
  accessToken: string
  user: { id: string }
}

interface SessionResponseBody {
  session: { id: string }
}

interface AllowanceResponseBody {
  limit: number
  used: number
  remaining: number
  policyTimeZone: string
}

interface AdminPoliciesResponseBody {
  deploymentDefaults: {
    tutoringLimit: number
    reviewLimit: number
  }
  policyTimeZone: string
}

interface MessageResponseBody {
  assistantMessage: { id: string }
}

interface ErrorResponseBody {
  code: string
  message: string
}

describe('Student and Admin Allowances (e2e)', () => {
  let database: DisposableDatabase | undefined
  let app: INestApplication | undefined
  let httpServer: App
  let studentToken: string
  let adminToken: string
  let studentId: string
  let courseId: string
  let sessionId: string

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_allowances_e2e')
    const seed = await seedP0DemoData(database.prisma)
    courseId = seed.courses.pythonProgramming.id

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(database.prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn().mockResolvedValue('PONG'),
        getClient: () => ({ eval: jest.fn().mockResolvedValue(null) }),
      })
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
    httpServer = app.getHttpServer() as App

    const studentLogin = await request(httpServer)
      .post('/api/v1/auth/sign-in')
      .send({ email: 'student1@morshid.demo', password: P0_DEMO_PASSWORD })
      .expect(200)
    const studentBody = studentLogin.body as SignInResponseBody
    studentToken = studentBody.accessToken
    studentId = studentBody.user.id

    const adminLogin = await request(httpServer)
      .post('/api/v1/auth/sign-in')
      .send({ email: 'admin@morshid.demo', password: P0_DEMO_PASSWORD })
      .expect(200)
    const adminBody = adminLogin.body as SignInResponseBody
    adminToken = adminBody.accessToken

    const sessionRes = await request(httpServer)
      .post(`/api/v1/courses/${courseId}/chat-sessions`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Allowances Test Session' })
      .expect(201)
    const sessionBody = sessionRes.body as SessionResponseBody
    sessionId = sessionBody.session.id
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    if (database) {
      await database.dispose()
    }
  })

  it('provides default allowances to students and allows admin policy management', async () => {
    // 1. Check initial student tutoring allowance
    const tutoringAllowanceRes = await request(httpServer)
      .get(`/api/v1/tutoring/allowance?courseId=${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)

    const tutoringAllowance = tutoringAllowanceRes.body as AllowanceResponseBody
    expect(tutoringAllowance).toMatchObject({
      limit: 30,
      used: 0,
      remaining: 30,
      policyTimeZone: 'Africa/Cairo',
    })

    // 2. Check initial student review allowance
    const reviewAllowanceRes = await request(httpServer)
      .get(`/api/v1/reviews/allowance?courseId=${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)

    const reviewAllowance = reviewAllowanceRes.body as AllowanceResponseBody
    expect(reviewAllowance).toMatchObject({
      limit: 3,
      used: 0,
      remaining: 3,
      policyTimeZone: 'Africa/Cairo',
    })

    // 3. Admin gets policies
    const adminPoliciesRes = await request(httpServer)
      .get('/api/v1/admin/allowances/policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const adminPolicies = adminPoliciesRes.body as AdminPoliciesResponseBody
    expect(adminPolicies.deploymentDefaults).toMatchObject({
      tutoringLimit: 30,
      reviewLimit: 3,
    })
    expect(adminPolicies.policyTimeZone).toBe('Africa/Cairo')

    // 4. Admin updates course override to limit: 1 tutoring turn
    await request(httpServer)
      .put(`/api/v1/admin/allowances/policies/courses/${courseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tutoringLimit: 1,
        reviewLimit: 1,
      })
      .expect(200)

    // Verify student sees updated override limit
    const updatedTutoringRes = await request(httpServer)
      .get(`/api/v1/tutoring/allowance?courseId=${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)

    const updatedTutoring = updatedTutoringRes.body as AllowanceResponseBody
    expect(updatedTutoring.limit).toBe(1)
    expect(updatedTutoring.remaining).toBe(1)
  })

  it('enforces tutoring allowance limits and supports audited resets', async () => {
    // Override course to limit 1
    await request(httpServer)
      .put(`/api/v1/admin/allowances/policies/courses/${courseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tutoringLimit: 1, reviewLimit: 1 })
      .expect(200)

    // Consume 1 turn
    const firstTurn = await request(httpServer)
      .post(`/api/v1/courses/${courseId}/chat-sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        clientMessageId: randomUUID(),
        content: 'Explain recursion simply',
      })
      .expect(201)

    expect(firstTurn.body).toBeDefined()

    // Allowance remaining is now 0
    const allowanceAfterOneRes = await request(httpServer)
      .get(`/api/v1/tutoring/allowance?courseId=${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)

    const allowanceAfterOne = allowanceAfterOneRes.body as AllowanceResponseBody
    expect(allowanceAfterOne.used).toBe(1)
    expect(allowanceAfterOne.remaining).toBe(0)

    // Second turn attempt should fail with 429
    const secondTurnRes = await request(httpServer)
      .post(`/api/v1/courses/${courseId}/chat-sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        clientMessageId: randomUUID(),
        content: 'Explain dynamic programming',
      })
      .expect(429)

    const secondTurn = secondTurnRes.body as ErrorResponseBody
    expect(secondTurn.code).toBe('TUTORING_ALLOWANCE_EXHAUSTED')

    // Admin creates an audited reset for this student and course
    await request(httpServer)
      .post('/api/v1/admin/allowances/resets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentId,
        courseId,
        scope: 'TUTORING',
        reason: 'Student encountered connection drops during class practice',
      })
      .expect(201)

    // Check allowance after reset: used is 0, remaining is 1
    const allowanceAfterResetRes = await request(httpServer)
      .get(`/api/v1/tutoring/allowance?courseId=${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)

    const allowanceAfterReset =
      allowanceAfterResetRes.body as AllowanceResponseBody
    expect(allowanceAfterReset.used).toBe(0)
    expect(allowanceAfterReset.remaining).toBe(1)

    // Student can now submit another turn
    await request(httpServer)
      .post(`/api/v1/courses/${courseId}/chat-sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        clientMessageId: randomUUID(),
        content: 'Explain dynamic programming now',
      })
      .expect(201)
  })

  it('enforces review allowance limits and supports audited resets', async () => {
    // Override course review limit to 1
    await request(httpServer)
      .put(`/api/v1/admin/allowances/policies/courses/${courseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tutoringLimit: 30, reviewLimit: 1 })
      .expect(200)

    // First send 2 messages so we have assistant messages to review
    const turn1Res = await request(httpServer)
      .post(`/api/v1/courses/${courseId}/chat-sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        clientMessageId: randomUUID(),
        content: 'First message for review test',
      })
      .expect(201)

    const turn2Res = await request(httpServer)
      .post(`/api/v1/courses/${courseId}/chat-sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        clientMessageId: randomUUID(),
        content: 'Second message for review test',
      })
      .expect(201)

    const turn1 = turn1Res.body as MessageResponseBody
    const turn2 = turn2Res.body as MessageResponseBody
    const assistantMessage1Id = turn1.assistantMessage.id
    const assistantMessage2Id = turn2.assistantMessage.id

    // Complete messages so they become reviewable
    if (database) {
      await database.prisma.message.updateMany({
        where: { id: { in: [assistantMessage1Id, assistantMessage2Id] } },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
    }

    // Request review 1
    await request(httpServer)
      .post(`/api/v1/messages/${assistantMessage1Id}/review-requests`)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        flagReason: 'INCORRECT',
        note: 'Incorrect explanation',
      })
      .expect(201)

    // Review allowance is now 0 remaining
    const reviewAllowanceRes = await request(httpServer)
      .get(`/api/v1/reviews/allowance?courseId=${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)

    const reviewAllowance = reviewAllowanceRes.body as AllowanceResponseBody
    expect(reviewAllowance.used).toBe(1)
    expect(reviewAllowance.remaining).toBe(0)

    // Second review request should fail with 429 quota_exceeded
    const review2Res = await request(httpServer)
      .post(`/api/v1/messages/${assistantMessage2Id}/review-requests`)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        flagReason: 'CONFUSING',
        note: 'Confusing explanation',
      })
      .expect(429)

    const review2 = review2Res.body as ErrorResponseBody
    expect(review2.code).toBe('MANUAL_REVIEW_QUOTA_EXCEEDED')

    // Admin resets review allowance
    await request(httpServer)
      .post('/api/v1/admin/allowances/resets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentId,
        courseId,
        scope: 'REVIEW',
        reason: 'Reset student review quota after course adjustment',
      })
      .expect(201)

    // Allowance remaining is now 1
    const reviewAllowanceAfterResetRes = await request(httpServer)
      .get(`/api/v1/reviews/allowance?courseId=${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)

    const reviewAllowanceAfterReset =
      reviewAllowanceAfterResetRes.body as AllowanceResponseBody
    expect(reviewAllowanceAfterReset.used).toBe(0)
    expect(reviewAllowanceAfterReset.remaining).toBe(1)

    // Second review request now succeeds
    await request(httpServer)
      .post(`/api/v1/messages/${assistantMessage2Id}/review-requests`)
      .set('Authorization', `Bearer ${studentToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        flagReason: 'CONFUSING',
        note: 'Confusing explanation',
      })
      .expect(201)
  })
})
