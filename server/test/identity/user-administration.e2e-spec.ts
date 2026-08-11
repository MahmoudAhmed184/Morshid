import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../../src/modules/audit/audit.constants'
import type { IdentitySessionResponse } from '../../src/modules/identity/identity.types'
import { IDENTITY_ERROR_CODES } from '../../src/modules/identity/identity.types'
import type {
  CreatableUserRole,
  CreateUserResponseDto,
  DisableUserResponseDto,
  ReactivateUserResponseDto,
  ResetUserPasswordResponseDto,
  UpdateUserResponseDto,
  ManagedUserListResponseDto,
} from '../../src/modules/identity/user-administration/user-administration.types'
import { USER_ADMINISTRATION_ERROR_CODES } from '../../src/modules/identity/user-administration/user-administration.errors'
import { MaterialProcessingScheduler } from '../../src/modules/materials/material-processing.scheduler'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
import { P0_DEMO_COURSE, P0_DEMO_PASSWORD } from '../../src/seeds/p0-demo.seed'
import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../src/generated/prisma/client'
import { IdentityTestStore } from '../support/identity-test-store'
import { NoopMaterialProcessingScheduler } from '../support/noop-material-processing-scheduler'

const auditUserAgent = 'Morshid admin users e2e'
const anyString = expect.any(String) as unknown as string
const anyDate = expect.any(Date) as unknown as Date

function readRefreshCookie(response: { headers: Record<string, unknown> }) {
  const cookies = response.headers['set-cookie']

  if (!isStringArray(cookies)) {
    throw new Error('Expected a morshid_refresh cookie')
  }

  const refreshCookie = cookies.find((cookie) =>
    cookie.startsWith('morshid_refresh='),
  )

  if (refreshCookie === undefined) {
    throw new Error('Expected a morshid_refresh cookie')
  }

  return refreshCookie.split(';')[0]
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => typeof item === 'string')
  )
}

describe('Admin users (e2e)', () => {
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

  async function signIn(
    email: string,
    password = P0_DEMO_PASSWORD,
  ): Promise<IdentitySessionResponse> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({ email, password })
      .expect(200)

    return response.body as IdentitySessionResponse
  }

  async function signInAs(email: string): Promise<string> {
    return (await signIn(email)).accessToken
  }

  async function signInWithCookie(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    return {
      session: response.body as IdentitySessionResponse,
      refreshCookie: readRefreshCookie(response),
    }
  }

  async function createUserAsAdmin(role: CreatableUserRole) {
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
      const body = response.body as CreateUserResponseDto
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
          code: USER_ADMINISTRATION_ERROR_CODES.INVALID_CREATE_REQUEST,
          message: 'Invalid user create request',
          errors: [
            expect.objectContaining({
              field: 'role',
            }),
          ],
        })
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
        code: USER_ADMINISTRATION_ERROR_CODES.INVALID_CREATE_REQUEST,
        message: 'Invalid user create request',
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
        code: USER_ADMINISTRATION_ERROR_CODES.DUPLICATE_EMAIL,
        message: 'A user with this email already exists',
        email: 'student1@morshid.demo',
      })
  })

  describe('PATCH /api/v1/admin/users/:userId', () => {
    it('updates profile fields and records before/after audit evidence', async () => {
      const token = await signInAs('admin@morshid.demo')
      const admin = requireUserByEmail('admin@morshid.demo')
      const target = requireUserByEmail('student1@morshid.demo')

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', auditUserAgent)
        .send({
          email: 'updated.student@morshid.demo',
          displayName: 'Updated Student',
        })
        .expect(200)

      const body = response.body as UpdateUserResponseDto
      expect(body.user).toMatchObject({
        id: target.id,
        email: 'updated.student@morshid.demo',
        displayName: 'Updated Student',
        role: UserRole.STUDENT,
      })

      const auditLogs = [...store.auditLogs.values()].filter(
        (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_UPDATED,
      )
      expect(auditLogs).toEqual([
        expect.objectContaining({
          actorUserId: admin.id,
          targetId: target.id,
          userAgent: auditUserAgent,
          metadata: {
            before: {
              email: target.email,
              displayName: target.displayName,
              role: target.role,
            },
            after: {
              email: 'updated.student@morshid.demo',
              displayName: 'Updated Student',
              role: target.role,
            },
            changedFields: ['email', 'displayName'],
          },
        }),
      ])
    })

    it('rejects an empty update without writing an audit event', async () => {
      const token = await signInAs('admin@morshid.demo')
      const target = requireUserByEmail('student1@morshid.demo')

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400)
        .expect((response) => {
          expect(response.body).toMatchObject({
            code: USER_ADMINISTRATION_ERROR_CODES.INVALID_UPDATE_REQUEST,
          })
        })

      expect(
        [...store.auditLogs.values()].filter(
          (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_UPDATED,
        ),
      ).toEqual([])
    })

    it('rejects role changes while active course memberships exist', async () => {
      const token = await signInAs('admin@morshid.demo')
      const target = requireUserByEmail('student1@morshid.demo')

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: UserRole.INSTRUCTOR })
        .expect(409)
        .expect({
          code: USER_ADMINISTRATION_ERROR_CODES.ROLE_CHANGE_HAS_MEMBERSHIPS,
          message:
            'Remove active course memberships before changing the account role',
          userId: target.id,
        })

      expect(requireUserByEmail(target.email).role).toBe(UserRole.STUDENT)
      expect(
        [...store.auditLogs.values()].filter(
          (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_UPDATED,
        ),
      ).toEqual([])
    })

    it('applies a role change once the account has no active course memberships', async () => {
      const token = await signInAs('admin@morshid.demo')
      const admin = requireUserByEmail('admin@morshid.demo')
      const created = await createUserAsAdmin(UserRole.STUDENT)
      const createdUser = (created.body as CreateUserResponseDto).user

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${createdUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', auditUserAgent)
        .send({ role: UserRole.INSTRUCTOR })
        .expect(200)

      const body = response.body as UpdateUserResponseDto
      expect(body).toEqual({
        user: {
          id: createdUser.id,
          email: createdUser.email,
          displayName: createdUser.displayName,
          role: UserRole.INSTRUCTOR,
          status: UserStatus.ACTIVE,
          createdAt: anyString,
          updatedAt: anyString,
        },
      })
      expect(body.user).not.toHaveProperty('passwordHash')
      expect(body.user).not.toHaveProperty('password')
      expect(requireUserByEmail(createdUser.email).role).toBe(
        UserRole.INSTRUCTOR,
      )
      expect(
        [...store.auditLogs.values()].filter(
          (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_UPDATED,
        ),
      ).toEqual([
        expect.objectContaining({
          actorUserId: admin.id,
          targetType: AUDIT_TARGET_TYPES.USER,
          targetId: createdUser.id,
          metadata: {
            before: {
              email: createdUser.email,
              displayName: createdUser.displayName,
              role: UserRole.STUDENT,
            },
            after: {
              email: createdUser.email,
              displayName: createdUser.displayName,
              role: UserRole.INSTRUCTOR,
            },
            changedFields: ['role'],
          },
        }),
      ])
    })

    it('rejects changing an administrator role', async () => {
      const token = await signInAs('admin@morshid.demo')
      const admin = requireUserByEmail('admin@morshid.demo')

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${admin.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: UserRole.STUDENT })
        .expect(403)
        .expect({
          code: USER_ADMINISTRATION_ERROR_CODES.CANNOT_CHANGE_ADMIN_ROLE,
          message: 'Administrator account roles cannot be changed',
        })

      expect(requireUserByEmail('admin@morshid.demo').role).toBe(UserRole.ADMIN)
      expect(
        [...store.auditLogs.values()].filter(
          (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_UPDATED,
        ),
      ).toEqual([])
    })

    it('rejects an email that is already owned by another account', async () => {
      const token = await signInAs('admin@morshid.demo')
      const target = requireUserByEmail('student1@morshid.demo')

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'INSTRUCTOR@morshid.demo' })
        .expect(409)
        .expect({
          code: USER_ADMINISTRATION_ERROR_CODES.DUPLICATE_EMAIL,
          message: 'A user with this email already exists',
          email: 'instructor@morshid.demo',
        })

      expect(requireUserByEmail('student1@morshid.demo').id).toBe(target.id)
      expect(
        [...store.auditLogs.values()].filter(
          (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_UPDATED,
        ),
      ).toEqual([])
    })

    it('returns not found for an unknown user', async () => {
      const token = await signInAs('admin@morshid.demo')
      const missingUserId = '00000000-0000-4000-8000-000000009999'

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${missingUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Nope' })
        .expect(404)
        .expect({
          code: USER_ADMINISTRATION_ERROR_CODES.USER_NOT_FOUND,
          message: 'User target was not found',
          userId: missingUserId,
        })
    })

    it('rejects unknown update fields such as password', async () => {
      const token = await signInAs('admin@morshid.demo')
      const target = requireUserByEmail('student1@morshid.demo')

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Renamed', password: 'TempPassword123!' })
        .expect(400)
        .expect((response) => {
          expect(response.body).toMatchObject({
            code: USER_ADMINISTRATION_ERROR_CODES.INVALID_UPDATE_REQUEST,
          })
        })

      expect(requireUserByEmail('student1@morshid.demo').displayName).toBe(
        target.displayName,
      )
      expect(
        [...store.auditLogs.values()].filter(
          (log) => log.action === AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_UPDATED,
        ),
      ).toEqual([])
    })

    it('rejects malformed user ids', async () => {
      const token = await signInAs('admin@morshid.demo')

      await request(app.getHttpServer())
        .patch('/api/v1/admin/users/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Nope' })
        .expect(400)
    })

    it('rejects non-admin updates', async () => {
      const token = await signInAs('student1@morshid.demo')
      const target = requireUserByEmail('instructor@morshid.demo')

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Nope' })
        .expect(403)
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
        code: IDENTITY_ERROR_CODES.INSUFFICIENT_ROLE,
        message: 'Insufficient role',
      })
  })

  it('allows an admin to reset a user password and revoke existing refresh tokens', async () => {
    const targetAuth = await signInWithCookie('student1@morshid.demo')
    const targetSession = targetAuth.session
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
    const body = response.body as ResetUserPasswordResponseDto
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
      .set('Cookie', targetAuth.refreshCookie)
      .set('User-Agent', auditUserAgent)
      .expect(401)
      .expect({
        code: IDENTITY_ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token',
      })
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${targetSession.accessToken}`)
      .expect(401)
      .expect({
        code: IDENTITY_ERROR_CODES.INVALID_ACCESS_TOKEN,
        message: 'Invalid access token',
      })
    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', auditUserAgent)
      .send({ email: target.email, password: P0_DEMO_PASSWORD })
      .expect(401)
      .expect({
        code: IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
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
    const body = response.body as ResetUserPasswordResponseDto
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
        code: USER_ADMINISTRATION_ERROR_CODES.INVALID_RESET_PASSWORD_REQUEST,
        message: 'Invalid user password reset request',
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
        code: USER_ADMINISTRATION_ERROR_CODES.INVALID_RESET_PASSWORD_REQUEST,
        message: 'Invalid user password reset request',
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
        code: USER_ADMINISTRATION_ERROR_CODES.USER_NOT_FOUND,
        message: 'User target was not found',
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
        code: IDENTITY_ERROR_CODES.INSUFFICIENT_ROLE,
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
    const targetAuth = await signInWithCookie('student1@morshid.demo')
    const targetSession = targetAuth.session
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
    const body = response.body as DisableUserResponseDto
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
        code: IDENTITY_ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      })
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', targetAuth.refreshCookie)
      .expect(401)
      .expect({
        code: IDENTITY_ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token',
      })
    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email: target.email, password: P0_DEMO_PASSWORD })
      .expect(403)
      .expect({
        code: IDENTITY_ERROR_CODES.ACCOUNT_DISABLED,
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
        code: USER_ADMINISTRATION_ERROR_CODES.USER_NOT_FOUND,
        message: 'User target was not found',
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
        code: USER_ADMINISTRATION_ERROR_CODES.CANNOT_DISABLE_SELF,
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
        code: IDENTITY_ERROR_CODES.INSUFFICIENT_ROLE,
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
    const body = response.body as ReactivateUserResponseDto
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
    const body = response.body as ReactivateUserResponseDto

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
        code: USER_ADMINISTRATION_ERROR_CODES.USER_NOT_FOUND,
        message: 'User target was not found',
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
        code: IDENTITY_ERROR_CODES.INSUFFICIENT_ROLE,
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
    const body = response.body as ManagedUserListResponseDto

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
    const firstPage = firstPageResponse.body as ManagedUserListResponseDto

    expect(firstPage.users).toHaveLength(1)
    expect(firstPage.nextCursor).toEqual(expect.any(String))

    const secondPageResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/users?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor ?? '')}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    const secondPage = secondPageResponse.body as ManagedUserListResponseDto

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
      code: IDENTITY_ERROR_CODES.INSUFFICIENT_ROLE,
      message: 'Insufficient role',
    })
  })
})
