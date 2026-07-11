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

  async create(user: Pick<User, 'id'>, now: Date) {
    const expiresAt = addSeconds(now, this.accessTokenTtlSeconds)
    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        typ: 'access',
      } satisfies VerifiedAccessTokenPayload,
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

      if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
        throw invalidAccessTokenException()
      }

      return {
        sub: payload.sub,
        typ: 'access',
      }
    } catch {
      throw invalidAccessTokenException()
    }
  }
}

interface VerifiedAccessTokenPayload {
  sub: string
  typ: 'access'
}

interface UntrustedAccessTokenPayload {
  sub?: unknown
  typ?: unknown
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000)
}
