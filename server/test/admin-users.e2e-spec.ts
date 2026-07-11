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
import { AUTH_ERROR_CODES } from '../src/modules/auth/auth.dto'
import type {
  AdminCreatableUserRole,
  AdminCreateUserResponseDto,
  AdminDisableUserResponseDto,
  AdminUserListResponseDto,
} from '../src/modules/admin/users/admin-users.dto'
import { ADMIN_USERS_ERROR_CODES } from '../src/modules/admin/users/admin-users.errors'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import {
  P0_DEMO_COURSE,
  P0_DEMO_PASSWORD,
} from '../src/seeds/p0-demo.seed'
import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../src/generated/prisma/client'
import { AuthTestStore } from './support/auth-test-store'

const auditUserAgent = 'Morshid admin users e2e'
const anyString = expect.any(String) as unknown as string
const anyDate = expect.any(Date) as unknown as Date

describe('Admin users (e2e)', () => {
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

  async function signIn(email: string): Promise<AuthSessionResponse> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    return response.body as AuthSessionResponse
  }

  async function signInAs(email: string): Promise<string> {
    return (await signIn(email)).accessToken
  }

  async function createUserAsAdmin(role: AdminCreatableUserRole) {
    const token = await signInAs('admin@morshid.demo')

    return request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', auditUserAgent)
      .send({
        email: `New.${role}@Morshid.Demo`,
        displayName: `New ${role}`,
        role,
        password: 'TempPassword123!',
      })
      .expect(201)
  }

  async function listUsersAs(email: string, expectedStatus = 200) {
    const token = await signInAs(email)

    return request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', auditUserAgent)
      .expect(expectedStatus)
  }

  function requireUserByEmail(email: string) {
    const user = store.findUserByEmail(email)

    if (user === null) {
      throw new Error(`Missing test user ${email}`)
    }

    return user
  }

  it.each([UserRole.STUDENT, UserRole.INSTRUCTOR])(
    'allows an admin to create a %s user',
    async (role) => {
      const response = await createUserAsAdmin(role)
      const body = response.body as AdminCreateUserResponseDto
      const email = `new.${role.toLowerCase()}@morshid.demo`
      const createdUser = store.findUserByEmail(email)
      const admin = store.findUserByEmail('admin@morshid.demo')

      expect(createdUser).not.toBeNull()
      expect(createdUser).toEqual(
        expect.objectContaining({
          email,
          displayName: `New ${role}`,
          role,
          status: UserStatus.ACTIVE,
        }),
      )
      expect(createdUser?.passwordHash).toEqual(expect.any(String))
      expect(createdUser?.passwordHash).not.toBe('TempPassword123!')
      expect(body).toEqual({
        user: {
          id: createdUser?.id,
          email,
          displayName: `New ${role}`,
          role,
          status: UserStatus.ACTIVE,
          createdAt: createdUser?.createdAt.toISOString(),
          updatedAt: createdUser?.updatedAt.toISOString(),
        },
      })
      expect(body.user).not.toHaveProperty('passwordHash')
      expect(body.user).not.toHaveProperty('password')
      expect(body.user).not.toHaveProperty('refreshTokens')

      const adminUserCreateAudit = [...store.auditLogs.values()].filter(
        (auditLog) =>
          auditLog.action === AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_CREATED,
      )

      expect(adminUserCreateAudit).toEqual([
        expect.objectContaining({
          actorUserId: admin?.id,
          action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_CREATED,
          targetType: AUDIT_TARGET_TYPES.USER,
          targetId: createdUser?.id,
          courseId: null,
          ip: anyString,
          userAgent: auditUserAgent,
          metadata: {
            email,
            displayName: `New ${role}`,
            role,
          },
          createdAt: anyDate,
        }),
      ])
    },
  )

  it('rejects creating an admin user through this endpoint', async () => {
    const token = await signInAs('admin@morshid.demo')

    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'new-admin@morshid.demo',
        displayName: 'New Admin',
        role: UserRole.ADMIN,
        password: 'TempPassword123!',
      })
      .expect(400)
      .expect({
        code: ADMIN_USERS_ERROR_CODES.UNSUPPORTED_ROLE,
        message: 'Admin users can only create STUDENT or INSTRUCTOR accounts',
      })

    expect(store.findUserByEmail('new-admin@morshid.demo')).toBeNull()
  })

  it('returns field-level validation errors for empty passwords', async () => {
    const token = await signInAs('admin@morshid.demo')

    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'empty-password@morshid.demo',
        displayName: 'Empty Password',
        role: UserRole.STUDENT,
        password: '',
      })
      .expect(400)
      .expect({
        code: ADMIN_USERS_ERROR_CODES.INVALID_CREATE_REQUEST,
        message: 'Invalid admin user create request',
        errors: [
          {
            field: 'password',
            message: 'Password must be at least 8 characters',
          },
          {
            field: 'password',
            message: 'Password must contain at least one letter',
          },
          {
            field: 'password',
            message: 'Password must contain at least one number',
          },
          {
            field: 'password',
            message: 'Password must contain at least one symbol',
          },
        ],
      })

    expect(store.findUserByEmail('empty-password@morshid.demo')).toBeNull()
  })

  it('rejects duplicate email creation', async () => {
    const token = await signInAs('admin@morshid.demo')

    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'student1@morshid.demo',
        displayName: 'Duplicate Student',
        role: UserRole.STUDENT,
        password: 'TempPassword123!',
      })
      .expect(409)
      .expect({
        code: ADMIN_USERS_ERROR_CODES.DUPLICATE_EMAIL,
        message: 'A user with this email already exists',
        email: 'student1@morshid.demo',
      })
  })

  it('rejects non-admin users', async () => {
    const token = await signInAs('student1@morshid.demo')

    await request(app.getHttpServer())
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'student-created@morshid.demo',
        displayName: 'Student Created',
        role: UserRole.STUDENT,
        password: 'temporary-password',
      })
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
        message: 'Insufficient role',
      })
  })

  it('allows an admin to disable an active user', async () => {
    const adminSession = await signIn('admin@morshid.demo')
    await signIn('student1@morshid.demo')
    const admin = requireUserByEmail('admin@morshid.demo')
    const target = requireUserByEmail('student1@morshid.demo')
    const targetRefreshTokens = [...store.refreshTokens.values()].filter(
      (refreshToken) => refreshToken.userId === target.id,
    )

    expect(targetRefreshTokens).toHaveLength(1)
    expect(targetRefreshTokens[0]?.revokedAt).toBeNull()

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/disable`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .set('User-Agent', auditUserAgent)
      .expect(200)
    const body = response.body as AdminDisableUserResponseDto
    const disabledUser = store.users.get(target.id)
    const revokedTargetRefreshTokens = [
      ...store.refreshTokens.values(),
    ].filter((refreshToken) => refreshToken.userId === target.id)

    expect(disabledUser).toEqual(
      expect.objectContaining({
        status: UserStatus.DISABLED,
        disabledAt: anyDate,
        disabledById: admin.id,
      }),
    )
    expect(body).toEqual({
      user: {
        id: target.id,
        email: target.email,
        displayName: target.displayName,
        role: target.role,
        status: UserStatus.DISABLED,
        createdAt: target.createdAt.toISOString(),
        updatedAt: disabledUser?.updatedAt.toISOString(),
      },
    })
    expect(body.user).not.toHaveProperty('passwordHash')
    expect(body.user).not.toHaveProperty('refreshTokens')
    expect(body.user).not.toHaveProperty('disabledAt')
    expect(body.user).not.toHaveProperty('disabledById')
    expect(revokedTargetRefreshTokens).toEqual([
      expect.objectContaining({
        id: targetRefreshTokens[0]?.id,
        revokedAt: disabledUser?.disabledAt,
      }),
    ])

    const adminUserDisableAudit = [...store.auditLogs.values()].filter(
      (auditLog) =>
        auditLog.action === AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_DISABLED,
    )

    expect(adminUserDisableAudit).toEqual([
      expect.objectContaining({
        actorUserId: admin.id,
        action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_DISABLED,
        targetType: AUDIT_TARGET_TYPES.USER,
        targetId: target.id,
        courseId: null,
        ip: anyString,
        userAgent: auditUserAgent,
        metadata: {
          email: target.email,
          displayName: target.displayName,
          role: target.role,
          revokedRefreshTokenCount: 1,
        },
        createdAt: anyDate,
      }),
    ])
  })

  it('returns not found when disabling a missing user', async () => {
    const token = await signInAs('admin@morshid.demo')
    const missingUserId = '00000000-0000-4000-8000-000000009999'

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${missingUserId}/disable`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
      .expect({
        code: ADMIN_USERS_ERROR_CODES.USER_NOT_FOUND,
        message: 'Admin user target was not found',
        userId: missingUserId,
      })
  })

  it('rejects admin self-disable requests', async () => {
    const token = await signInAs('admin@morshid.demo')
    const admin = requireUserByEmail('admin@morshid.demo')

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${admin.id}/disable`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect({
        code: ADMIN_USERS_ERROR_CODES.CANNOT_DISABLE_SELF,
        message: 'Administrators cannot disable their own account',
      })

    expect(store.findUserByEmail('admin@morshid.demo')?.status).toBe(
      UserStatus.ACTIVE,
    )
  })

  it('rejects non-admin user disable requests', async () => {
    const token = await signInAs('student1@morshid.demo')
    const target = requireUserByEmail('instructor@morshid.demo')

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/disable`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
        message: 'Insufficient role',
      })

    expect(store.findUserByEmail('instructor@morshid.demo')?.status).toBe(
      UserStatus.ACTIVE,
    )
  })

  it('rejects unauthenticated user disable requests', async () => {
    const target = requireUserByEmail('student1@morshid.demo')

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/disable`)
      .expect(401)
  })

  it('allows an admin to list users as safe public records ordered by newest first', async () => {
    await createUserAsAdmin(UserRole.STUDENT)

    const response = await listUsersAs('admin@morshid.demo')
    const body = response.body as AdminUserListResponseDto

    expect(body.users[0]).toMatchObject({
      email: 'new.student@morshid.demo',
      displayName: 'New STUDENT',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    })
    expect(body.users[0]).toEqual({
      id: anyString,
      email: 'new.student@morshid.demo',
      displayName: 'New STUDENT',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt: anyString,
      updatedAt: anyString,
      courseAssignments: {
        courseCount: 0,
        instructorCourseCount: 0,
        studentCourseCount: 0,
        courses: [],
      },
    })
    expect(body.users[0]).not.toHaveProperty('passwordHash')
    expect(body.users[0]).not.toHaveProperty('refreshTokens')
    const student = body.users.find(
      (user) => user.email === 'student1@morshid.demo',
    )

    expect(student?.courseAssignments).toEqual({
      courseCount: 1,
      instructorCourseCount: 0,
      studentCourseCount: 1,
      courses: [
        {
          courseId: anyString,
          code: P0_DEMO_COURSE.code,
          title: P0_DEMO_COURSE.title,
          role: CourseMembershipRole.STUDENT,
        },
      ],
    })
    expect(body.users.map((user) => user.email)).toEqual(
      expect.arrayContaining([
        'admin@morshid.demo',
        'instructor@morshid.demo',
        'student1@morshid.demo',
        'new.student@morshid.demo',
      ]),
    )
  })

  it('rejects unauthenticated user list requests', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401)
  })

  it('rejects non-admin user list requests', async () => {
    const response = await listUsersAs('student1@morshid.demo', 403)

    expect(response.body).toEqual({
      code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
      message: 'Insufficient role',
    })
  })
})
