import { Injectable } from '@nestjs/common'

import type {
  RefreshToken as PrismaRefreshToken,
  User as PrismaUser,
} from '../../generated/prisma/client'
import { PrismaService } from '../../platform/database/prisma.service'
import type {
  IdentityUserRecord,
  RefreshTokenRecord,
  RefreshTokenWithUserRecord,
} from './identity.types'

const refreshTokenTransactionOptions = {
  maxWait: 10_000,
  timeout: 5_000,
} as const

export interface CreateRefreshTokenRecordInput {
  userId: string
  familyId?: string
  familyCreatedAt?: Date
  tokenHash: string
  expiresAt: Date
  ip: string | null
  userAgent: string | null
}

export type RefreshTokenWithUser = RefreshTokenWithUserRecord

export interface RefreshTokenRecordStore {
  create(input: CreateRefreshTokenRecordInput): Promise<RefreshTokenRecord>
  findByTokenHashWithUser(
    tokenHash: string,
  ): Promise<RefreshTokenWithUser | null>
  findActiveSessionFamily(
    userId: string,
    familyId: string,
    now: Date,
  ): Promise<RefreshTokenRecord | null>
  findActiveSessionsByUserId(
    userId: string,
    now: Date,
  ): Promise<RefreshTokenRecord[]>
  findUserWithActiveSessionFamily(
    userId: string,
    familyId: string,
    now: Date,
  ): Promise<IdentityUserRecord | null>
  lockUserById(userId: string): Promise<IdentityUserRecord | null>
  markReplaced(
    refreshTokenId: string,
    replacementRefreshTokenId: string,
  ): Promise<RefreshTokenRecord>
  revokeActiveByHash(tokenHash: string, now: Date): Promise<{ count: number }>
  revokeActiveByIdAndHash(
    refreshTokenId: string,
    tokenHash: string,
    now: Date,
  ): Promise<{ count: number }>
  revokeActiveFamily(
    userId: string,
    familyId: string,
    now: Date,
  ): Promise<{ count: number }>
  revokeAllActiveForUser(userId: string, now: Date): Promise<{ count: number }>
  revokeAllOtherActiveFamilies(
    userId: string,
    currentFamilyId: string,
    now: Date,
  ): Promise<{ count: number }>
  updateUserPassword(
    userId: string,
    passwordHash: string,
    passwordChangedAt: Date,
  ): Promise<IdentityUserRecord>
}

class PrismaRefreshTokenRecordStore implements RefreshTokenRecordStore {
  constructor(private readonly client: RefreshTokenClient) {}

  create(input: CreateRefreshTokenRecordInput): Promise<RefreshTokenRecord> {
    return createRefreshToken(this.client, input)
  }

  findByTokenHashWithUser(
    tokenHash: string,
  ): Promise<RefreshTokenWithUser | null> {
    return findRefreshTokenByHashWithUser(this.client, tokenHash)
  }

  findActiveSessionFamily(
    userId: string,
    familyId: string,
    now: Date,
  ): Promise<RefreshTokenRecord | null> {
    return findActiveSessionFamily(this.client, userId, familyId, now)
  }

  findActiveSessionsByUserId(
    userId: string,
    now: Date,
  ): Promise<RefreshTokenRecord[]> {
    return findActiveSessionsByUserId(this.client, userId, now)
  }

  findUserWithActiveSessionFamily(
    userId: string,
    familyId: string,
    now: Date,
  ): Promise<IdentityUserRecord | null> {
    return findUserWithActiveSessionFamily(this.client, userId, familyId, now)
  }

  lockUserById(userId: string): Promise<IdentityUserRecord | null> {
    return lockIdentityUserById(this.client, userId)
  }

  markReplaced(
    refreshTokenId: string,
    replacementRefreshTokenId: string,
  ): Promise<RefreshTokenRecord> {
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

  revokeActiveFamily(
    userId: string,
    familyId: string,
    now: Date,
  ): Promise<{ count: number }> {
    return revokeActiveFamily(this.client, userId, familyId, now)
  }

  revokeAllActiveForUser(
    userId: string,
    now: Date,
  ): Promise<{ count: number }> {
    return this.client.refreshToken.updateMany({
      where: {
        userId,
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

  revokeAllOtherActiveFamilies(
    userId: string,
    currentFamilyId: string,
    now: Date,
  ): Promise<{ count: number }> {
    return revokeAllOtherActiveFamilies(
      this.client,
      userId,
      currentFamilyId,
      now,
    )
  }

  async updateUserPassword(
    userId: string,
    passwordHash: string,
    passwordChangedAt: Date,
  ): Promise<IdentityUserRecord> {
    const updated = await this.client.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash,
        passwordChangedAt,
      },
    })

    return toIdentityUserRecord(updated)
  }
}

@Injectable()
export class RefreshSessionRepository extends PrismaRefreshTokenRecordStore {
  constructor(private readonly prismaService: PrismaService) {
    super(prismaService)
  }

  async transaction<T>(
    callback: (repository: RefreshTokenRecordStore) => Promise<T>,
  ): Promise<T> {
    return this.prismaService.$transaction(
      async (tx) =>
        callback(new PrismaRefreshTokenRecordStore(tx as RefreshTokenClient)),
      refreshTokenTransactionOptions,
    )
  }
}

type RefreshTokenClient = Pick<
  PrismaService,
  'refreshToken' | 'user' | '$queryRaw'
>

interface LockedIdentityUserRow {
  id: string
  email: string
  displayName: string
  role: string
  status: string
  passwordHash: string
  passwordChangedAt: Date
  createdAt: Date
  updatedAt: Date
  disabledAt: Date | null
  disabledById: string | null
  lastLoginAt: Date | null
}

function createRefreshToken(
  client: RefreshTokenClient,
  input: CreateRefreshTokenRecordInput,
): Promise<RefreshTokenRecord> {
  return client.refreshToken
    .create({
      data: {
        userId: input.userId,
        familyId: input.familyId,
        familyCreatedAt: input.familyCreatedAt,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    })
    .then(toRefreshTokenRecord)
}

async function findRefreshTokenByHashWithUser(
  client: RefreshTokenClient,
  tokenHash: string,
): Promise<RefreshTokenWithUser | null> {
  const record = await client.refreshToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: true,
    },
  })

  return record === null
    ? null
    : {
        ...toRefreshTokenRecord(record),
        user: toIdentityUserRecord(record.user),
      }
}

async function findActiveSessionFamily(
  client: RefreshTokenClient,
  userId: string,
  familyId: string,
  now: Date,
): Promise<RefreshTokenRecord | null> {
  const record = await client.refreshToken.findFirst({
    where: {
      userId,
      familyId,
      revokedAt: null,
      expiresAt: {
        gt: now,
      },
    },
  })

  return record ? toRefreshTokenRecord(record) : null
}

async function findActiveSessionsByUserId(
  client: RefreshTokenClient,
  userId: string,
  now: Date,
): Promise<RefreshTokenRecord[]> {
  const records = await client.refreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return records.map(toRefreshTokenRecord)
}

async function findUserWithActiveSessionFamily(
  client: RefreshTokenClient,
  userId: string,
  familyId: string,
  now: Date,
): Promise<IdentityUserRecord | null> {
  const user = await client.user.findUnique({
    where: { id: userId },
    include: {
      refreshTokens: {
        where: {
          familyId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        take: 1,
      },
    },
  })

  if (!user || user.refreshTokens.length === 0) {
    return null
  }

  return toIdentityUserRecord(user)
}

async function lockIdentityUserById(
  client: RefreshTokenClient,
  userId: string,
): Promise<IdentityUserRecord | null> {
  const rows = await client.$queryRaw<LockedIdentityUserRow[]>`
    SELECT
      id,
      email,
      display_name AS "displayName",
      role,
      status,
      password_hash AS "passwordHash",
      password_changed_at AS "passwordChangedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      disabled_at AS "disabledAt",
      disabled_by AS "disabledById",
      last_login_at AS "lastLoginAt"
    FROM users
    WHERE id = ${userId}::uuid
    FOR UPDATE
  `
  if (rows.length === 0) {
    return null
  }

  const user = rows[0]
  return {
    ...user,
    role: user.role as IdentityUserRecord['role'],
    status: user.status as IdentityUserRecord['status'],
  }
}

function markRefreshTokenReplaced(
  client: RefreshTokenClient,
  refreshTokenId: string,
  replacementRefreshTokenId: string,
): Promise<RefreshTokenRecord> {
  return client.refreshToken
    .update({
      where: {
        id: refreshTokenId,
      },
      data: {
        replacedByTokenId: replacementRefreshTokenId,
      },
    })
    .then(toRefreshTokenRecord)
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

function revokeActiveFamily(
  client: RefreshTokenClient,
  userId: string,
  familyId: string,
  now: Date,
) {
  return client.refreshToken.updateMany({
    where: {
      userId,
      familyId,
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

function revokeAllOtherActiveFamilies(
  client: RefreshTokenClient,
  userId: string,
  currentFamilyId: string,
  now: Date,
) {
  return client.refreshToken.updateMany({
    where: {
      userId,
      familyId: {
        not: currentFamilyId,
      },
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

function toRefreshTokenRecord(record: PrismaRefreshToken): RefreshTokenRecord {
  return {
    id: record.id,
    userId: record.userId,
    familyId: record.familyId,
    familyCreatedAt: record.familyCreatedAt,
    tokenHash: record.tokenHash,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    replacedByTokenId: record.replacedByTokenId,
    ip: record.ip,
    userAgent: record.userAgent,
    createdAt: record.createdAt,
  }
}

function toIdentityUserRecord(user: PrismaUser): IdentityUserRecord {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    passwordHash: user.passwordHash,
    passwordChangedAt: user.passwordChangedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    disabledAt: user.disabledAt,
    disabledById: user.disabledById,
    lastLoginAt: user.lastLoginAt,
  }
}
