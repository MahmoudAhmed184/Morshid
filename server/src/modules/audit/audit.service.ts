import { Injectable } from '@nestjs/common'

import type { RequestContext } from '../../common/http/request-context'
import { PrismaService } from '../../platform/database/prisma.service'
import {
  asPrismaTransaction,
  type DatabaseTransaction,
} from '../../platform/database/database-transaction'
import type { AuditEventAction, AuditTargetType } from './audit.constants'

export type AuditMetadataValue =
  | string
  | number
  | boolean
  | null
  | { readonly [key: string]: AuditMetadataValue }
  | readonly AuditMetadataValue[]

export type AuditMetadata = Readonly<Record<string, AuditMetadataValue>>

export interface AuditLogRecord {
  id: string
  actorUserId: string | null
  action: AuditEventAction
  targetType: AuditTargetType
  targetId: string | null
  courseId: string | null
  ip: string | null
  userAgent: string | null
  metadata: AuditMetadata
  createdAt: Date
  actor: AuditActorRecord | null
}

export interface AuditActorRecord {
  id: string
  email: string
  displayName: string
}

export interface AuditTargetInput {
  type: AuditTargetType
  id?: string | null
}

export type AuditRequestContext = RequestContext

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

  async recordEvent(
    input: RecordAuditEventInput,
    transaction?: DatabaseTransaction,
  ): Promise<AuditLogRecord> {
    const auditLog =
      transaction === undefined
        ? this.prismaService.auditLog
        : asPrismaTransaction(transaction).auditLog

    const record = await auditLog.create({
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
    return toAuditLogRecord(record)
  }

  async findEventById(id: string): Promise<AuditLogRecord | null> {
    const record = await this.prismaService.auditLog.findUnique({
      where: {
        id,
      },
    })
    return record === null ? null : toAuditLogRecord(record)
  }

  async listRecentEvents(limit: number): Promise<AuditLogRecord[]> {
    const records = await this.prismaService.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    })
    return records.map(toAuditLogRecord)
  }
}

function toAuditLogRecord(record: {
  id: string
  actorUserId: string | null
  action: string
  targetType: string
  targetId: string | null
  courseId: string | null
  ip: string | null
  userAgent: string | null
  metadata: unknown
  createdAt: Date
  actor?: AuditActorRecord | null
}): AuditLogRecord {
  return {
    ...record,
    action: record.action as AuditEventAction,
    targetType: record.targetType as AuditTargetType,
    metadata: isAuditMetadata(record.metadata) ? record.metadata : {},
    actor: record.actor ?? null,
  }
}

function isAuditMetadata(value: unknown): value is AuditMetadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
