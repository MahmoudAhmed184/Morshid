import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import type { CourseListResponseDto } from '../src/modules/courses/courses.dto'
import {
  CoursesRepository,
  type AdminCourseRecord,
} from '../src/modules/courses/courses.repository'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../src/generated/prisma/client'
import { P0_DEMO_PASSWORD } from '../src/seeds/p0-demo.seed'
import { AuthTestStore } from './support/auth-test-store'

const createdAt = new Date('2026-07-06T00:00:00.000Z')
const updatedAt = new Date('2026-07-06T01:00:00.000Z')

const instructor = {
  id: 'instructor-user',
  email: 'instructor@morshid.demo',
  displayName: 'Demo Instructor',
  role: UserRole.INSTRUCTOR,
  status: UserStatus.ACTIVE,
}

const adminCourses = [
  {
    id: 'python-course',
    code: 'PYTHON-PROG-P0',
    title: 'Python Programming',
    createdById: instructor.id,
    createdBy: instructor,
    createdAt,
    updatedAt,
    memberships: [
      {
        id: 'instructor-membership',
        userId: instructor.id,
        role: CourseMembershipRole.INSTRUCTOR,
        createdAt,
        user: instructor,
      },
    ],
    materials: [{ deletedAt: null }],
    internalOnly: 'must not be serialized',
  },
  {
    id: 'hidden-course',
    code: 'HIDDEN-ISOLATION',
    title: 'Hidden Isolation Test Course',
    createdById: null,
    createdBy: null,
    createdAt,
    updatedAt,
    memberships: [],
    materials: [],
    internalOnly: 'must not be serialized',
  },
] satisfies (AdminCourseRecord & { internalOnly: string })[]

class CoursesTestRepository extends CoursesRepository {
  findMembershipRole() {
    return Promise.resolve(null)
  }

  isCourseOwner() {
    return Promise.resolve(false)
  }

  listAdminCourses(): Promise<AdminCourseRecord[]> {
    return Promise.resolve(adminCourses)
  }

  listMemberCourses(_userId: string, _role: CourseMembershipRole) {
    return Promise.resolve([
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: CourseMembershipRole.STUDENT,
      },
    ])
  }

  listOwnedCourses() {
    return Promise.resolve([
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: CourseMembershipRole.INSTRUCTOR,
      },
    ])
  }
}

describe('Courses (e2e)', () => {
  let app: INestApplication<App>

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
    const store = new AuthTestStore()
    jest.clearAllMocks()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(store.prisma)
      .overrideProvider(RedisService)
      .useValue(redisService)
      .overrideProvider(CoursesRepository)
      .useClass(CoursesTestRepository)
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

  async function listCoursesAs(email: string) {
    const token = await signInAs(email)

    return request(app.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
  }

  it('rejects requests without an access token', async () => {
    await request(app.getHttpServer()).get('/api/v1/courses').expect(401)
  })

  it('returns all courses and sanitized metadata to admins', async () => {
    const response = await listCoursesAs('admin@morshid.demo')
    const body = response.body as CourseListResponseDto

    expect(body.courses.map(({ code }) => code)).toEqual([
      'HIDDEN-ISOLATION',
      'PYTHON-PROG-P0',
    ])
    expect(body.courses[0]).not.toHaveProperty('internalOnly')
    expect(body.courses[1].adminMetadata).toMatchObject({
      memberCount: 1,
      instructorCount: 1,
      studentCount: 0,
      materialCount: 1,
      activeMaterialCount: 1,
    })
  })

  it.each([
    ['instructor@morshid.demo', CourseMembershipRole.INSTRUCTOR],
    ['student1@morshid.demo', CourseMembershipRole.STUDENT],
  ])('scopes %s to its course membership', async (email, membershipRole) => {
    const response = await listCoursesAs(email)

    expect(response.body).toEqual({
      courses: [
        {
          id: 'python-course',
          code: 'PYTHON-PROG-P0',
          title: 'Python Programming',
          membershipRole,
        },
      ],
    })
  })
})
