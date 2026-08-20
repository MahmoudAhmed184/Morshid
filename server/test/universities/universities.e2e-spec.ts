import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import type { IdentitySessionResponse } from '../../src/modules/identity/identity.types'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
import { MaterialProcessingScheduler } from '../../src/modules/materials/processing/material-processing.scheduler'
import { P0_DEMO_PASSWORD } from '../../src/seeds/p0-demo.seed'
import { IdentityTestStore } from '../support/identity-test-store'
import { NoopMaterialProcessingScheduler } from '../support/noop-material-processing-scheduler'
import { CannotDisableUniversityOwnerError } from '../../src/modules/identity/user-administration/user-administration.errors'
import { UserAdministrationRepository } from '../../src/modules/identity/user-administration/user-administration.repository'
import { UNIVERSITIES_ERROR_CODES } from '../../src/modules/universities/universities.errors'
import type {
  UniversityListResponseDto,
  UniversityResponseDto,
} from '../../src/modules/universities/universities.types'
import type { OpenApiErrorDto } from '../../src/common/http/openapi-error.dto'

describe('Universities (e2e)', () => {
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

  async function getAccessToken(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    const body = response.body as IdentitySessionResponse
    return body.accessToken
  }

  describe('Authorization & RBAC', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/universities',
      )
      expect(response.status).toBe(401)
    })

    it('rejects ADMIN role with 403 Forbidden', async () => {
      const token = await getAccessToken('admin@morshid.demo')
      const response = await request(app.getHttpServer())
        .get('/api/v1/universities')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(403)
    })

    it('rejects INSTRUCTOR role with 403 Forbidden', async () => {
      const token = await getAccessToken('instructor@morshid.demo')
      const response = await request(app.getHttpServer())
        .get('/api/v1/universities')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(403)
    })

    it('rejects STUDENT role with 403 Forbidden', async () => {
      const token = await getAccessToken('student1@morshid.demo')
      const response = await request(app.getHttpServer())
        .get('/api/v1/universities')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(403)
    })

    it('allows SUPER_ADMIN role to access universities list', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const response = await request(app.getHttpServer())
        .get('/api/v1/universities')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      const body = response.body as UniversityListResponseDto
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('pagination')
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/v1/universities', () => {
    it('returns seeded Demo University with owner details and aggregate counts', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const response = await request(app.getHttpServer())
        .get('/api/v1/universities')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      const body = response.body as UniversityListResponseDto
      const demoUni = body.data.find((u) => u.code === 'MORSHID-DEMO')
      expect(demoUni).toBeDefined()
      expect(demoUni?.name).toBe('Morshid Demo University')
      expect(demoUni?.status).toBe('ACTIVE')
      expect(demoUni?.owner).toBeDefined()
      expect(demoUni?.owner?.email).toBe('admin@morshid.demo')
      expect(demoUni?.owner?.displayName).toBe('P0 Demo Admin')
      expect(demoUni?.coursesCount).toBeGreaterThan(0)
      expect(demoUni?.studentsCount).toBeGreaterThanOrEqual(1)
      expect(demoUni?.instructorsCount).toBeGreaterThanOrEqual(1)
    })

    it('filters by status', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const response = await request(app.getHttpServer())
        .get('/api/v1/universities?status=SUSPENDED')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      const body = response.body as UniversityListResponseDto
      expect(body.data.length).toBe(0)
    })

    it('searches by name or code', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const response = await request(app.getHttpServer())
        .get('/api/v1/universities?search=Morshid')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      const body = response.body as UniversityListResponseDto
      expect(body.data.length).toBe(1)
      expect(body.data[0]?.code).toBe('MORSHID-DEMO')
    })

    it('sorts by studentsCount', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const response = await request(app.getHttpServer())
        .get('/api/v1/universities?sortBy=studentsCount&sortOrder=desc')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      const body = response.body as UniversityListResponseDto
      expect(body.data.length).toBeGreaterThan(0)
    })
  })

  describe('POST /api/v1/universities (Atomic University & Admin Creation)', () => {
    it('creates university and primary owner admin', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const response = await request(app.getHttpServer())
        .post('/api/v1/universities')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Alexandria University',
          code: 'alex-uni',
          owner: {
            displayName: 'Alex Admin',
            email: 'Admin@AlexU.edu.eg',
            password: 'StrongAdminPass123!',
          },
        })

      expect(response.status).toBe(201)
      const body = response.body as UniversityResponseDto
      const { university } = body
      expect(university.id).toBeDefined()
      expect(university.name).toBe('Alexandria University')
      expect(university.code).toBe('ALEX-UNI')
      expect(university.status).toBe('ACTIVE')
      expect(university.owner).toBeDefined()
      expect(university.owner?.email).toBe('admin@alexu.edu.eg')
      expect(university.owner?.displayName).toBe('Alex Admin')
      expect(university.owner?.status).toBe('ACTIVE')
      expect(university.studentsCount).toBe(0)
      expect(university.instructorsCount).toBe(0)
      expect(university.coursesCount).toBe(0)

      // Verify the new admin can sign in
      const signInResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .send({
          email: 'admin@alexu.edu.eg',
          password: 'StrongAdminPass123!',
        })
      expect(signInResponse.status).toBe(200)
      const signInBody = signInResponse.body as IdentitySessionResponse
      expect(signInBody.user.role).toBe('ADMIN')
    })

    it('rejects duplicate university code with 409 Conflict', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const response = await request(app.getHttpServer())
        .post('/api/v1/universities')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Duplicate Code University',
          code: 'MORSHID-DEMO',
          owner: {
            displayName: 'Dup Admin',
            email: 'dupadmin@demo.org',
            password: 'StrongAdminPass123!',
          },
        })

      expect(response.status).toBe(409)
      const body = response.body as OpenApiErrorDto
      expect(body.code).toBe(
        UNIVERSITIES_ERROR_CODES.UNIVERSITY_CODE_ALREADY_EXISTS,
      )
    })

    it('rejects duplicate owner email with 409 Conflict', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const response = await request(app.getHttpServer())
        .post('/api/v1/universities')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Unique Code University',
          code: 'UNIQUE-UNI',
          owner: {
            displayName: 'Dup Admin',
            email: 'admin@morshid.demo',
            password: 'StrongAdminPass123!',
          },
        })

      expect(response.status).toBe(409)
      const body = response.body as OpenApiErrorDto
      expect(body.code).toBe(
        UNIVERSITIES_ERROR_CODES.OWNER_EMAIL_ALREADY_EXISTS,
      )
    })

    it('rejects invalid university code format', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const response = await request(app.getHttpServer())
        .post('/api/v1/universities')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Invalid Code University',
          code: 'INVALID CODE with spaces',
          owner: {
            displayName: 'Admin',
            email: 'admin@invalid.edu',
            password: 'StrongAdminPass123!',
          },
        })

      expect(response.status).toBe(400)
    })
  })

  describe('GET /api/v1/universities/:universityId', () => {
    it('returns university details by ID', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const demoId = '00000000-0000-4000-8000-000000000000'

      const response = await request(app.getHttpServer())
        .get(`/api/v1/universities/${demoId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      const body = response.body as UniversityResponseDto
      expect(body.university.id).toBe(demoId)
      expect(body.university.name).toBe('Morshid Demo University')
    })

    it('returns 404 for non-existent university ID', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const missingId = '00000000-0000-4000-8000-999999999999'

      const response = await request(app.getHttpServer())
        .get(`/api/v1/universities/${missingId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
      const body = response.body as OpenApiErrorDto
      expect(body.code).toBe(UNIVERSITIES_ERROR_CODES.UNIVERSITY_NOT_FOUND)
    })
  })

  describe('PATCH /api/v1/universities/:universityId', () => {
    it('updates university name and code', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const demoId = '00000000-0000-4000-8000-000000000000'

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/universities/${demoId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Renamed Demo University',
          code: 'DEMO-UPDATED',
        })

      expect(response.status).toBe(200)
      const body = response.body as UniversityResponseDto
      expect(body.university.name).toBe('Renamed Demo University')
      expect(body.university.code).toBe('DEMO-UPDATED')
    })

    it('rejects update with empty payload', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const demoId = '00000000-0000-4000-8000-000000000000'

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/universities/${demoId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})

      expect(response.status).toBe(400)
    })
  })

  describe('PATCH /api/v1/universities/:universityId/status', () => {
    it('updates university status to SUSPENDED and then ACTIVE', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const demoId = '00000000-0000-4000-8000-000000000000'

      const suspendRes = await request(app.getHttpServer())
        .patch(`/api/v1/universities/${demoId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'SUSPENDED' })

      expect(suspendRes.status).toBe(200)
      const suspendBody = suspendRes.body as UniversityResponseDto
      expect(suspendBody.university.status).toBe('SUSPENDED')

      // Verify sign in for tenant user is blocked when university is SUSPENDED
      const userSignIn = await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in')
        .send({
          email: 'admin@morshid.demo',
          password: P0_DEMO_PASSWORD,
        })
      expect(userSignIn.status).toBe(403)

      // Reactivate
      const reactivateRes = await request(app.getHttpServer())
        .patch(`/api/v1/universities/${demoId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'ACTIVE' })

      expect(reactivateRes.status).toBe(200)
      const reactivateBody = reactivateRes.body as UniversityResponseDto
      expect(reactivateBody.university.status).toBe('ACTIVE')
    })

    it('rejects invalid status', async () => {
      const token = await getAccessToken('superadmin@morshid.demo')
      const demoId = '00000000-0000-4000-8000-000000000000'

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/universities/${demoId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID_STATUS' })

      expect(response.status).toBe(400)
    })
  })

  describe('Owner Invariants Protection', () => {
    it('rejects disabling university primary owner when university is ACTIVE, INACTIVE, or SUSPENDED', async () => {
      const adminUser = store.findUserByEmail('admin@morshid.demo')
      expect(adminUser).not.toBeNull()
      if (
        adminUser?.universityId === null ||
        adminUser?.universityId === undefined
      ) {
        return
      }

      const universityId = adminUser.universityId

      // Add a second active admin in the same university
      const secondAdminId = '00000000-0000-4000-8000-000000000088'
      store.users.set(secondAdminId, {
        id: secondAdminId,
        email: 'second.admin@morshid.demo',
        displayName: 'Second Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        universityId,
        passwordHash: adminUser.passwordHash,
        disabledAt: null,
        disabledById: null,
        lastLoginAt: null,
        passwordChangedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const secondAdminToken = await getAccessToken('second.admin@morshid.demo')
      const superAdminToken = await getAccessToken('superadmin@morshid.demo')
      const userAdminRepo = app.get(UserAdministrationRepository)

      // 1. ACTIVE status: disabling primary owner is rejected (409 Conflict)
      const activeDisableResponse = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${adminUser.id}/disable`)
        .set('Authorization', `Bearer ${secondAdminToken}`)

      expect(activeDisableResponse.status).toBe(409)

      // 2. INACTIVE status: disabling primary owner in repository is still rejected
      await request(app.getHttpServer())
        .patch(`/api/v1/universities/${universityId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'INACTIVE' })
        .expect(200)

      await expect(
        userAdminRepo.disableUser({
          userId: adminUser.id,
          actorUserId: secondAdminId,
          disabledAt: new Date(),
        }),
      ).rejects.toThrow(CannotDisableUniversityOwnerError)

      // 3. SUSPENDED status: disabling primary owner in repository is still rejected
      await request(app.getHttpServer())
        .patch(`/api/v1/universities/${universityId}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'SUSPENDED' })
        .expect(200)

      await expect(
        userAdminRepo.disableUser({
          userId: adminUser.id,
          actorUserId: secondAdminId,
          disabledAt: new Date(),
        }),
      ).rejects.toThrow(CannotDisableUniversityOwnerError)
    })
  })
})
