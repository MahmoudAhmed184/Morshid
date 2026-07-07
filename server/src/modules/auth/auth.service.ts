import { createHash, randomUUID } from 'node:crypto'

import {ForbiddenException,Injectable,UnauthorizedException,} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { JwtSignOptions } from '@nestjs/jwt'

import type { User, UserRole } from '../../generated/prisma/client'
import { AUDIT_EVENT_ACTIONS,AUDIT_TARGET_TYPES, } from '../audit/audit.constants'
import type { AuditRequestContext } from '../audit/audit.service'
import { AuditService } from '../audit/audit.service'
import type { AppEnvironment } from '../config/env.schema'
import { PrismaService } from '../prisma/prisma.service'
import { AUTH_TOKEN_TYPES } from './auth.constants'
import type { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto'
import type { LoginDto } from './dto/login.dto'
import { verifyPassword } from './utils/password.util'

export type AuthRequestContext = AuditRequestContext

export interface LoginResult extends AuthResponseDto {
  refreshToken: string
  refreshTokenExpiresAt: Date
}

interface AccessTokenPayload {
  sub: string
  email: string
  role: UserRole
  tokenType: typeof AUTH_TOKEN_TYPES.ACCESS
}

interface RefreshTokenPayload {
  sub: string
  tokenId: string
  tokenType: typeof AUTH_TOKEN_TYPES.REFRESH
}

@Injectable()
export class AuthService {
  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService<AppEnvironment, true>,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  async login( dto: LoginDto, requestContext: AuthRequestContext = {},): Promise<LoginResult> {
    const user = await this.prismaService.user.findUnique({where: { email: dto.email},})

    if (user === null) {
      await this.recordFailedLogin(dto.email,'invalid_credentials',requestContext,)
      throw new UnauthorizedException('Account with this email does not exist')
    }

    const passwordMatches = await verifyPassword(dto.password,user.passwordHash,)

    if (!passwordMatches) {
      await this.recordFailedLogin(dto.email,'invalid_credentials',requestContext,)
      throw new UnauthorizedException('Invalid email or password')
    }

    if (user.status !== 'ACTIVE') {
      await this.auditService.recordEvent({ actorUserId: user.id,
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

  private createRefreshTokenExpiration(now: Date): Date {
    const refreshExpirationDays = this.configService.get(
      'JWT_REFRESH_EXPIRATION_DAYS',
      { infer: true },
    )

    return new Date(now.getTime() + refreshExpirationDays * 24 * 60 * 60 * 1000)
  }

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
}

export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex')
}

function toAuthUserDto(user: User): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  }
}
