import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import { MaterialProcessingScheduler } from '../../src/modules/materials/processing/material-processing.scheduler'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
import { P0_DEMO_PASSWORD } from '../../src/seeds/p0-demo.seed'
import { IdentityTestStore } from '../support/identity-test-store'
import { NoopMaterialProcessingScheduler } from '../support/noop-material-processing-scheduler'

describe('Student Tutoring Preferences (e2e)', () => {
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

  async function signInAndGetToken(email: string): Promise<string> {
    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email,
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)

    return (signIn.body as { accessToken: string }).accessToken
  }

  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/student/tutoring-preferences')
      .expect(401)

    await request(app.getHttpServer())
      .patch('/api/v1/student/tutoring-preferences')
      .send({ explanationDetailLevel: 'CONCISE' })
      .expect(401)
  })

  it('rejects non-student roles with 403 Forbidden', async () => {
    const instructorToken = await signInAndGetToken('instructor@morshid.demo')
    const adminToken = await signInAndGetToken('admin@morshid.demo')

    await request(app.getHttpServer())
      .get('/api/v1/student/tutoring-preferences')
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(403)

    await request(app.getHttpServer())
      .get('/api/v1/student/tutoring-preferences')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403)

    await request(app.getHttpServer())
      .patch('/api/v1/student/tutoring-preferences')
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ explanationDetailLevel: 'CONCISE' })
      .expect(403)
  })

  it('returns default STANDARD preference for a new student', async () => {
    const studentToken = await signInAndGetToken('student1@morshid.demo')

    const response = await request(app.getHttpServer())
      .get('/api/v1/student/tutoring-preferences')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)

    expect(response.body).toEqual({
      explanationDetailLevel: 'STANDARD',
    })
  })

  it('updates explanation detail preference and persists across subsequent fetches', async () => {
    const studentToken = await signInAndGetToken('student1@morshid.demo')

    // Update to DETAILED
    const updateResponse = await request(app.getHttpServer())
      .patch('/api/v1/student/tutoring-preferences')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ explanationDetailLevel: 'DETAILED' })
      .expect(200)

    expect(updateResponse.body).toEqual({
      explanationDetailLevel: 'DETAILED',
    })

    // Fetch and verify persistence
    const getResponse = await request(app.getHttpServer())
      .get('/api/v1/student/tutoring-preferences')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)

    expect(getResponse.body).toEqual({
      explanationDetailLevel: 'DETAILED',
    })

    // Update to CONCISE
    const secondUpdate = await request(app.getHttpServer())
      .patch('/api/v1/student/tutoring-preferences')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ explanationDetailLevel: 'CONCISE' })
      .expect(200)

    expect(secondUpdate.body).toEqual({
      explanationDetailLevel: 'CONCISE',
    })
  })

  it('rejects invalid preference values with 400 Bad Request', async () => {
    const studentToken = await signInAndGetToken('student1@morshid.demo')

    await request(app.getHttpServer())
      .patch('/api/v1/student/tutoring-preferences')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ explanationDetailLevel: 'INVALID_LEVEL' })
      .expect(400)
  })
})
