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
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import { STUDENT_CHAT_ERROR_CODES } from '../src/modules/student-chat/student-chat.errors'
import { P0_DEMO_PASSWORD } from '../src/seeds/p0-demo.seed'
import { AuthTestStore } from './support/auth-test-store'

// student1 is an active member of the Python demo course only. The seeded
// hidden isolation course has no memberships — the canonical cross-course
// (course-boundary) fixture.
const HIDDEN_COURSE_ID = '00000000-0000-4000-8000-000000000102'

describe('Course boundary audit (e2e)', () => {
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

  function boundaryDeniedAudits() {
    return [...store.auditLogs.values()].filter(
      (log) => log.action === AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED,
    )
  }

  it('persists ACCESS_COURSE_BOUNDARY_DENIED when a Student reads an unassigned course', async () => {
    const token = await signInAs('student1@morshid.demo')
    const student = store.findUserByEmail('student1@morshid.demo')

    await request(app.getHttpServer())
      .get(`/api/v1/courses/${HIDDEN_COURSE_ID}/chat-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect({
        code: STUDENT_CHAT_ERROR_CODES.ACTIVE_STUDENT_MEMBERSHIP_REQUIRED,
        message: 'Active student course membership is required',
      })

    const denials = boundaryDeniedAudits()
    expect(denials).toHaveLength(1)
    expect(denials[0]).toMatchObject({
      action: AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED,
      targetType: AUDIT_TARGET_TYPES.COURSE,
      targetId: HIDDEN_COURSE_ID,
      actorUserId: student?.id,
      // The hidden course exists, so its id is safe for the FK column.
      courseId: HIDDEN_COURSE_ID,
      metadata: {
        actorRole: 'STUDENT',
        method: 'GET',
      },
    })
    const metadata = denials[0].metadata as { operation?: string }
    expect(metadata.operation).toContain('GET')
    expect(metadata.operation).toContain('chat-sessions')
  })

  it('persists ACCESS_COURSE_BOUNDARY_DENIED for a write (create) attempt on an unassigned course', async () => {
    const token = await signInAs('student1@morshid.demo')
    const student = store.findUserByEmail('student1@morshid.demo')

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${HIDDEN_COURSE_ID}/chat-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should never be created' })
      .expect(403)

    const denials = boundaryDeniedAudits()
    expect(denials).toHaveLength(1)
    expect(denials[0]).toMatchObject({
      action: AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED,
      targetType: AUDIT_TARGET_TYPES.COURSE,
      targetId: HIDDEN_COURSE_ID,
      actorUserId: student?.id,
      courseId: HIDDEN_COURSE_ID,
      metadata: {
        actorRole: 'STUDENT',
        method: 'POST',
      },
    })
    const metadata = denials[0].metadata as { operation?: string }
    expect(metadata.operation).toContain('POST')
    expect(metadata.operation).toContain('chat-sessions')
  })
})
