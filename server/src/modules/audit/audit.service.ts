import { Injectable } from '@nestjs/common'

import type { Prisma } from '../../generated/prisma/client'
import type { RequestContext } from '../../common/http/request-context'
import { PrismaService } from '../../platform/database/prisma.service'
import {
  asPrismaTransaction,
  type DatabaseTransaction,
} from '../../platform/database/database-transaction'
import type { AuditEventAction, AuditTargetType } from './audit.constants'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  universityId: string | null
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
  universityId?: string | null
  actorUserId?: string | null
  action: AuditEventAction
  target: AuditTargetInput
  courseId?: string | null
  metadata?: AuditMetadata
  requestContext?: AuditRequestContext
}

export interface ListAuditEventsInput {
  universityId?: string
  page?: number
  limit?: number
  search?: string
  action?: string
  targetType?: string
  courseId?: string
  actorUserId?: string
  startDate?: Date
  endDate?: Date
}

export interface AuditLogPage {
  events: AuditLogRecord[]
  total: number
  page: number
  limit: number
  totalPages: number
}

@Injectable()
export class AuditService {
  constructor(private readonly prismaService: PrismaService) {}

  async recordEvent(
    input: RecordAuditEventInput,
    transaction?: DatabaseTransaction,
  ): Promise<AuditLogRecord> {
    const prisma =
      transaction === undefined
        ? this.prismaService
        : asPrismaTransaction(transaction)

    let universityId = input.universityId
    if (universityId === undefined) {
      if (input.courseId !== undefined && input.courseId !== null) {
        const course = await prisma.course.findUnique({
          where: { id: input.courseId },
          select: { universityId: true },
        })
        universityId = course?.universityId ?? null
      } else if (
        input.actorUserId !== undefined &&
        input.actorUserId !== null
      ) {
        const user = await prisma.user.findUnique({
          where: { id: input.actorUserId },
          select: { universityId: true },
        })
        universityId = user?.universityId ?? null
      } else {
        universityId = null
      }
    }

    const record = await prisma.auditLog.create({
      data: {
        universityId: universityId ?? null,
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

  async findEventById(
    id: string,
    universityId?: string,
  ): Promise<AuditLogRecord | null> {
    const record = await this.prismaService.auditLog.findFirst({
      where: {
        id,
        ...(universityId !== undefined ? { universityId } : {}),
      },
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
    return record === null ? null : toAuditLogRecord(record)
  }

  async listAuditEvents(
    input: ListAuditEventsInput = {},
  ): Promise<AuditLogPage> {
    const page =
      input.page !== undefined && Number.isInteger(input.page) && input.page > 0
        ? input.page
        : 1
    const limit =
      input.limit !== undefined &&
      Number.isInteger(input.limit) &&
      input.limit > 0
        ? Math.min(input.limit, 100)
        : 20
    const skip = (page - 1) * limit

    const where: Prisma.AuditLogWhereInput = {}

    if (input.universityId !== undefined && input.universityId.length > 0) {
      where.universityId = input.universityId
    }

    if (input.action !== undefined && input.action.length > 0) {
      where.action = input.action
    }

    if (input.targetType !== undefined && input.targetType.length > 0) {
      where.targetType = input.targetType
    }

    if (input.courseId !== undefined && input.courseId.length > 0) {
      where.courseId = input.courseId
    }

    if (input.actorUserId !== undefined && input.actorUserId.length > 0) {
      where.actorUserId = input.actorUserId
    }

    if (input.startDate !== undefined || input.endDate !== undefined) {
      where.createdAt = {
        ...(input.startDate !== undefined ? { gte: input.startDate } : {}),
        ...(input.endDate !== undefined ? { lte: input.endDate } : {}),
      }
    }

    if (input.search !== undefined && input.search.trim().length > 0) {
      const search = input.search.trim()
      const isUuid = UUID_REGEX.test(search)

      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { targetType: { contains: search, mode: 'insensitive' } },
        { actor: { displayName: { contains: search, mode: 'insensitive' } } },
        { actor: { email: { contains: search, mode: 'insensitive' } } },
        ...(isUuid
          ? [
              { id: search },
              { targetId: search },
              { courseId: search },
              { actorUserId: search },
            ]
          : []),
      ]
    }

    const [records, total] = await Promise.all([
      this.prismaService.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
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
      }),
      this.prismaService.auditLog.count({ where }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))

    return {
      events: records.map(toAuditLogRecord),
      total,
      page,
      limit,
      totalPages,
    }
  }

  async listRecentEvents(limit: number): Promise<AuditLogRecord[]> {
    const result = await this.listAuditEvents({ limit, page: 1 })
    return result.events
  }
}

function toAuditLogRecord(record: {
  id: string
  universityId?: string | null
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
    universityId: record.universityId ?? null,
    action: record.action as AuditEventAction,
    targetType: record.targetType as AuditTargetType,
    metadata: isAuditMetadata(record.metadata) ? record.metadata : {},
    actor: record.actor ?? null,
  }
}

function isAuditMetadata(value: unknown): value is AuditMetadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
