import { createHmac, randomBytes } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { RefreshToken, User } from '../../../generated/prisma/client'
import type { AppEnvironment } from '../../config/env.schema'
import type { AuthRequestContext } from '../auth.dto'
import { invalidRefreshTokenException } from '../auth.errors'
import {
  RefreshTokenRepository,
  type RefreshTokenRecordStore,
  type RefreshTokenWithUser,
} from '../repositories/refresh-token.repository'
import { AuthUserService } from './auth-user.service'

@Injectable()
export class RefreshTokenService {
  private readonly refreshTokenHashSecret: string
  private readonly refreshTokenTtlDays: number

  constructor(
    configService: ConfigService<AppEnvironment, true>,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly authUserService: AuthUserService,
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
    user: Pick<User, 'id'>,
    now: Date,
    requestContext: AuthRequestContext,
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
    requestContext: AuthRequestContext,
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

        if (this.authUserService.isDisabled(storedToken.user)) {
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
    user: Pick<User, 'id'>,
    now: Date,
    requestContext: AuthRequestContext,
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
  record: RefreshToken
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
      previousToken: RefreshToken
      user: User
    }

function isActiveRefreshToken(refreshToken: RefreshToken, now: Date) {
  return refreshToken.revokedAt === null && refreshToken.expiresAt > now
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
