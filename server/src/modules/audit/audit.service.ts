import { Injectable } from '@nestjs/common'

import type { AuditLog, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { AuditEventAction, AuditTargetType } from './audit.constants'

export type AuditMetadata = Prisma.InputJsonObject

export interface AuditTargetInput {
  type: AuditTargetType
  id?: string | null
}

export interface AuditRequestContext {
  ip?: string | null
  userAgent?: string | null
}

export interface RecordAuditEventInput {
  actorUserId?: string | null
  action: AuditEventAction
  target: AuditTargetInput
  courseId?: string | null
  metadata?: AuditMetadata
  requestContext?: AuditRequestContext
}

@Injectable()
export class AuditService {
  constructor(private readonly prismaService: PrismaService) {}

  async recordEvent(input: RecordAuditEventInput): Promise<AuditLog> {
    return this.prismaService.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.target.type,
        targetId: input.target.id ?? null,
        courseId: input.courseId ?? null,
        ip: input.requestContext?.ip ?? null,
        userAgent: input.requestContext?.userAgent ?? null,
        metadata: input.metadata ?? {},
      },
    })
  }

  async findEventById(id: string): Promise<AuditLog | null> {
    return this.prismaService.auditLog.findUnique({
      where: {
        id,
      },
    })
  }
}
