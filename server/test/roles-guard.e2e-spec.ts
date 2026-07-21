import type { INestApplication } from '@nestjs/common'
import { Controller, Get } from '@nestjs/common'
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
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import { Public } from '../src/modules/auth/public.decorator'
import { Roles } from '../src/modules/auth/roles.decorator'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import { P0_DEMO_PASSWORD } from '../src/seeds/p0-demo.seed'
import { AuthTestStore } from './support/auth-test-store'
import { NoopMaterialProcessingScheduler } from './support/noop-material-processing-scheduler'

function readAuditEvents(store: AuthTestStore) {
  return [...store.auditLogs.values()]
}

const auditUserAgent = 'Morshid e2e'
const anyString = expect.any(String) as unknown as string
const anyDate = expect.any(Date) as unknown as Date

@Controller('test-roles')
class RolesTestController {
  @Get('public')
  @Public()
  publicRoute() {
    return { ok: true }
  }

  @Get('admin-only')
  @Roles('ADMIN')
  adminOnly() {
    return { ok: true }
  }

  @Get('authenticated')
  authenticated() {
    return { ok: true }
  }
}

describe('RolesGuard (e2e)', () => {
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
      controllers: [RolesTestController],
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

  async function signInAs(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    return (response.body as AuthSessionResponse).accessToken
  }

  it('allows access to a @Public() route without a token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/test-roles/public')
      .expect(200)
      .expect({ ok: true })
  })

  it('blocks an authenticated route when no token is provided', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/test-roles/authenticated')
      .expect(401)
  })

  it('allows an admin to access an @Roles(ADMIN) route', async () => {
    const token = await signInAs('admin@morshid.demo')

    await request(app.getHttpServer())
      .get('/api/v1/test-roles/admin-only')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ ok: true })
  })

  it('rejects a student from an @Roles(ADMIN) route with 403', async () => {
    const token = await signInAs('student1@morshid.demo')
    const student = store.findUserByEmail('student1@morshid.demo')

    await request(app.getHttpServer())
      .get('/api/v1/test-roles/admin-only')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', auditUserAgent)
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
        message: 'Insufficient role',
      })

    expect(
      readAuditEvents(store).filter(
        (event) => event.action === AUDIT_EVENT_ACTIONS.ACCESS_RBAC_DENIED,
      ),
    ).toEqual([
      expect.objectContaining({
        actorUserId: student?.id,
        action: AUDIT_EVENT_ACTIONS.ACCESS_RBAC_DENIED,
        targetType: AUDIT_TARGET_TYPES.SYSTEM,
        targetId: null,
        courseId: null,
        ip: anyString,
        userAgent: auditUserAgent,
        metadata: expect.objectContaining({
          requiredRoles: ['ADMIN'],
          actorRole: 'STUDENT',
          method: 'GET',
          path: '/api/v1/test-roles/admin-only',
        }) as unknown,
        createdAt: anyDate,
      }),
    ])
  })

  it('blocks an @Roles(ADMIN) route with 401 when no token is provided', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/test-roles/admin-only')
      .expect(401)

    // The global AuthGuard rejects with 401 before RolesGuard runs, so an
    // unauthenticated request must never produce an RBAC-denied audit row.
    expect(
      readAuditEvents(store).filter(
        (event) => event.action === AUDIT_EVENT_ACTIONS.ACCESS_RBAC_DENIED,
      ),
    ).toHaveLength(0)
  })
})
