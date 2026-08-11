import { createHmac, randomBytes } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../../platform/config/env.schema'
import type {
  IdentityRequestContext,
  IdentityUserRecord,
  RefreshTokenRecord,
} from './identity.types'
import { invalidRefreshTokenException } from './identity.errors'
import {
  RefreshSessionRepository,
  type RefreshTokenRecordStore,
  type RefreshTokenWithUser,
} from './refresh-session.repository'
import { IdentityUser } from './identity-user'

@Injectable()
export class RefreshSession {
  private readonly refreshTokenHashSecret: string
  private readonly refreshTokenTtlDays: number

  constructor(
    configService: ConfigService<AppEnvironment, true>,
    private readonly refreshTokenRepository: RefreshSessionRepository,
    private readonly identityUser: IdentityUser,
  ) {
    this.refreshTokenHashSecret = configService.get(
      'AUTH_REFRESH_TOKEN_HASH_SECRET',
      {
        infer: true,
      },
    )
    this.refreshTokenTtlDays = configService.get(
      'AUTH_REFRESH_TOKEN_TTL_DAYS',
      {
        infer: true,
      },
    )
  }

  create(
    user: Pick<IdentityUserRecord, 'id'>,
    now: Date,
    requestContext: IdentityRequestContext,
  ): Promise<CreatedRefreshToken> {
    return this.createWithRepository(
      this.refreshTokenRepository,
      user,
      now,
      requestContext,
    )
  }

  async rotate(
    refreshToken: string,
    now: Date,
    requestContext: IdentityRequestContext,
  ): Promise<RefreshTokenRotation> {
    const refreshTokenHash = this.hash(refreshToken)
    const result = await this.refreshTokenRepository.transaction(
      async (repository) => {
        const storedToken =
          await repository.findByTokenHashWithUser(refreshTokenHash)

        if (!storedToken || !isActiveRefreshToken(storedToken, now)) {
          throw invalidRefreshTokenException()
        }

        const revokeResult = await repository.revokeActiveByIdAndHash(
          storedToken.id,
          refreshTokenHash,
          now,
        )

        if (revokeResult.count !== 1) {
          throw invalidRefreshTokenException()
        }

        if (this.identityUser.isDisabled(storedToken.user)) {
          return {
            kind: 'disabled' as const,
            userId: storedToken.user.id,
          }
        }

        const nextRefreshToken = await this.createWithRepository(
          repository,
          storedToken.user,
          now,
          requestContext,
        )

        await repository.markReplaced(
          storedToken.id,
          nextRefreshToken.record.id,
        )

        return {
          kind: 'rotated' as const,
          nextRefreshToken,
          previousToken: storedToken,
          user: storedToken.user,
        }
      },
    )

    return result
  }

  async revokeActive(
    refreshToken: string,
    now: Date,
  ): Promise<RefreshTokenWithUser | null> {
    const refreshTokenHash = this.hash(refreshToken)

    return this.refreshTokenRepository.transaction(async (repository) => {
      const storedToken =
        await repository.findByTokenHashWithUser(refreshTokenHash)

      if (!storedToken || !isActiveRefreshToken(storedToken, now)) {
        return null
      }

      const revokeResult = await repository.revokeActiveByIdAndHash(
        storedToken.id,
        refreshTokenHash,
        now,
      )

      if (revokeResult.count !== 1) {
        return null
      }

      return {
        ...storedToken,
        revokedAt: now,
      }
    })
  }

  private async createWithRepository(
    repository: RefreshTokenRecordStore,
    user: Pick<IdentityUserRecord, 'id'>,
    now: Date,
    requestContext: IdentityRequestContext,
  ): Promise<CreatedRefreshToken> {
    const token = randomBytes(32).toString('base64url')
    const record = await repository.create({
      userId: user.id,
      tokenHash: this.hash(token),
      expiresAt: addDays(now, this.refreshTokenTtlDays),
      ip: requestContext.ip ?? null,
      userAgent: requestContext.userAgent ?? null,
    })

    return {
      record,
      token,
    }
  }

  private hash(token: string) {
    return createHmac('sha256', this.refreshTokenHashSecret)
      .update(token)
      .digest('base64url')
  }
}

export interface CreatedRefreshToken {
  record: RefreshTokenRecord
  token: string
}

export type RefreshTokenRotation =
  | {
      kind: 'disabled'
      userId: string
    }
  | {
      kind: 'rotated'
      nextRefreshToken: CreatedRefreshToken
      previousToken: RefreshTokenRecord
      user: IdentityUserRecord
    }

function isActiveRefreshToken(refreshToken: RefreshTokenRecord, now: Date) {
  return refreshToken.revokedAt === null && refreshToken.expiresAt > now
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
