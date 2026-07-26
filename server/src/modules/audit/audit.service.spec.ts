import { Test } from '@nestjs/testing'

import type { AuditLog, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AUDIT_EVENT_ACTIONS, AUDIT_TARGET_TYPES } from './audit.constants'
import { AuditService } from './audit.service'

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}))

interface CreateAuditLogData {
  actorUserId?: string | null
  action: string
  targetType: string
  targetId?: string | null
  courseId?: string | null
  ip?: string | null
  userAgent?: string | null
  metadata?: Prisma.JsonObject
}

interface CreateAuditLogArgs {
  data: CreateAuditLogData
}

interface FindUniqueAuditLogArgs {
  where: {
    id: string
  }
}

interface FindManyAuditLogArgs {
  orderBy: { createdAt: 'desc' }
  take: number
  include: {
    actor: {
      select: { id: true; email: true; displayName: true }
    }
  }
}

class InMemoryAuditLogDelegate {
  private readonly records = new Map<string, AuditLog>()

  private nextSequence = 1

  readonly create = jest.fn((args: CreateAuditLogArgs) => {
    const sequence = this.nextSequence
    const sequenceText = sequence.toString().padStart(2, '0')
    const record: AuditLog = {
      id: `audit-${sequence.toString()}`,
      actorUserId: args.data.actorUserId ?? null,
      action: args.data.action,
      targetType: args.data.targetType,
      targetId: args.data.targetId ?? null,
      courseId: args.data.courseId ?? null,
      ip: args.data.ip ?? null,
      userAgent: args.data.userAgent ?? null,
      metadata: args.data.metadata ?? {},
      createdAt: new Date(`2026-07-06T00:00:${sequenceText}.000Z`),
    }

    this.nextSequence += 1
    this.records.set(record.id, record)

    return Promise.resolve(record)
  })

  readonly findUnique = jest.fn((args: FindUniqueAuditLogArgs) => {
    return Promise.resolve(this.records.get(args.where.id) ?? null)
  })

  readonly findMany = jest.fn((args: FindManyAuditLogArgs) => {
    const events = [...this.records.values()]
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .slice(0, args.take)
      .map((event) => ({ ...event, actor: null }))
    return Promise.resolve(events)
  })
}

async function buildService() {
  const auditLog = new InMemoryAuditLogDelegate()
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuditService,
      {
        provide: PrismaService,
        useValue: {
          auditLog,
        },
      },
    ],
  }).compile()

  return {
    auditLog,
    service: moduleRef.get(AuditService),
  }
}

describe('AuditService', () => {
  it('records the full actor, target, course, metadata, and request context', async () => {
    const { auditLog, service } = await buildService()
    const metadata = {
      reason: 'policy_violation',
      previousStatus: 'ACTIVE',
    }

    const created = await service.recordEvent({
      actorUserId: '00000000-0000-0000-0000-000000000001',
      action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_DISABLED,
      target: {
        type: AUDIT_TARGET_TYPES.USER,
        id: '00000000-0000-0000-0000-000000000002',
      },
      courseId: '00000000-0000-0000-0000-000000000003',
      metadata,
      requestContext: {
        ip: '203.0.113.10',
        userAgent: 'Mozilla/5.0',
      },
    })

    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: '00000000-0000-0000-0000-000000000001',
        action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_DISABLED,
        targetType: AUDIT_TARGET_TYPES.USER,
        targetId: '00000000-0000-0000-0000-000000000002',
        courseId: '00000000-0000-0000-0000-000000000003',
        ip: '203.0.113.10',
        userAgent: 'Mozilla/5.0',
        metadata,
      },
    })
    expect(created).toMatchObject({
      id: 'audit-1',
      actorUserId: '00000000-0000-0000-0000-000000000001',
      action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_DISABLED,
      targetType: AUDIT_TARGET_TYPES.USER,
      targetId: '00000000-0000-0000-0000-000000000002',
      courseId: '00000000-0000-0000-0000-000000000003',
      ip: '203.0.113.10',
      userAgent: 'Mozilla/5.0',
      metadata,
    })
    expect(created.createdAt).toBeInstanceOf(Date)
  })

  it('records unauthenticated requestless events with nullable fields and empty metadata', async () => {
    const { auditLog, service } = await buildService()

    const created = await service.recordEvent({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
      target: {
        type: AUDIT_TARGET_TYPES.AUTH_SESSION,
      },
    })

    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: null,
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
        targetType: AUDIT_TARGET_TYPES.AUTH_SESSION,
        targetId: null,
        courseId: null,
        ip: null,
        userAgent: null,
        metadata: {},
      },
    })
    expect(created).toMatchObject({
      actorUserId: null,
      targetId: null,
      courseId: null,
      ip: null,
      userAgent: null,
      metadata: {},
    })
  })

  it('reads an event by id from the audit log store', async () => {
    const { auditLog, service } = await buildService()
    const created = await service.recordEvent({
      actorUserId: '00000000-0000-0000-0000-000000000001',
      action: AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED,
      target: {
        type: AUDIT_TARGET_TYPES.COURSE,
        id: '00000000-0000-0000-0000-000000000002',
      },
      courseId: '00000000-0000-0000-0000-000000000002',
      metadata: {
        attemptedCourseId: '00000000-0000-0000-0000-000000000004',
      },
    })

    await expect(service.findEventById(created.id)).resolves.toEqual(created)
    await expect(service.findEventById('missing')).resolves.toBeNull()
    expect(auditLog.findUnique).toHaveBeenCalledWith({
      where: {
        id: created.id,
      },
    })
  })

  it('lists the most recent audit events with safe actor summaries', async () => {
    const { auditLog, service } = await buildService()
    await service.recordEvent({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
      target: { type: AUDIT_TARGET_TYPES.AUTH_SESSION },
    })
    await service.recordEvent({
      action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_CREATED,
      target: { type: AUDIT_TARGET_TYPES.USER },
    })

    const events = await service.listRecentEvents(1)

    expect(events).toHaveLength(1)
    expect(events[0].action).toBe(AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_CREATED)
    expect(auditLog.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        actor: {
          select: { id: true, email: true, displayName: true },
        },
      },
    })
  })

  it('defines constants for the required security-sensitive event categories', () => {
    expect(AUDIT_EVENT_ACTIONS).toMatchObject({
      AUTH_LOGIN_SUCCEEDED: 'auth.login_succeeded',
      AUTH_LOGIN_FAILED: 'auth.login_failed',
      AUTH_LOGIN_BLOCKED_DISABLED_ACCOUNT:
        'auth.login_blocked_disabled_account',
      ACCESS_RBAC_DENIED: 'access.rbac_denied',
      ACCESS_COURSE_BOUNDARY_DENIED: 'access.course_boundary_denied',
      ADMIN_ACCOUNT_CREATED: 'admin.account_created',
      ADMIN_ACCOUNT_DISABLED: 'admin.account_disabled',
      ADMIN_COURSE_CREATED: 'admin.course_created',
      ADMIN_COURSE_MEMBER_ADDED: 'admin.course_member_added',
    })
    expect(AUDIT_TARGET_TYPES).toMatchObject({
      AUTH_SESSION: 'auth_session',
      USER: 'user',
      COURSE: 'course',
      COURSE_MEMBERSHIP: 'course_membership',
      SYSTEM: 'system',
    })
  })
})
