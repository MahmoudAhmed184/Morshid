import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { configureApp } from '../src/app.setup'
import { AppModule } from './../src/app.module'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import { NoopMaterialProcessingScheduler } from './support/noop-material-processing-scheduler'

interface HealthResponse {
  status: string
  details: Record<string, { status: string }>
}

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>
  const prismaService = {
    ping: jest.fn(),
    hasPgVectorExtension: jest.fn(),
  }
  const redisService = {
    ping: jest.fn(),
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
    prismaService.ping.mockResolvedValue(undefined)
    prismaService.hasPgVectorExtension.mockResolvedValue(true)
    redisService.ping.mockResolvedValue('PONG')

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .overrideProvider(RedisService)
      .useValue(redisService)
      .overrideProvider(MaterialProcessingScheduler)
      .useClass(NoopMaterialProcessingScheduler)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  it('/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({
        status: 'ok',
        info: {
          process: {
            status: 'up',
          },
        },
        error: {},
        details: {
          process: {
            status: 'up',
          },
        },
      })
  })

  it('/health/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as HealthResponse

        expect(responseBody.status).toBe('ok')
        expect(responseBody.details).toMatchObject({
          database: {
            status: 'up',
          },
          redis: {
            status: 'up',
          },
          pgvector: {
            status: 'up',
          },
        })
      })
  })

  afterEach(async () => {
    await app.close()
  })
})
