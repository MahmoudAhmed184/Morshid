import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import type { IdentitySessionResponse } from '../../src/modules/identity/identity.types'
import type { CourseListResponseDto } from '../../src/modules/courses/courses.dto'
import {
  CoursesRepository,
  type CourseAdministrationRecord,
  type CourseAccessRecord,
  type CourseMembershipRecord,
  type AddCourseMemberInput,
  type ArchiveCourseInput,
  type BulkAddCourseMembersInput,
  type CreateCourseInput,
  type RemoveCourseMemberInput,
  type UpdateCourseInput,
  type UpdateMemberRoleInput,
} from '../../src/modules/courses/courses.repository'
import { MaterialProcessingScheduler } from '../../src/modules/materials/processing/material-processing.scheduler'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../src/generated/prisma/client'
import { P0_DEMO_PASSWORD } from '../../src/seeds/p0-demo.seed'
import { IdentityTestStore } from '../support/identity-test-store'
import { NoopMaterialProcessingScheduler } from '../support/noop-material-processing-scheduler'

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
    universityId: 'demo-university',
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
    universityId: 'demo-university',
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
] satisfies (CourseAdministrationRecord & { internalOnly: string })[]

class CoursesTestRepository extends CoursesRepository {
  findCourseAccess(
    _userId: string,
    courseId: string,
  ): Promise<CourseAccessRecord | null> {
    const course = adminCourses.find((candidate) => candidate.id === courseId)

    return Promise.resolve(
      course === undefined ? null : { id: course.id, membershipRole: null },
    )
  }

  findMembershipRole() {
    return Promise.resolve(null)
  }

  hasActiveCourseMembership() {
    return Promise.resolve(false)
  }

  listCourseAdministration(): Promise<CourseAdministrationRecord[]> {
    return Promise.resolve(adminCourses)
  }

  findCourseAdministrationById(
    courseId: string,
  ): Promise<CourseAdministrationRecord | null> {
    return Promise.resolve(
      adminCourses.find((course) => course.id === courseId) ?? null,
    )
  }

  findCourseAdministrationByCode(
    code: string,
  ): Promise<CourseAdministrationRecord | null> {
    return Promise.resolve(
      adminCourses.find((course) => course.code === code) ?? null,
    )
  }

  createCourse(_input: CreateCourseInput): Promise<CourseAdministrationRecord> {
    return Promise.reject(new Error('not used by Courses e2e'))
  }

  updateCourse(_input: UpdateCourseInput): Promise<CourseAdministrationRecord> {
    return Promise.reject(new Error('not used by Courses e2e'))
  }

  archiveCourse(_input: ArchiveCourseInput): Promise<void> {
    return Promise.reject(new Error('not used by Courses e2e'))
  }

  findUserById(_userId: string): Promise<{ id: string } | null> {
    return Promise.resolve(null)
  }

  findMembership(
    _courseId: string,
    _userId: string,
  ): Promise<CourseMembershipRecord | null> {
    return Promise.resolve(null)
  }

  addMember(_input: AddCourseMemberInput): Promise<CourseMembershipRecord> {
    return Promise.reject(new Error('not used by Courses e2e'))
  }

  addMembers(
    _input: BulkAddCourseMembersInput,
  ): Promise<{ assignedCount: number; skippedCount: number }> {
    return Promise.reject(new Error('not used by Courses e2e'))
  }

  removeMember(_input: RemoveCourseMemberInput): Promise<void> {
    return Promise.reject(new Error('not used by Courses e2e'))
  }

  listMembers(_courseId: string): Promise<CourseMembershipRecord[]> {
    return Promise.resolve([])
  }

  updateMemberRole(
    _input: UpdateMemberRoleInput,
  ): Promise<CourseMembershipRecord> {
    return Promise.reject(new Error('not used by Courses e2e'))
  }

  listMemberCourses(_userId: string, _role: CourseMembershipRole) {
    if (_role === CourseMembershipRole.INSTRUCTOR) {
      return Promise.resolve([
        {
          id: 'assigned-course',
          code: 'ASSIGNED-P0',
          title: 'Assigned but not owned',
          membershipRole: CourseMembershipRole.INSTRUCTOR,
        },
      ])
    }

    return Promise.resolve([
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: CourseMembershipRole.STUDENT,
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
    const store = new IdentityTestStore()
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

    return (response.body as IdentitySessionResponse).accessToken
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

  it.each([['student1@morshid.demo', CourseMembershipRole.STUDENT]])(
    'scopes %s to its course membership',
    async (email, membershipRole) => {
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
    },
  )

  it('returns only active Instructor memberships as material-manageable courses', async () => {
    const token = await signInAs('instructor@morshid.demo')

    const response = await request(app.getHttpServer())
      .get('/api/v1/courses/material-management')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.body).toEqual({
      courses: [
        {
          id: 'assigned-course',
          code: 'ASSIGNED-P0',
          title: 'Assigned but not owned',
          membershipRole: CourseMembershipRole.INSTRUCTOR,
          canManageMaterials: true,
        },
      ],
    })
  })

  it('does not expose material-manageable course context to students', async () => {
    const token = await signInAs('student1@morshid.demo')

    await request(app.getHttpServer())
      .get('/api/v1/courses/material-management')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
  })
})
