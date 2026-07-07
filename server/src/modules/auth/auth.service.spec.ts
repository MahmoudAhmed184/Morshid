import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import { hash } from 'bcrypt'

import type { User } from '../../generated/prisma/client'
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
    create: jest.Mock<Promise<void>, [RefreshTokenCreateArgs]>
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

interface AuthServiceTestContext {
  auditService: {
    recordEvent: jest.Mock
  }
  configService: {
    get: jest.Mock
  }
  jwtService: {
    signAsync: jest.Mock
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
  const prismaService: PrismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    refreshToken: {
      create: createRefreshToken,
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
        status: user.status,
      },
      requestContext,
    })
  })
})
