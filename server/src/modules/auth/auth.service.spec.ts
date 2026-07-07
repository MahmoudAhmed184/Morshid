import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import { hash } from 'bcrypt'

import type {
  CourseMembershipRole,
  RefreshToken,
  User,
} from '../../generated/prisma/client'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../audit/audit.constants'
import { AuditService } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import { AUTH_TOKEN_TYPES } from './auth.constants'
import { AuthService, hashRefreshToken } from './auth.service'

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}))

interface PrismaMock {
  user: {
    findUnique: jest.Mock
    update: jest.Mock
  }
  refreshToken: {
    findUnique: jest.Mock
    create: jest.Mock<Promise<void>, [RefreshTokenCreateArgs]>
    update: jest.Mock
  }
  $transaction: jest.Mock
}

interface RefreshTokenCreateArgs {
  data: {
    id: string
    userId: string
    tokenHash: string
    expiresAt: Date
    ip: string | null
    userAgent: string | null
  }
}

interface RefreshTokenUpdateArgs {
  where: {
    id: string
  }
  data: {
    revokedAt?: Date
    replacedByTokenId?: string
  }
}

interface AuthServiceTestContext {
  auditService: {
    recordEvent: jest.Mock
  }
  configService: {
    get: jest.Mock
  }
  jwtService: {
    signAsync: jest.Mock
    verifyAsync: jest.Mock
  }
  prismaService: PrismaMock
  service: AuthService
}

const requestContext = {
  ip: '203.0.113.10',
  userAgent: 'Mozilla/5.0',
}

async function buildTestContext(): Promise<AuthServiceTestContext> {
  const createRefreshToken = jest.fn(
    (_args: RefreshTokenCreateArgs): Promise<void> => Promise.resolve(),
  )
  const updateRefreshToken = jest.fn(
    (_args: RefreshTokenUpdateArgs): Promise<void> => Promise.resolve(),
  )
  const prismaService: PrismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: createRefreshToken,
      update: updateRefreshToken,
    },
    $transaction: jest.fn(async (callback: (tx: PrismaMock) => Promise<void>) =>
      callback(prismaService),
    ),
  }
  const auditService = {
    recordEvent: jest.fn().mockResolvedValue(undefined),
  }
  const configValues = {
    JWT_ACCESS_SECRET: 'access-secret-at-least-32-characters',
    JWT_REFRESH_SECRET: 'refresh-secret-at-least-32-characters',
    JWT_ACCESS_EXPIRATION: '3d',
    JWT_REFRESH_EXPIRATION_DAYS: 14,
  }
  const configService = {
    get: jest.fn((key: keyof typeof configValues) => configValues[key]),
  }
  const jwtService = {
    signAsync: jest.fn((payload: { tokenType: string }) => {
      if (payload.tokenType === AUTH_TOKEN_TYPES.ACCESS) {
        return Promise.resolve('access-token')
      }

      return Promise.resolve('refresh-token')
    }),
    verifyAsync: jest.fn(),
  }
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      {
        provide: AuditService,
        useValue: auditService,
      },
      {
        provide: ConfigService,
        useValue: configService,
      },
      {
        provide: JwtService,
        useValue: jwtService,
      },
      {
        provide: PrismaService,
        useValue: prismaService,
      },
    ],
  }).compile()

  return {
    auditService,
    configService,
    jwtService,
    prismaService,
    service: moduleRef.get(AuthService),
  }
}

async function buildUser(overrides: Partial<User> = {}): Promise<User> {
  const now = new Date('2026-07-07T00:00:00.000Z')

  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@morshid.demo',
    displayName: 'P0 Demo Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    passwordHash: await hash('MorshidDemoP0!', 4),
    disabledAt: null,
    disabledById: null,
    lastLoginAt: null,
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('AuthService', () => {
  it('logs in an active user and stores only the refresh token hash', async () => {
    const { auditService, jwtService, prismaService, service } =
      await buildTestContext()
    const user = await buildUser()
    prismaService.user.findUnique.mockResolvedValue(user)

    const result = await service.login(
      {
        email: 'admin@morshid.demo',
        password: 'MorshidDemoP0!',
      },
      requestContext,
    )

    expect(result).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    })
    expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date)
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tokenType: AUTH_TOKEN_TYPES.ACCESS,
      },
      {
        secret: 'access-secret-at-least-32-characters',
        expiresIn: '3d',
      },
    )
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: user.id,
        tokenType: AUTH_TOKEN_TYPES.REFRESH,
      }),
      {
        secret: 'refresh-secret-at-least-32-characters',
        expiresIn: '14d',
      },
    )
    expect(prismaService.refreshToken.create).toHaveBeenCalledTimes(1)
    const refreshTokenCreateArgs =
      prismaService.refreshToken.create.mock.calls[0][0]

    expect(refreshTokenCreateArgs.data).toMatchObject({
      userId: user.id,
      tokenHash: hashRefreshToken('refresh-token'),
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
    })
    expect(refreshTokenCreateArgs.data).not.toHaveProperty('refreshToken')
    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: expect.any(Date) as Date,
      },
    })
    expect(auditService.recordEvent).toHaveBeenCalledWith({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: expect.any(String) as string,
      },
      metadata: {
        email: user.email,
      },
      requestContext,
    })
  })

  it('rejects invalid credentials without issuing tokens', async () => {
    const { auditService, jwtService, prismaService, service } =
      await buildTestContext()
    prismaService.user.findUnique.mockResolvedValue(null)

    await expect(
      service.login(
        {
          email: 'missing@morshid.demo',
          password: 'wrong',
        },
        requestContext,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(jwtService.signAsync).not.toHaveBeenCalled()
    expect(prismaService.refreshToken.create).not.toHaveBeenCalled()
    expect(auditService.recordEvent).toHaveBeenCalledWith({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
      },
      metadata: {
        email: 'missing@morshid.demo',
        reason: 'invalid_credentials',
      },
      requestContext,
    })
  })

  it('rejects disabled users and audits the blocked attempt', async () => {
    const { auditService, jwtService, prismaService, service } =
      await buildTestContext()
    const user = await buildUser({
      status: 'DISABLED',
      disabledAt: new Date('2026-07-07T00:00:00.000Z'),
    })
    prismaService.user.findUnique.mockResolvedValue(user)

    await expect(
      service.login(
        {
          email: user.email,
          password: 'MorshidDemoP0!',
        },
        requestContext,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(jwtService.signAsync).not.toHaveBeenCalled()
    expect(prismaService.refreshToken.create).not.toHaveBeenCalled()
    expect(auditService.recordEvent).toHaveBeenCalledWith({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT,
      target: {
        type: AUDIT_TARGET_TYPES.USER,
        id: user.id,
      },
      metadata: {
        email: user.email,
        reason: 'login',
        status: user.status,
      },
      requestContext,
    })
  })

  it('rotates refresh tokens for an active user', async () => {
    const { auditService, jwtService, prismaService, service } =
      await buildTestContext()
    const user = await buildUser()
    const refreshTokenRecord = buildRefreshToken({ userId: user.id })
    prismaService.refreshToken.findUnique.mockResolvedValue(refreshTokenRecord)
    prismaService.user.findUnique.mockResolvedValue(user)

    const result = await service.refresh(
      user.id,
      refreshTokenRecord.id,
      requestContext,
    )

    expect(result).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: user.id,
        email: user.email,
      },
    })
    expect(jwtService.signAsync).toHaveBeenCalledTimes(2)
    expect(prismaService.refreshToken.update).toHaveBeenCalledWith({
      where: {
        id: refreshTokenRecord.id,
      },
      data: {
        revokedAt: expect.any(Date) as Date,
        replacedByTokenId: expect.any(String) as string,
      },
    })
    expect(prismaService.refreshToken.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String) as string,
        userId: user.id,
        tokenHash: hashRefreshToken('refresh-token'),
        expiresAt: expect.any(Date) as Date,
        ip: requestContext.ip,
        userAgent: requestContext.userAgent,
      },
    })
    expect(auditService.recordEvent).toHaveBeenCalledWith({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_REFRESH_TOKEN_ROTATED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: expect.any(String) as string,
      },
      metadata: {
        email: user.email,
        previousRefreshTokenId: refreshTokenRecord.id,
      },
      requestContext,
    })
  })

  it('logs out a session from a refresh token string', async () => {
    const { auditService, jwtService, prismaService, service } =
      await buildTestContext()
    const user = await buildUser()
    const refreshTokenRecord = buildRefreshToken({
      userId: user.id,
      tokenHash: hashRefreshToken('refresh-token'),
    })
    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      tokenId: refreshTokenRecord.id,
      tokenType: AUTH_TOKEN_TYPES.REFRESH,
    })
    prismaService.refreshToken.findUnique.mockResolvedValue(refreshTokenRecord)

    await service.logoutSession('refresh-token', requestContext)

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('refresh-token', {
      secret: 'refresh-secret-at-least-32-characters',
    })
    expect(prismaService.refreshToken.update).toHaveBeenCalledWith({
      where: {
        id: refreshTokenRecord.id,
      },
      data: {
        revokedAt: expect.any(Date) as Date,
      },
    })
    expect(auditService.recordEvent).toHaveBeenCalledWith({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGOUT,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: refreshTokenRecord.id,
      },
      requestContext,
    })
  })

  it('revokes the refresh token hash on logout when it belongs to the user', async () => {
    const { auditService, prismaService, service } = await buildTestContext()
    const user = await buildUser()
    const refreshTokenRecord = buildRefreshToken({
      userId: user.id,
      tokenHash: hashRefreshToken('refresh-token'),
    })
    prismaService.refreshToken.findUnique.mockResolvedValue(refreshTokenRecord)

    await service.logout(user.id, 'refresh-token', requestContext)

    expect(prismaService.refreshToken.update).toHaveBeenCalledWith({
      where: {
        id: refreshTokenRecord.id,
      },
      data: {
        revokedAt: expect.any(Date) as Date,
      },
    })
    expect(auditService.recordEvent).toHaveBeenCalledWith({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGOUT,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: refreshTokenRecord.id,
      },
      requestContext,
    })
  })

  it('returns the current user profile with assigned courses', async () => {
    const { prismaService, service } = await buildTestContext()
    const user = await buildUser()
    prismaService.user.findUnique.mockResolvedValue({
      ...user,
      memberships: [
        {
          id: 'membership-1',
          courseId: 'course-1',
          userId: user.id,
          role: 'INSTRUCTOR' satisfies CourseMembershipRole,
          createdById: user.id,
          createdAt: new Date('2026-07-07T00:00:00.000Z'),
          course: {
            id: 'course-1',
            code: 'PY101',
            title: 'Python Programming',
          },
        },
      ],
    })

    await expect(service.getMe(user.id, requestContext)).resolves.toEqual({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      assignedCourses: [
        {
          id: 'course-1',
          code: 'PY101',
          title: 'Python Programming',
          membershipRole: 'INSTRUCTOR',
        },
      ],
    })
  })

  it('validates access token payloads against the current user state', async () => {
    const { prismaService, service } = await buildTestContext()
    const user = await buildUser()
    prismaService.user.findUnique.mockResolvedValue(user)

    await expect(
      service.validateAccessTokenPayload(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          tokenType: AUTH_TOKEN_TYPES.ACCESS,
          iat: Math.floor(user.passwordChangedAt.getTime() / 1000),
        },
        requestContext,
      ),
    ).resolves.toEqual({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    })
  })

  it('rejects access tokens issued before the last password change', async () => {
    const { prismaService, service } = await buildTestContext()
    const user = await buildUser({
      passwordChangedAt: new Date('2026-07-07T12:00:00.000Z'),
    })
    prismaService.user.findUnique.mockResolvedValue(user)

    await expect(
      service.validateAccessTokenPayload(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          tokenType: AUTH_TOKEN_TYPES.ACCESS,
          iat: Math.floor(
            new Date('2026-07-07T11:00:00.000Z').getTime() / 1000,
          ),
        },
        requestContext,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('validates active refresh token payloads', async () => {
    const { prismaService, service } = await buildTestContext()
    const user = await buildUser()
    const refreshToken = 'refresh-token'
    prismaService.refreshToken.findUnique.mockResolvedValue({
      ...buildRefreshToken({
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
      }),
      user,
    })

    await expect(
      service.validateRefreshTokenPayload(
        {
          sub: user.id,
          tokenId: 'refresh-token-id',
          tokenType: AUTH_TOKEN_TYPES.REFRESH,
          iat: Math.floor(user.passwordChangedAt.getTime() / 1000),
        },
        refreshToken,
        requestContext,
      ),
    ).resolves.toEqual({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      refreshTokenId: 'refresh-token-id',
    })
  })

  it('audits disabled token access attempts outside the login flow', async () => {
    const { auditService, prismaService, service } = await buildTestContext()
    const user = await buildUser({
      status: 'DISABLED',
      disabledAt: new Date('2026-07-07T00:00:00.000Z'),
    })
    prismaService.user.findUnique.mockResolvedValue(user)

    await expect(
      service.validateAccessTokenPayload(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          tokenType: AUTH_TOKEN_TYPES.ACCESS,
          iat: Math.floor(user.passwordChangedAt.getTime() / 1000),
        },
        requestContext,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(auditService.recordEvent).toHaveBeenCalledWith({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_DISABLED_ACCESS_ATTEMPT,
      target: {
        type: AUDIT_TARGET_TYPES.USER,
        id: user.id,
      },
      metadata: {
        email: user.email,
        reason: 'access_token',
        status: user.status,
      },
      requestContext,
    })
  })
})

function buildRefreshToken(
  overrides: Partial<RefreshToken> = {},
): RefreshToken {
  return {
    id: 'refresh-token-id',
    userId: '00000000-0000-0000-0000-000000000001',
    tokenHash: 'stored-token-hash',
    expiresAt: new Date('2026-07-21T00:00:00.000Z'),
    revokedAt: null,
    replacedByTokenId: null,
    ip: '203.0.113.10',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date('2026-07-07T00:00:00.000Z'),
    ...overrides,
  }
}
