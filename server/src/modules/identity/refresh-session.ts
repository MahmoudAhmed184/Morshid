import { createHmac, randomBytes, randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../../platform/config/env.schema'
import type {
  IdentityRequestContext,
  IdentityUserRecord,
  RefreshTokenRecord,
} from './identity.types'
import {
  invalidAccessTokenException,
  invalidRefreshTokenException,
} from './identity.errors'
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
    familyId?: string,
    familyCreatedAt?: Date,
  ): Promise<CreatedRefreshToken> {
    return this.createWithRepository(
      this.refreshTokenRepository,
      user,
      now,
      requestContext,
      familyId,
      familyCreatedAt,
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
        const discoveredToken =
          await repository.findByTokenHashWithUser(refreshTokenHash)

        if (!discoveredToken) {
          throw invalidRefreshTokenException()
        }

        const lockedUser = await repository.lockUserById(
          discoveredToken.user.id,
        )
        const storedToken =
          await repository.findByTokenHashWithUser(refreshTokenHash)

        if (
          !lockedUser ||
          !storedToken ||
          !isActiveRefreshToken(storedToken, lockedUser, now)
        ) {
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

        if (this.identityUser.isDisabled(lockedUser)) {
          return {
            kind: 'disabled' as const,
            userId: lockedUser.id,
          }
        }

        const nextRefreshToken = await this.createWithRepository(
          repository,
          lockedUser,
          now,
          requestContext,
          storedToken.familyId,
          storedToken.familyCreatedAt,
        )

        await repository.markReplaced(
          storedToken.id,
          nextRefreshToken.record.id,
        )

        return {
          kind: 'rotated' as const,
          nextRefreshToken,
          previousToken: storedToken,
          user: lockedUser,
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

      if (!storedToken || !isUnrevokedAndUnexpired(storedToken, now)) {
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

  async changePasswordAndRotate(
    userId: string,
    passwordHash: string,
    currentRefreshToken: string | null,
    now: Date,
    requestContext: IdentityRequestContext,
  ): Promise<PasswordChangeSessionResult> {
    const currentTokenHash =
      currentRefreshToken !== null && currentRefreshToken.length > 0
        ? this.hash(currentRefreshToken)
        : null

    return this.refreshTokenRepository.transaction(async (repository) => {
      const lockedUser = await repository.lockUserById(userId)

      if (!lockedUser) {
        throw invalidAccessTokenException()
      }

      if (this.identityUser.isDisabled(lockedUser)) {
        return {
          kind: 'disabled' as const,
          user: lockedUser,
        }
      }

      let previousToken: RefreshTokenRecord | null = null
      if (currentTokenHash !== null) {
        const storedToken =
          await repository.findByTokenHashWithUser(currentTokenHash)
        if (
          storedToken?.user.id === userId &&
          storedToken.revokedAt === null &&
          storedToken.expiresAt > now
        ) {
          previousToken = storedToken
        }
      }

      const updatedUser = await repository.updateUserPassword(
        userId,
        passwordHash,
        now,
      )

      await repository.revokeAllActiveForUser(userId, now)

      const nextRefreshToken = await this.createWithRepository(
        repository,
        updatedUser,
        now,
        requestContext,
      )

      if (previousToken) {
        await repository.markReplaced(
          previousToken.id,
          nextRefreshToken.record.id,
        )
      }

      return {
        kind: 'success' as const,
        nextRefreshToken,
        user: updatedUser,
      }
    })
  }

  async findFamilyByToken(
    refreshToken: string,
    now: Date,
  ): Promise<RefreshTokenWithUser | null> {
    const refreshTokenHash = this.hash(refreshToken)
    const token =
      await this.refreshTokenRepository.findByTokenHashWithUser(
        refreshTokenHash,
      )

    if (!token || !isActiveRefreshToken(token, token.user, now)) {
      return null
    }

    return token
  }

  async findActiveSessions(
    userId: string,
    now: Date,
  ): Promise<RefreshTokenRecord[]> {
    return this.refreshTokenRepository.findActiveSessionsByUserId(userId, now)
  }

  async findActiveSessionFamily(
    userId: string,
    familyId: string,
    now: Date,
  ): Promise<RefreshTokenRecord | null> {
    return this.refreshTokenRepository.findActiveSessionFamily(
      userId,
      familyId,
      now,
    )
  }

  async revokeFamily(
    userId: string,
    familyId: string,
    now: Date,
  ): Promise<number> {
    const result = await this.refreshTokenRepository.revokeActiveFamily(
      userId,
      familyId,
      now,
    )
    return result.count
  }

  async revokeOtherFamilies(
    userId: string,
    currentFamilyId: string,
    now: Date,
  ): Promise<number> {
    const result =
      await this.refreshTokenRepository.revokeAllOtherActiveFamilies(
        userId,
        currentFamilyId,
        now,
      )
    return result.count
  }

  hash(token: string) {
    return createHmac('sha256', this.refreshTokenHashSecret)
      .update(token)
      .digest('base64url')
  }

  private async createWithRepository(
    repository: RefreshTokenRecordStore,
    user: Pick<IdentityUserRecord, 'id'>,
    now: Date,
    requestContext: IdentityRequestContext,
    familyId?: string,
    familyCreatedAt?: Date,
  ): Promise<CreatedRefreshToken> {
    const token = randomBytes(32).toString('base64url')
    const effectiveFamilyId = familyId ?? randomUUID()
    const effectiveFamilyCreatedAt = familyCreatedAt ?? now
    const record = await repository.create({
      userId: user.id,
      familyId: effectiveFamilyId,
      familyCreatedAt: effectiveFamilyCreatedAt,
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

export type PasswordChangeSessionResult =
  | {
      kind: 'disabled'
      user: IdentityUserRecord
    }
  | {
      kind: 'success'
      nextRefreshToken: CreatedRefreshToken
      user: IdentityUserRecord
    }

function isActiveRefreshToken(
  refreshToken: RefreshTokenRecord,
  user: Pick<IdentityUserRecord, 'passwordChangedAt'>,
  now: Date,
) {
  return (
    isUnrevokedAndUnexpired(refreshToken, now) &&
    refreshToken.createdAt >= user.passwordChangedAt
  )
}

function isUnrevokedAndUnexpired(refreshToken: RefreshTokenRecord, now: Date) {
  return refreshToken.revokedAt === null && refreshToken.expiresAt > now
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
