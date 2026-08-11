import { Injectable } from '@nestjs/common'

import type { User } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthenticatedUser, IdentityUserSummary } from './identity.types'

@Injectable()
export class IdentityUser {
  constructor(private readonly prismaService: PrismaService) {}

  normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: {
        email: this.normalizeEmail(email),
      },
    })
  }

  findById(userId: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    })
  }

  async findActiveUserById(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.findById(userId)

    if (!user || this.isDisabled(user)) {
      return null
    }

    return this.pickAuthenticatedUser(user)
  }

  isDisabled(user: Pick<User, 'status'>) {
    return user.status === 'DISABLED'
  }

  async recordLastLogin(user: Pick<User, 'id'>, now: Date): Promise<void> {
    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: now,
      },
    })
  }

  pickAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    }
  }

  buildIdentityUserSummary(
    user: AuthenticatedUser | User,
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
