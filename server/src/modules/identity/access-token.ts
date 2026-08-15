import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import type { AppEnvironment } from '../../platform/config/env.schema'
import { invalidAccessTokenException } from './identity.errors'
import type { IdentityUserRecord } from './identity.types'

@Injectable()
export class AccessToken {
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

  async create(
    user: Pick<IdentityUserRecord, 'id' | 'passwordChangedAt'>,
    familyId: string,
    now: Date,
  ) {
    const expiresAt = addSeconds(now, this.accessTokenTtlSeconds)
    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        typ: 'access',
        pwd: user.passwordChangedAt.toISOString(),
        sid: familyId,
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
        typeof payload.pwd !== 'string' ||
        typeof payload.sid !== 'string'
      ) {
        throw invalidAccessTokenException()
      }

      return {
        sub: payload.sub,
        typ: 'access',
        passwordChangedAt: payload.pwd,
        sessionId: payload.sid,
      }
    } catch {
      throw invalidAccessTokenException()
    }
  }
}

export interface VerifiedAccessTokenPayload {
  sub: string
  typ: 'access'
  passwordChangedAt: string
  sessionId: string
}

interface SignedAccessTokenPayload {
  sub: string
  typ: 'access'
  pwd: string
  sid: string
}

interface UntrustedAccessTokenPayload {
  sub?: unknown
  typ?: unknown
  pwd?: unknown
  sid?: unknown
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000)
}
