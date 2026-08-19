import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../platform/database/prisma.service'
import {
  universityInactiveException,
  universityNotFoundException,
  universitySuspendedException,
} from './identity.errors'
import type { UniversityStatus } from './identity.roles'
import type {
  AuthenticatedUser,
  IdentityUserRecord,
  IdentityUserSummary,
} from './identity.types'

const identityUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
  universityId: true,
  university: {
    select: {
      status: true,
    },
  },
  passwordHash: true,
  passwordChangedAt: true,
  createdAt: true,
  updatedAt: true,
  disabledAt: true,
  disabledById: true,
  lastLoginAt: true,
} as const

@Injectable()
export class IdentityUser {
  constructor(private readonly prismaService: PrismaService) {}

  normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }

  async findByEmail(email: string): Promise<IdentityUserRecord | null> {
    const user = await this.prismaService.user.findUnique({
      where: {
        email: this.normalizeEmail(email),
      },
      select: identityUserSelect,
    })
    return user === null ? null : toIdentityUserRecord(user)
  }

  async findById(userId: string): Promise<IdentityUserRecord | null> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: identityUserSelect,
    })
    return user === null ? null : toIdentityUserRecord(user)
  }

  async findActiveUserById(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.findById(userId)

    if (!user || this.isDisabled(user) || !this.isTenantActive(user)) {
      return null
    }

    return this.pickAuthenticatedUser(user)
  }

  isDisabled(user: Pick<IdentityUserRecord, 'status'>) {
    return user.status === 'DISABLED'
  }

  isTenantSuspended(
    user: Pick<IdentityUserRecord, 'role' | 'universityStatus'>,
  ) {
    return user.role !== 'SUPER_ADMIN' && user.universityStatus === 'SUSPENDED'
  }

  isTenantInactive(
    user: Pick<IdentityUserRecord, 'role' | 'universityStatus'>,
  ) {
    return user.role !== 'SUPER_ADMIN' && user.universityStatus === 'INACTIVE'
  }

  isTenantActive(
    user: Pick<
      IdentityUserRecord,
      'role' | 'universityId' | 'universityStatus'
    >,
  ) {
    if (user.role === 'SUPER_ADMIN') {
      return true
    }
    return user.universityId !== null && user.universityStatus === 'ACTIVE'
  }

  assertActiveTenant(
    user: Pick<
      IdentityUserRecord,
      'role' | 'universityId' | 'universityStatus'
    >,
  ): void {
    if (user.role === 'SUPER_ADMIN') {
      return
    }

    if (user.universityId === null || user.universityStatus === null) {
      throw universityNotFoundException()
    }

    if (user.universityStatus === 'SUSPENDED') {
      throw universitySuspendedException()
    }

    if (user.universityStatus === 'INACTIVE') {
      throw universityInactiveException()
    }
  }

  async recordLastLogin(
    user: Pick<IdentityUserRecord, 'id'>,
    now: Date,
  ): Promise<void> {
    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: now,
      },
    })
  }

  async updateDisplayName(
    userId: string,
    displayName: string,
  ): Promise<IdentityUserRecord> {
    const user = await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        displayName,
      },
      select: identityUserSelect,
    })
    return toIdentityUserRecord(user)
  }

  pickAuthenticatedUser(user: IdentityUserRecord): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      universityId: user.universityId,
    }
  }

  buildIdentityUserSummary(
    user: AuthenticatedUser | IdentityUserRecord,
  ): IdentityUserSummary {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    }
  }
}

function toIdentityUserRecord(user: {
  id: string
  email: string
  displayName: string
  role: string
  status: string
  universityId: string | null
  university?: { status: string } | null
  universityStatus?: string | null
  passwordHash: string
  passwordChangedAt: Date
  createdAt: Date
  updatedAt: Date
  disabledAt: Date | null
  disabledById: string | null
  lastLoginAt: Date | null
}): IdentityUserRecord {
  const universityStatus =
    user.university?.status ??
    (user.universityStatus as UniversityStatus | null) ??
    null

  return {
    ...user,
    role: user.role as IdentityUserRecord['role'],
    status: user.status as IdentityUserRecord['status'],
    universityStatus: universityStatus as UniversityStatus | null,
  }
}
