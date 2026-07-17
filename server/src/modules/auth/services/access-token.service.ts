import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import type { User } from '../../../generated/prisma/client'
import type { AppEnvironment } from '../../config/env.schema'
import { invalidAccessTokenException } from '../auth.errors'

@Injectable()
export class AccessTokenService {
  private readonly accessTokenSecret: string
  private readonly accessTokenTtlSeconds: number

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService<AppEnvironment, true>,
  ) {
    this.accessTokenSecret = configService.get('AUTH_ACCESS_TOKEN_SECRET', {
      infer: true,
    })
    this.accessTokenTtlSeconds = configService.get(
      'AUTH_ACCESS_TOKEN_TTL_SECONDS',
      {
        infer: true,
      },
    )
  }

  async create(user: Pick<User, 'id' | 'passwordChangedAt'>, now: Date) {
    const expiresAt = addSeconds(now, this.accessTokenTtlSeconds)
    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        typ: 'access',
        pwd: user.passwordChangedAt.toISOString(),
      } satisfies SignedAccessTokenPayload,
      {
        expiresIn: this.accessTokenTtlSeconds,
        secret: this.accessTokenSecret,
      },
    )

    return {
      expiresAt,
      token,
    }
  }

  async verify(token: string): Promise<VerifiedAccessTokenPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<UntrustedAccessTokenPayload>(token, {
          secret: this.accessTokenSecret,
        })

      if (
        payload.typ !== 'access' ||
        typeof payload.sub !== 'string' ||
        typeof payload.pwd !== 'string'
      ) {
        throw invalidAccessTokenException()
      }

      return {
        sub: payload.sub,
        typ: 'access',
        passwordChangedAt: payload.pwd,
      }
    } catch {
      throw invalidAccessTokenException()
    }
  }
}

interface VerifiedAccessTokenPayload {
  sub: string
  typ: 'access'
  passwordChangedAt: string
}

interface SignedAccessTokenPayload {
  sub: string
  typ: 'access'
  pwd: string
}

interface UntrustedAccessTokenPayload {
  sub?: unknown
  typ?: unknown
  pwd?: unknown
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000)
}
