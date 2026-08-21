import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import { AUDIT_EVENT_ACTIONS } from '../../src/modules/audit/audit.public'
import type { IdentitySessionResponse } from '../../src/modules/identity/identity.types'
import { UserRole, UserStatus } from '../../src/modules/identity/identity.roles'
import type { CourseAdministrationDetailResponseDto } from '../../src/modules/courses/course-administration.types'
import { MaterialProcessingScheduler } from '../../src/modules/materials/processing/material-processing.scheduler'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
import { P0_DEMO_PASSWORD } from '../../src/seeds/p0-demo.seed'
import { IdentityTestStore } from '../support/identity-test-store'
import { NoopMaterialProcessingScheduler } from '../support/noop-material-processing-scheduler'
import type {
  AuditEventListResponseDto,
  AuditEventDto,
} from '../../src/modules/audit/audit.types'

const auditUserAgent = 'Morshid audit isolation e2e'

describe('Audit Isolation (e2e)', () => {
  let app: INestApplication<App>
  let store: IdentityTestStore

  const secondUniId = '00000000-0000-4000-8000-000000000002'
  const secondAdminId = '00000000-0000-4000-8000-000000000022'

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

    // Seed second university and second admin
    store.universities.set(secondUniId, {
      id: secondUniId,
      name: 'Second University',
      code: 'SECOND-UNI',
      status: 'ACTIVE',
      ownerId: secondAdminId,
      createdAt: new Date('2026-07-06T12:00:00.000Z'),
      updatedAt: new Date('2026-07-06T12:00:00.000Z'),
    })

    const admin1 = store.findUserByEmail('admin@morshid.demo')
    if (!admin1) {
      throw new Error('Missing seeded admin user')
    }

    store.users.set(secondAdminId, {
      id: secondAdminId,
      universityId: secondUniId,
      email: 'admin2@morshid.demo',
      displayName: 'Second Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash: admin1.passwordHash,
      createdAt: new Date('2026-07-06T12:00:00.000Z'),
      updatedAt: new Date('2026-07-06T12:00:00.000Z'),
      disabledAt: null,
      disabledById: null,
      lastLoginAt: null,
      passwordChangedAt: new Date('2026-07-06T12:00:00.000Z'),
    })

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

  async function signInAs(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    return (response.body as IdentitySessionResponse).accessToken
  }

  it('isolates audit log listing between two different university scopes', async () => {
    const admin1Token = await signInAs('admin@morshid.demo')
    const admin2Token = await signInAs('admin2@morshid.demo')

    // Admin 1 creates course in University 1
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/admin/courses')
      .set('Authorization', `Bearer ${admin1Token}`)
      .set('User-Agent', auditUserAgent)
      .send({ code: 'CS-UNI1-101', title: 'Uni1 Course' })
      .expect(201)

    const course1 = res1.body as CourseAdministrationDetailResponseDto

    // Admin 2 creates course in University 2
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/admin/courses')
      .set('Authorization', `Bearer ${admin2Token}`)
      .set('User-Agent', auditUserAgent)
      .send({ code: 'CS-UNI2-101', title: 'Uni2 Course' })
      .expect(201)

    const course2 = res2.body as CourseAdministrationDetailResponseDto

    // Admin 1 lists audit events
    const listRes1 = await request(app.getHttpServer())
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${admin1Token}`)
      .expect(200)

    const listBody1 = listRes1.body as AuditEventListResponseDto
    expect(listBody1.events.length).toBeGreaterThanOrEqual(1)
    // All events returned to Admin 1 must belong to University 1
    const courseEvents1 = listBody1.events.filter(
      (e) => e.action === AUDIT_EVENT_ACTIONS.ADMIN_COURSE_CREATED,
    )
    expect(courseEvents1).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: course1.course.id,
        }),
      ]),
    )
    // Must NOT contain Admin 2's course event
    expect(courseEvents1.some((e) => e.targetId === course2.course.id)).toBe(
      false,
    )

    // Admin 2 lists audit events
    const listRes2 = await request(app.getHttpServer())
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${admin2Token}`)
      .expect(200)

    const listBody2 = listRes2.body as AuditEventListResponseDto
    expect(listBody2.events.length).toBeGreaterThanOrEqual(1)
    // All events returned to Admin 2 must belong to University 2
    const courseEvents2 = listBody2.events.filter(
      (e) => e.action === AUDIT_EVENT_ACTIONS.ADMIN_COURSE_CREATED,
    )
    expect(courseEvents2).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: course2.course.id,
        }),
      ]),
    )
    // Must NOT contain Admin 1's course event
    expect(courseEvents2.some((e) => e.targetId === course1.course.id)).toBe(
      false,
    )
  })

  it('allows fetching audit event by ID within same scope and blocks unauthorized cross-scope access with 404', async () => {
    const admin1Token = await signInAs('admin@morshid.demo')
    const admin2Token = await signInAs('admin2@morshid.demo')

    // Admin 1 creates course -> produces audit log in University 1
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/admin/courses')
      .set('Authorization', `Bearer ${admin1Token}`)
      .set('User-Agent', auditUserAgent)
      .send({ code: 'CS-UNI1-DET', title: 'Uni1 Detail Test' })
      .expect(201)

    const course1 = res1.body as CourseAdministrationDetailResponseDto

    // Admin 2 creates course -> produces audit log in University 2
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/admin/courses')
      .set('Authorization', `Bearer ${admin2Token}`)
      .set('User-Agent', auditUserAgent)
      .send({ code: 'CS-UNI2-DET', title: 'Uni2 Detail Test' })
      .expect(201)

    const course2 = res2.body as CourseAdministrationDetailResponseDto

    // Get Admin 1 log id
    const listRes1 = await request(app.getHttpServer())
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${admin1Token}`)
      .expect(200)
    const log1 = (listRes1.body as AuditEventListResponseDto).events.find(
      (e) => e.targetId === course1.course.id,
    )
    if (!log1) {
      throw new Error('Missing expected audit log for course1')
    }

    // Get Admin 2 log id
    const listRes2 = await request(app.getHttpServer())
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${admin2Token}`)
      .expect(200)
    const log2 = (listRes2.body as AuditEventListResponseDto).events.find(
      (e) => e.targetId === course2.course.id,
    )
    if (!log2) {
      throw new Error('Missing expected audit log for course2')
    }

    // Admin 1 can fetch their own audit event by ID (200 OK)
    const getRes1 = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit/${log1.id}`)
      .set('Authorization', `Bearer ${admin1Token}`)
      .expect(200)
    expect((getRes1.body as AuditEventDto).id).toBe(log1.id)

    // Admin 2 can fetch their own audit event by ID (200 OK)
    const getRes2 = await request(app.getHttpServer())
      .get(`/api/v1/admin/audit/${log2.id}`)
      .set('Authorization', `Bearer ${admin2Token}`)
      .expect(200)
    expect((getRes2.body as AuditEventDto).id).toBe(log2.id)

    // Admin 1 CANNOT fetch Admin 2's audit event by ID -> returns 404
    await request(app.getHttpServer())
      .get(`/api/v1/admin/audit/${log2.id}`)
      .set('Authorization', `Bearer ${admin1Token}`)
      .expect(404)

    // Admin 2 CANNOT fetch Admin 1's audit event by ID -> returns 404
    await request(app.getHttpServer())
      .get(`/api/v1/admin/audit/${log1.id}`)
      .set('Authorization', `Bearer ${admin2Token}`)
      .expect(404)
  })

  it('rejects unauthenticated and non-admin requests with 401/403', async () => {
    const studentToken = await signInAs('student1@morshid.demo')

    // Unauthorized list
    await request(app.getHttpServer()).get('/api/v1/admin/audit').expect(401)

    // Student forbidden list
    await request(app.getHttpServer())
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403)

    // Student forbidden detail
    await request(app.getHttpServer())
      .get('/api/v1/admin/audit/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403)
  })
})
