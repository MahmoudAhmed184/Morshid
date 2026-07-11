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
  AdminReactivateUserResponseDto,
  AdminResetUserPasswordResponseDto,
  AdminUserListResponseDto,
} from '../src/modules/admin/users/admin-users.dto'
import { ADMIN_USERS_ERROR_CODES } from '../src/modules/admin/users/admin-users.errors'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import { P0_DEMO_COURSE, P0_DEMO_PASSWORD } from '../src/seeds/p0-demo.seed'
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

  async function signIn(
    email: string,
    password = P0_DEMO_PASSWORD,
  ): Promise<AuthSessionResponse> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({ email, password })
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

  it('rejects unsupported create-user roles at the request boundary', async () => {
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
      .expect((response) => {
        expect(response.body).toMatchObject({
          code: ADMIN_USERS_ERROR_CODES.INVALID_CREATE_REQUEST,
          message: 'Invalid admin user create request',
          errors: [
            expect.objectContaining({
              field: 'role',
            }),
          ],
        })
      })

    expect(store.findUserByEmail('new-admin@morshid.demo')).toBeNull()
  })

  it('publishes the runtime password policy in OpenAPI', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200)
    const document = response.body as {
      components: {
        schemas: Record<string, { properties: Record<string, unknown> }>
      }
    }
    const schemas = document.components.schemas
    const passwordPolicy = {
      minLength: 8,
      maxLength: 50,
      pattern: '^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,50}$',
    }

    expect(schemas.AdminCreateUserRequestDto.properties.password).toMatchObject(
      passwordPolicy,
    )
    expect(
      schemas.AdminResetUserPasswordRequestDto.properties.newPassword,
    ).toMatchObject(passwordPolicy)
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

  it('allows an admin to reset a user password and revoke existing refresh tokens', async () => {
    const targetSession = await signIn('student1@morshid.demo')
    const adminSession = await signIn('admin@morshid.demo')
    const admin = requireUserByEmail('admin@morshid.demo')
    const target = requireUserByEmail('student1@morshid.demo')
    const originalPasswordHash = target.passwordHash
    const originalPasswordChangedAt = target.passwordChangedAt
    const originalMemberships = store.memberships.filter(
      (membership) => membership.userId === target.id,
    )
    const originalRefreshTokens = [...store.refreshTokens.values()].filter(
      (refreshToken) => refreshToken.userId === target.id,
    )
    const newPassword = 'StrongPassword123!'

    expect(originalRefreshTokens).toEqual([
      expect.objectContaining({
        revokedAt: null,
      }),
    ])

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .set('User-Agent', auditUserAgent)
      .send({ newPassword })
      .expect(200)
    const body = response.body as AdminResetUserPasswordResponseDto
    const resetUser = requireUserByEmail('student1@morshid.demo')
    const currentRefreshTokens = [...store.refreshTokens.values()].filter(
      (refreshToken) => refreshToken.userId === target.id,
    )
    const currentMemberships = store.memberships.filter(
      (membership) => membership.userId === target.id,
    )

    expect(body).toEqual({
      user: {
        id: target.id,
        email: target.email,
        displayName: target.displayName,
        role: target.role,
        status: target.status,
        createdAt: target.createdAt.toISOString(),
        updatedAt: resetUser.updatedAt.toISOString(),
      },
    })
    expect(body.user).not.toHaveProperty('password')
    expect(body.user).not.toHaveProperty('passwordHash')
    expect(body.user).not.toHaveProperty('refreshTokens')
    expect(body.user).not.toHaveProperty('disabledAt')
    expect(body.user).not.toHaveProperty('disabledById')
    expect(resetUser).toEqual(
      expect.objectContaining({
        id: target.id,
        email: target.email,
        displayName: target.displayName,
        role: target.role,
        status: target.status,
        disabledAt: target.disabledAt,
        disabledById: target.disabledById,
      }),
    )
    expect(resetUser.passwordHash).toEqual(expect.any(String))
    expect(resetUser.passwordHash).not.toBe(originalPasswordHash)
    expect(resetUser.passwordHash).not.toBe(newPassword)
    expect(resetUser.passwordChangedAt.getTime()).toBeGreaterThan(
      originalPasswordChangedAt.getTime(),
    )
    expect(currentRefreshTokens).toEqual([
      expect.objectContaining({
        id: originalRefreshTokens[0]?.id,
        revokedAt: resetUser.passwordChangedAt,
      }),
    ])
    expect(currentMemberships).toEqual(originalMemberships)

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('User-Agent', auditUserAgent)
      .send({ refreshToken: targetSession.refreshToken })
      .expect(401)
      .expect({
        code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token',
      })
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${targetSession.accessToken}`)
      .expect(401)
      .expect({
        code: AUTH_ERROR_CODES.INVALID_ACCESS_TOKEN,
        message: 'Invalid access token',
      })
    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({ email: target.email, password: P0_DEMO_PASSWORD })
      .expect(401)
      .expect({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      })
    await signIn(target.email, newPassword)

    const adminUserPasswordResetAudit = [...store.auditLogs.values()].filter(
      (auditLog) =>
        auditLog.action === AUDIT_EVENT_ACTIONS.ADMIN_USER_PASSWORD_RESET,
    )

    expect(adminUserPasswordResetAudit).toEqual([
      expect.objectContaining({
        actorUserId: admin.id,
        action: AUDIT_EVENT_ACTIONS.ADMIN_USER_PASSWORD_RESET,
        targetType: AUDIT_TARGET_TYPES.USER,
        targetId: target.id,
        courseId: null,
        ip: anyString,
        userAgent: auditUserAgent,
        metadata: {
          email: target.email,
          displayName: target.displayName,
          role: target.role,
          refreshTokensRevoked: true,
          revokedRefreshTokenCount: 1,
        },
        createdAt: anyDate,
      }),
    ])
    expect(adminUserPasswordResetAudit[0]?.metadata).not.toHaveProperty(
      'password',
    )
    expect(adminUserPasswordResetAudit[0]?.metadata).not.toHaveProperty(
      'newPassword',
    )
    expect(adminUserPasswordResetAudit[0]?.metadata).not.toHaveProperty(
      'passwordHash',
    )
    expect(adminUserPasswordResetAudit[0]?.metadata).not.toHaveProperty(
      'tokenHash',
    )
  })

  it('resets a disabled user password without reactivating the user', async () => {
    const adminSession = await signIn('admin@morshid.demo')
    const admin = requireUserByEmail('admin@morshid.demo')
    const target = requireUserByEmail('student1@morshid.demo')
    const originalRole = target.role
    const originalEmail = target.email
    const originalDisplayName = target.displayName

    store.disableUser(target.email, admin.id)
    const disabledUser = requireUserByEmail(target.email)
    const originalDisabledAt = disabledUser.disabledAt
    const originalDisabledById = disabledUser.disabledById

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .set('User-Agent', auditUserAgent)
      .send({ newPassword: 'StrongPassword123!' })
      .expect(200)
    const body = response.body as AdminResetUserPasswordResponseDto
    const resetUser = requireUserByEmail(target.email)

    expect(resetUser).toEqual(
      expect.objectContaining({
        email: originalEmail,
        displayName: originalDisplayName,
        role: originalRole,
        status: UserStatus.DISABLED,
        disabledAt: originalDisabledAt,
        disabledById: originalDisabledById,
      }),
    )
    expect(body.user).toEqual({
      id: target.id,
      email: originalEmail,
      displayName: originalDisplayName,
      role: originalRole,
      status: UserStatus.DISABLED,
      createdAt: target.createdAt.toISOString(),
      updatedAt: resetUser.updatedAt.toISOString(),
    })
  })

  it('returns reset-password validation errors for empty passwords', async () => {
    const token = await signInAs('admin@morshid.demo')
    const target = requireUserByEmail('student1@morshid.demo')
    const originalPasswordHash = target.passwordHash

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: '' })
      .expect(400)
      .expect({
        code: ADMIN_USERS_ERROR_CODES.INVALID_RESET_PASSWORD_REQUEST,
        message: 'Invalid admin user password reset request',
        errors: [
          {
            field: 'newPassword',
            message: 'Password must be at least 8 characters',
          },
          {
            field: 'newPassword',
            message: 'Password must contain at least one letter',
          },
          {
            field: 'newPassword',
            message: 'Password must contain at least one number',
          },
          {
            field: 'newPassword',
            message: 'Password must contain at least one symbol',
          },
        ],
      })

    expect(requireUserByEmail(target.email).passwordHash).toBe(
      originalPasswordHash,
    )
  })

  it('rejects weak reset-password values with the create-user password policy', async () => {
    const token = await signInAs('admin@morshid.demo')
    const target = requireUserByEmail('student1@morshid.demo')

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'weakpass' })
      .expect(400)
      .expect({
        code: ADMIN_USERS_ERROR_CODES.INVALID_RESET_PASSWORD_REQUEST,
        message: 'Invalid admin user password reset request',
        errors: [
          {
            field: 'newPassword',
            message: 'Password must contain at least one number',
          },
          {
            field: 'newPassword',
            message: 'Password must contain at least one symbol',
          },
        ],
      })
  })

  it('returns not found when resetting a missing user password', async () => {
    const token = await signInAs('admin@morshid.demo')
    const missingUserId = '00000000-0000-4000-8000-000000009999'

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${missingUserId}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'StrongPassword123!' })
      .expect(404)
      .expect({
        code: ADMIN_USERS_ERROR_CODES.USER_NOT_FOUND,
        message: 'Admin user target was not found',
        userId: missingUserId,
      })
  })

  it.each([
    ['disable', undefined],
    ['reactivate', undefined],
    ['reset-password', { newPassword: 'StrongPassword123!' }],
  ])('rejects malformed user ids for %s', async (action, body) => {
    const token = await signInAs('admin@morshid.demo')
    const requestBuilder = request(app.getHttpServer())
      .patch(`/api/v1/admin/users/not-a-uuid/${action}`)
      .set('Authorization', `Bearer ${token}`)

    if (body !== undefined) {
      requestBuilder.send(body)
    }

    await requestBuilder.expect(400)
  })

  it('rejects non-admin user reset-password requests', async () => {
    const token = await signInAs('student1@morshid.demo')
    const target = requireUserByEmail('instructor@morshid.demo')
    const originalPasswordHash = target.passwordHash

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'StrongPassword123!' })
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
        message: 'Insufficient role',
      })

    expect(requireUserByEmail(target.email).passwordHash).toBe(
      originalPasswordHash,
    )
  })

  it('rejects unauthenticated user reset-password requests', async () => {
    const target = requireUserByEmail('student1@morshid.demo')
    const originalPasswordHash = target.passwordHash

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/reset-password`)
      .send({ newPassword: 'StrongPassword123!' })
      .expect(401)

    expect(requireUserByEmail(target.email).passwordHash).toBe(
      originalPasswordHash,
    )
  })

  it('allows an admin to disable an active user', async () => {
    const adminSession = await signIn('admin@morshid.demo')
    const targetSession = await signIn('student1@morshid.demo')
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
    const revokedTargetRefreshTokens = [...store.refreshTokens.values()].filter(
      (refreshToken) => refreshToken.userId === target.id,
    )

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

    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${targetSession.accessToken}`)
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: targetSession.refreshToken })
      .expect(401)
      .expect({
        code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token',
      })
    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email: target.email, password: P0_DEMO_PASSWORD })
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })

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

  it('allows an admin to reactivate a disabled user without changing security or course state', async () => {
    await signIn('student1@morshid.demo')
    const adminSession = await signIn('admin@morshid.demo')
    const admin = requireUserByEmail('admin@morshid.demo')
    const target = requireUserByEmail('student1@morshid.demo')
    const originalRefreshTokens = [...store.refreshTokens.values()].filter(
      (refreshToken) => refreshToken.userId === target.id,
    )
    const originalMemberships = store.memberships.filter(
      (membership) => membership.userId === target.id,
    )

    store.disableUser(target.email, admin.id)

    const disabledUser = requireUserByEmail(target.email)
    const originalPasswordHash = disabledUser.passwordHash
    const originalPasswordChangedAt = disabledUser.passwordChangedAt

    expect(originalRefreshTokens).toEqual([
      expect.objectContaining({
        revokedAt: null,
      }),
    ])
    expect(disabledUser).toEqual(
      expect.objectContaining({
        status: UserStatus.DISABLED,
        disabledAt: anyDate,
        disabledById: admin.id,
      }),
    )

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/reactivate`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .set('User-Agent', auditUserAgent)
      .expect(200)
    const body = response.body as AdminReactivateUserResponseDto
    const reactivatedUser = store.users.get(target.id)
    const currentRefreshTokens = [...store.refreshTokens.values()].filter(
      (refreshToken) => refreshToken.userId === target.id,
    )
    const currentMemberships = store.memberships.filter(
      (membership) => membership.userId === target.id,
    )

    expect(reactivatedUser).toEqual(
      expect.objectContaining({
        status: UserStatus.ACTIVE,
        disabledAt: null,
        disabledById: null,
        passwordHash: originalPasswordHash,
        passwordChangedAt: originalPasswordChangedAt,
      }),
    )
    expect(body).toEqual({
      user: {
        id: target.id,
        email: target.email,
        displayName: target.displayName,
        role: target.role,
        status: UserStatus.ACTIVE,
        createdAt: target.createdAt.toISOString(),
        updatedAt: reactivatedUser?.updatedAt.toISOString(),
      },
    })
    expect(body.user).not.toHaveProperty('passwordHash')
    expect(body.user).not.toHaveProperty('refreshTokens')
    expect(body.user).not.toHaveProperty('disabledAt')
    expect(body.user).not.toHaveProperty('disabledById')
    expect(currentRefreshTokens).toEqual(originalRefreshTokens)
    expect(currentMemberships).toEqual(originalMemberships)

    const adminUserReactivateAudit = [...store.auditLogs.values()].filter(
      (auditLog) =>
        auditLog.action === AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_ENABLED,
    )

    expect(adminUserReactivateAudit).toEqual([
      expect.objectContaining({
        actorUserId: admin.id,
        action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_ENABLED,
        targetType: AUDIT_TARGET_TYPES.USER,
        targetId: target.id,
        courseId: null,
        ip: anyString,
        userAgent: auditUserAgent,
        metadata: {
          email: target.email,
          displayName: target.displayName,
          role: target.role,
        },
        createdAt: anyDate,
      }),
    ])
  })

  it('returns an already active user idempotently when reactivating', async () => {
    const adminSession = await signIn('admin@morshid.demo')
    const target = requireUserByEmail('student1@morshid.demo')

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/reactivate`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .set('User-Agent', auditUserAgent)
      .expect(200)
    const body = response.body as AdminReactivateUserResponseDto

    expect(body).toEqual({
      user: {
        id: target.id,
        email: target.email,
        displayName: target.displayName,
        role: target.role,
        status: UserStatus.ACTIVE,
        createdAt: target.createdAt.toISOString(),
        updatedAt: target.updatedAt.toISOString(),
      },
    })
    expect(
      [...store.auditLogs.values()].filter(
        (auditLog) =>
          auditLog.action === AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_ENABLED,
      ),
    ).toEqual([])
  })

  it('returns not found when reactivating a missing user', async () => {
    const token = await signInAs('admin@morshid.demo')
    const missingUserId = '00000000-0000-4000-8000-000000009999'

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${missingUserId}/reactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
      .expect({
        code: ADMIN_USERS_ERROR_CODES.USER_NOT_FOUND,
        message: 'Admin user target was not found',
        userId: missingUserId,
      })
  })

  it('rejects non-admin user reactivate requests', async () => {
    const token = await signInAs('student1@morshid.demo')
    const target = requireUserByEmail('instructor@morshid.demo')

    store.disableUser(target.email)

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/reactivate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
        message: 'Insufficient role',
      })

    expect(store.findUserByEmail('instructor@morshid.demo')?.status).toBe(
      UserStatus.DISABLED,
    )
  })

  it('rejects unauthenticated user reactivate requests', async () => {
    const target = requireUserByEmail('student1@morshid.demo')

    store.disableUser(target.email)

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${target.id}/reactivate`)
      .expect(401)

    expect(store.findUserByEmail('student1@morshid.demo')?.status).toBe(
      UserStatus.DISABLED,
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

  it('paginates users with an opaque cursor', async () => {
    const token = await signInAs('admin@morshid.demo')
    const firstPageResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/users?limit=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    const firstPage = firstPageResponse.body as AdminUserListResponseDto

    expect(firstPage.users).toHaveLength(1)
    expect(firstPage.nextCursor).toEqual(expect.any(String))

    const secondPageResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/users?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor ?? '')}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    const secondPage = secondPageResponse.body as AdminUserListResponseDto

    expect(secondPage.users).toHaveLength(1)
    expect(secondPage.users[0]?.id).not.toBe(firstPage.users[0]?.id)
  })

  it('rejects invalid user-list limits', async () => {
    const token = await signInAs('admin@morshid.demo')

    await request(app.getHttpServer())
      .get('/api/v1/admin/users?limit=101')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
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
