import { createHash, randomUUID } from 'node:crypto'
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { JwtSignOptions } from '@nestjs/jwt'

import type {
  CourseMembershipRole,
  RefreshToken,
  User,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../audit/audit.constants'
import type { AuditRequestContext } from '../audit/audit.service'
import { AuditService } from '../audit/audit.service'
import type { AppEnvironment } from '../config/env.schema'
import { PrismaService } from '../prisma/prisma.service'
import { AUTH_TOKEN_TYPES } from './auth.constants'
import type {
  AuthProfileDto,
  AuthResponseDto,
  AuthUserDto,
} from './dto/auth-response.dto'
import type { LoginDto } from './dto/login.dto'
import { verifyPassword } from './utils/password.util'

export type AuthRequestContext = AuditRequestContext

export interface LoginResult extends AuthResponseDto {
  refreshToken: string
  refreshTokenExpiresAt: Date
}

export interface AuthenticatedUser extends AuthUserDto {
  status: UserStatus
}

export interface AuthenticatedRefreshUser extends AuthenticatedUser {
  refreshTokenId: string
}

export interface AccessTokenPayload {
  sub: string
  email: string
  role: UserRole
  tokenType: typeof AUTH_TOKEN_TYPES.ACCESS
  iat?: number
}

export interface RefreshTokenPayload {
  sub: string
  tokenId: string
  tokenType: typeof AUTH_TOKEN_TYPES.REFRESH
  iat?: number
}

type UserWithMemberships = Pick<
  User,
  'id' | 'email' | 'displayName' | 'role' | 'status'
> & {
  memberships: {
    role: CourseMembershipRole
    course: {
      id: string
      code: string
      title: string
    }
  }[]
}

@Injectable()
export class AuthService {
  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService<AppEnvironment, true>,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}
  // `=================== de el login function ===================`
  async login(
    dto: LoginDto,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult> {
    const user = await this.prismaService.user.findUnique({
      where: { email: dto.email },
    })

    const passwordMatches = user
      ? await verifyPassword(dto.password, user.passwordHash)
      : false

    if (!user || !passwordMatches) {
      await this.recordFailedLogin(
        dto.email,
        'invalid_credentials',
        requestContext,
      )
      throw new UnauthorizedException('Invalid email or password')
    }

    if (user.status !== 'ACTIVE') {
      await this.auditService.recordEvent({
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
      throw new ForbiddenException('Account is disabled')
    }

    const now = new Date()
    const refreshTokenId = randomUUID()
    const refreshTokenExpiresAt = this.createRefreshTokenExpiration(now)
    const accessToken = await this.signAccessToken(user)
    const refreshToken = await this.signRefreshToken(user, refreshTokenId)

    await this.prismaService.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          id: refreshTokenId,
          userId: user.id,
          tokenHash: hashRefreshToken(refreshToken),
          expiresAt: refreshTokenExpiresAt,
          ip: requestContext.ip ?? null,
          userAgent: requestContext.userAgent ?? null,
        },
      })
      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastLoginAt: now,
        },
      })
    })

    await this.auditService.recordEvent({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: refreshTokenId,
      },
      metadata: {
        email: user.email,
      },
      requestContext,
    })

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      user: toAuthUserDto(user),
    }
  }

  // `=================== de el refreshSession function ===================`
  async refreshSession(
    refreshToken: string | null | undefined,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult> {
    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      throw new UnauthorizedException('No refresh token provided')
    }

    let payload: RefreshTokenPayload

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
        },
      )
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const user = await this.validateRefreshTokenPayload(
      payload,
      refreshToken,
      requestContext,
    )

    return this.refresh(user.id, user.refreshTokenId, requestContext)
  }

  // `=================== de el refresh function ===================`
  async refresh(
    userId: string,
    refreshTokenId: string,
    requestContext: AuthRequestContext = {},
  ): Promise<LoginResult> {
    const now = new Date()
    const currentRefreshToken =
      await this.prismaService.refreshToken.findUnique({
        where: { id: refreshTokenId },
      })

    if (!currentRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    if (
      currentRefreshToken.userId !== userId ||
      currentRefreshToken.revokedAt !== null ||
      currentRefreshToken.expiresAt.getTime() <= now.getTime()
    ) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    })

    if (user === null) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    await this.assertUserIsActive(user, 'refresh_token', requestContext)

    const newRefreshTokenId = randomUUID()
    const refreshTokenExpiresAt = this.createRefreshTokenExpiration(now)
    const accessToken = await this.signAccessToken(user)
    const refreshToken = await this.signRefreshToken(user, newRefreshTokenId)

    await this.prismaService.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          id: newRefreshTokenId,
          userId: user.id,
          tokenHash: hashRefreshToken(refreshToken),
          expiresAt: refreshTokenExpiresAt,
          ip: requestContext.ip ?? null,
          userAgent: requestContext.userAgent ?? null,
        },
      })
      await tx.refreshToken.update({
        where: { id: currentRefreshToken.id },
        data: { revokedAt: now, replacedByTokenId: newRefreshTokenId },
      })
    })

    await this.auditService.recordEvent({
      actorUserId: user.id,
      action: AUDIT_EVENT_ACTIONS.AUTH_REFRESH_TOKEN_ROTATED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: newRefreshTokenId,
      },
      metadata: {
        email: user.email,
        previousRefreshTokenId: currentRefreshToken.id,
      },
      requestContext,
    })

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      user: toAuthUserDto(user),
    }
  }

  async logoutSession(
    refreshToken: string | null | undefined,
    requestContext: AuthRequestContext = {},
  ): Promise<void> {
    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      return
    }

    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
        },
      )

      await this.logout(payload.sub, refreshToken, requestContext)
    } catch {
      return
    }
  }

  // `=================== de el logout function ===================`
  async logout(
    userId: string,
    refreshToken: string | null | undefined,
    requestContext: AuthRequestContext = {},
  ): Promise<void> {
    let revokedRefreshTokenId: string | undefined

    if (typeof refreshToken === 'string' && refreshToken.trim().length > 0) {
      const storedRefreshToken =
        await this.prismaService.refreshToken.findUnique({
          where: {
            tokenHash: hashRefreshToken(refreshToken),
          },
        })

      if (
        storedRefreshToken !== null &&
        storedRefreshToken.userId === userId &&
        storedRefreshToken.revokedAt === null
      ) {
        revokedRefreshTokenId = storedRefreshToken.id
        await this.prismaService.refreshToken.update({
          where: {
            id: storedRefreshToken.id,
          },
          data: {
            revokedAt: new Date(),
          },
        })
      }
    }

    await this.auditService.recordEvent({
      actorUserId: userId,
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGOUT,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
        id: revokedRefreshTokenId,
      },
      requestContext,
    })
  }

  // `=================== de el getMe function ===================`
  async getMe(
    userId: string,
    requestContext: AuthRequestContext = {},
  ): Promise<AuthProfileDto> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        memberships: {
          select: {
            role: true,
            course: {
              select: {
                id: true,
                code: true,
                title: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (user === null) {
      throw new UnauthorizedException('Invalid access token')
    }

    await this.assertUserIsActive(user, 'get_me', requestContext)

    return toAuthProfileDto(user)
  }

  // `=================== de el validateAccessTokenPayload function ===================`

  async validateAccessTokenPayload(
    payload: AccessTokenPayload,
    requestContext: AuthRequestContext = {},
  ): Promise<AuthenticatedUser> {
    if (payload.sub.length === 0 || payload.iat === undefined) {
      throw new UnauthorizedException('Invalid access token')
    }

    const user = await this.prismaService.user.findUnique({
      where: {
        id: payload.sub,
      },
    })

    if (user === null) {
      throw new UnauthorizedException('Invalid access token')
    }

    await this.assertUserIsActive(user, 'access_token', requestContext)
    this.assertTokenIssuedAfterPasswordChange(
      user.passwordChangedAt,
      payload.iat,
      'access token',
    )

    return toAuthenticatedUser(user)
  }

  // `=================== de el validateRefreshTokenPayload function ===================`

  async validateRefreshTokenPayload(
    payload: RefreshTokenPayload,
    refreshToken: string,
    requestContext: AuthRequestContext = {},
  ): Promise<AuthenticatedRefreshUser> {
    if (
      payload.sub.length === 0 ||
      payload.tokenId.length === 0 ||
      payload.iat === undefined
    ) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const storedRefreshToken = await this.prismaService.refreshToken.findUnique(
      {
        where: {
          id: payload.tokenId,
        },
        include: {
          user: true,
        },
      },
    )

    if (!storedRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    if (
      storedRefreshToken.userId !== payload.sub ||
      storedRefreshToken.tokenHash !== hashRefreshToken(refreshToken)
    ) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    if (storedRefreshToken.revokedAt !== null) {
      await this.revokeRefreshTokenChain(storedRefreshToken.id, new Date())
      throw new UnauthorizedException('Invalid refresh token')
    }

    if (storedRefreshToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    await this.assertUserIsActive(
      storedRefreshToken.user,
      'refresh_token',
      requestContext,
    )
    this.assertTokenIssuedAfterPasswordChange(
      storedRefreshToken.user.passwordChangedAt,
      payload.iat,
      'refresh token',
    )

    return {
      ...toAuthenticatedUser(storedRefreshToken.user),
      refreshTokenId: storedRefreshToken.id,
    }
  }

  // `=================== de el signAccessToken function ===================`

  private async signAccessToken(user: User): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenType: AUTH_TOKEN_TYPES.ACCESS,
    }

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION', {
        infer: true,
      }),
    })
  }

  // `=================== de el signRefreshToken function ===================`

  private async signRefreshToken(user: User, tokenId: string): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: user.id,
      tokenId,
      tokenType: AUTH_TOKEN_TYPES.REFRESH,
    }

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: this.getRefreshTokenExpiresIn(),
    })
  }

  // `=================== de el createRefreshTokenExpiration function ===================`

  private createRefreshTokenExpiration(now: Date): Date {
    const refreshExpirationDays = this.configService.get(
      'JWT_REFRESH_EXPIRATION_DAYS',
      { infer: true },
    )

    return new Date(now.getTime() + refreshExpirationDays * 24 * 60 * 60 * 1000)
  }

  // `=================== de el getRefreshTokenExpiresIn function ===================`
  private getRefreshTokenExpiresIn(): JwtSignOptions['expiresIn'] {
    return `${this.configService
      .get('JWT_REFRESH_EXPIRATION_DAYS', {
        infer: true,
      })
      .toString()}d` as JwtSignOptions['expiresIn']
  }

  private async recordFailedLogin(
    email: string,
    reason: string,
    requestContext: AuthRequestContext,
  ): Promise<void> {
    await this.auditService.recordEvent({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
      },
      metadata: {
        email,
        reason,
      },
      requestContext,
    })
  }

  // `=================== de el assertTokenIssuedAfterPasswordChange function ===================`
  private assertTokenIssuedAfterPasswordChange(
    passwordChangedAt: Date,
    issuedAt: number,
    tokenLabel: string,
  ): void {
    if (passwordChangedAt.getTime() > issuedAt * 1000) {
      throw new UnauthorizedException(`The ${tokenLabel} is no longer valid`)
    }
  }

  // `=================== de el assertUserIsActive function ===================`
  private async assertUserIsActive(
    user: Pick<User, 'id' | 'email' | 'status'>,
    reason: string,
    requestContext: AuthRequestContext,
  ): Promise<void> {
    if (user.status === 'ACTIVE') {
      return
    }

    await this.auditService.recordEvent({
      actorUserId: user.id,
      action:
        reason === 'login'
          ? AUDIT_EVENT_ACTIONS.AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT
          : AUDIT_EVENT_ACTIONS.AUTH_DISABLED_ACCESS_ATTEMPT,
      target: {
        type: AUDIT_TARGET_TYPES.USER,
        id: user.id,
      },
      metadata: {
        email: user.email,
        reason,
        status: user.status,
      },
      requestContext,
    })
    throw new ForbiddenException('Account is disabled')
  }

  // `=================== de el revokeRefreshTokenChain function ===================`
  private async revokeRefreshTokenChain(
    refreshTokenId: string,
    revokedAt: Date,
  ): Promise<void> {
    let currentRefreshTokenId: string | null = refreshTokenId

    while (currentRefreshTokenId !== null) {
      const currentRefreshToken: RefreshToken | null =
        await this.prismaService.refreshToken.findUnique({
          where: {
            id: currentRefreshTokenId,
          },
        })

      if (currentRefreshToken === null) {
        return
      }

      if (currentRefreshToken.revokedAt === null) {
        await this.prismaService.refreshToken.update({
          where: {
            id: currentRefreshToken.id,
          },
          data: {
            revokedAt,
          },
        })
      }

      currentRefreshTokenId = currentRefreshToken.replacedByTokenId
    }
  }
}

// `=================== de el hashRefreshToken function ===================`

export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex')
}

function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    ...toAuthUserDto(user),
    status: user.status,
  }
}

function toAuthUserDto(user: User): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  }
}

function toAuthProfileDto(user: UserWithMemberships): AuthProfileDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    assignedCourses: user.memberships.map((membership) => ({
      id: membership.course.id,
      code: membership.course.code,
      title: membership.course.title,
      membershipRole: membership.role,
    })),
  }
}
