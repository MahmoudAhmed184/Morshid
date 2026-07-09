import { Injectable } from '@nestjs/common'

import type { RefreshToken, User } from '../../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

export interface CreateRefreshTokenRecordInput {
  userId: string
  tokenHash: string
  expiresAt: Date
  ip: string | null
  userAgent: string | null
}

export type RefreshTokenWithUser = RefreshToken & {
  user: User
}

export interface RefreshTokenRecordStore {
  create(input: CreateRefreshTokenRecordInput): Promise<RefreshToken>
  findByTokenHashWithUser(
    tokenHash: string,
  ): Promise<RefreshTokenWithUser | null>
  markReplaced(
    refreshTokenId: string,
    replacementRefreshTokenId: string,
  ): Promise<RefreshToken>
  revokeActiveByHash(tokenHash: string, now: Date): Promise<{ count: number }>
  revokeActiveByIdAndHash(
    refreshTokenId: string,
    tokenHash: string,
    now: Date,
  ): Promise<{ count: number }>
}

class PrismaRefreshTokenRecordStore implements RefreshTokenRecordStore {
  constructor(private readonly client: RefreshTokenClient) {}

  create(input: CreateRefreshTokenRecordInput): Promise<RefreshToken> {
    return createRefreshToken(this.client, input)
  }

  findByTokenHashWithUser(
    tokenHash: string,
  ): Promise<RefreshTokenWithUser | null> {
    return findRefreshTokenByHashWithUser(this.client, tokenHash)
  }

  markReplaced(
    refreshTokenId: string,
    replacementRefreshTokenId: string,
  ): Promise<RefreshToken> {
    return markRefreshTokenReplaced(
      this.client,
      refreshTokenId,
      replacementRefreshTokenId,
    )
  }

  revokeActiveByHash(tokenHash: string, now: Date): Promise<{ count: number }> {
    return revokeActiveRefreshTokenByHash(this.client, tokenHash, now)
  }

  revokeActiveByIdAndHash(
    refreshTokenId: string,
    tokenHash: string,
    now: Date,
  ): Promise<{ count: number }> {
    return revokeActiveRefreshTokenByIdAndHash(
      this.client,
      refreshTokenId,
      tokenHash,
      now,
    )
  }
}

@Injectable()
export class RefreshTokenRepository extends PrismaRefreshTokenRecordStore {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService)
  }

  async transaction<T>(
    callback: (repository: RefreshTokenRecordStore) => Promise<T>,
  ): Promise<T> {
    return this.prismaService.$transaction(async (tx) =>
      callback(new PrismaRefreshTokenRecordStore(tx as RefreshTokenClient)),
    )
  }
}

type RefreshTokenClient = Pick<PrismaService, 'refreshToken'>

function createRefreshToken(
  client: RefreshTokenClient,
  input: CreateRefreshTokenRecordInput,
) {
  return client.refreshToken.create({
    data: {
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      ip: input.ip,
      userAgent: input.userAgent,
    },
  })
}

function findRefreshTokenByHashWithUser(
  client: RefreshTokenClient,
  tokenHash: string,
) {
  return client.refreshToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: true,
    },
  }) as Promise<RefreshTokenWithUser | null>
}

function markRefreshTokenReplaced(
  client: RefreshTokenClient,
  refreshTokenId: string,
  replacementRefreshTokenId: string,
) {
  return client.refreshToken.update({
    where: {
      id: refreshTokenId,
    },
    data: {
      replacedByTokenId: replacementRefreshTokenId,
    },
  })
}

function revokeActiveRefreshTokenByHash(
  client: RefreshTokenClient,
  tokenHash: string,
  now: Date,
) {
  return client.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    data: {
      revokedAt: now,
    },
  })
}

function revokeActiveRefreshTokenByIdAndHash(
  client: RefreshTokenClient,
  refreshTokenId: string,
  tokenHash: string,
  now: Date,
) {
  return client.refreshToken.updateMany({
    where: {
      id: refreshTokenId,
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    data: {
      revokedAt: now,
    },
  })
}
