import { Test } from '@nestjs/testing'

import type { AuditLog, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../platform/database/prisma.service'
import { AUDIT_EVENT_ACTIONS, AUDIT_TARGET_TYPES } from './audit.constants'
import { AuditService } from './audit.service'

jest.mock('../../platform/database/prisma.service', () => ({
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

interface AuditLogWhereClause {
  action?: string
  targetType?: string
  courseId?: string
  actorUserId?: string
  createdAt?: { gte?: Date; lte?: Date }
  OR?: {
    action?: { contains: string; mode?: string }
    targetType?: { contains: string; mode?: string }
    actor?: {
      displayName?: { contains: string; mode?: string }
      email?: { contains: string; mode?: string }
    }
    id?: string
    targetId?: string
    courseId?: string
    actorUserId?: string
  }[]
}

interface FindManyAuditLogArgs {
  where?: AuditLogWhereClause
  orderBy: { createdAt: 'desc' }
  skip?: number
  take: number
  include: {
    actor: {
      select: { id: true; email: true; displayName: true }
    }
  }
}

interface CountAuditLogArgs {
  where?: AuditLogWhereClause
}

class InMemoryAuditLogDelegate {
  private readonly records = new Map<string, AuditLog>()
  private readonly actors = new Map<
    string,
    { id: string; email: string; displayName: string }
  >()

  private nextSequence = 1

  seedActor(actor: { id: string; email: string; displayName: string }) {
    this.actors.set(actor.id, actor)
  }

  readonly create = jest.fn((args: CreateAuditLogArgs) => {
    const sequence = this.nextSequence
    const sequenceText = sequence.toString().padStart(2, '0')
    const record: AuditLog = {
      id: `00000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`,
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

  private filterRecords(where?: AuditLogWhereClause): (AuditLog & {
    actor: { id: string; email: string; displayName: string } | null
  })[] {
    const all = [...this.records.values()].map((event) => ({
      ...event,
      actor:
        event.actorUserId !== null
          ? (this.actors.get(event.actorUserId) ?? null)
          : null,
    }))

    if (where === undefined || Object.keys(where).length === 0) {
      return all
    }

    return all.filter((event) => {
      if (where.action !== undefined && event.action !== where.action) {
        return false
      }
      if (
        where.targetType !== undefined &&
        event.targetType !== where.targetType
      ) {
        return false
      }
      if (where.courseId !== undefined && event.courseId !== where.courseId) {
        return false
      }
      if (
        where.actorUserId !== undefined &&
        event.actorUserId !== where.actorUserId
      ) {
        return false
      }

      if (where.createdAt !== undefined) {
        if (
          where.createdAt.gte !== undefined &&
          event.createdAt < where.createdAt.gte
        ) {
          return false
        }
        if (
          where.createdAt.lte !== undefined &&
          event.createdAt > where.createdAt.lte
        ) {
          return false
        }
      }

      if (where.OR !== undefined && Array.isArray(where.OR)) {
        const matched = where.OR.some((condition) => {
          if (condition.action !== undefined) {
            const pattern = condition.action.contains.toLowerCase()
            if (event.action.toLowerCase().includes(pattern)) return true
          }
          if (condition.targetType !== undefined) {
            const pattern = condition.targetType.contains.toLowerCase()
            if (event.targetType.toLowerCase().includes(pattern)) return true
          }
          if (condition.actor !== undefined) {
            if (
              condition.actor.displayName !== undefined &&
              (event.actor?.displayName
                .toLowerCase()
                .includes(condition.actor.displayName.contains.toLowerCase()) ??
                false)
            ) {
              return true
            }
            if (
              condition.actor.email !== undefined &&
              (event.actor?.email
                .toLowerCase()
                .includes(condition.actor.email.contains.toLowerCase()) ??
                false)
            ) {
              return true
            }
          }
          if (condition.id !== undefined && event.id === condition.id) {
            return true
          }
          if (
            condition.targetId !== undefined &&
            event.targetId === condition.targetId
          ) {
            return true
          }
          if (
            condition.courseId !== undefined &&
            event.courseId === condition.courseId
          ) {
            return true
          }
          if (
            condition.actorUserId !== undefined &&
            event.actorUserId === condition.actorUserId
          ) {
            return true
          }
          return false
        })
        if (!matched) return false
      }

      return true
    })
  }

  readonly findMany = jest.fn((args: FindManyAuditLogArgs) => {
    const filtered = this.filterRecords(args.where)
    const sorted = filtered.sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    )
    const skip = args.skip ?? 0
    return Promise.resolve(sorted.slice(skip, skip + args.take))
  })

  readonly count = jest.fn((args?: CountAuditLogArgs) => {
    const filtered = this.filterRecords(args?.where)
    return Promise.resolve(filtered.length)
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
      id: '00000000-0000-4000-8000-000000000001',
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
      where: {},
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 1,
      include: {
        actor: {
          select: { id: true, email: true, displayName: true },
        },
      },
    })
  })

  it('paginates audit events with total and totalPages calculation', async () => {
    const { service } = await buildService()
    for (let i = 0; i < 25; i++) {
      await service.recordEvent({
        action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
        target: { type: AUDIT_TARGET_TYPES.AUTH_SESSION },
      })
    }

    const page1 = await service.listAuditEvents({ page: 1, limit: 10 })
    expect(page1.events).toHaveLength(10)
    expect(page1.total).toBe(25)
    expect(page1.page).toBe(1)
    expect(page1.limit).toBe(10)
    expect(page1.totalPages).toBe(3)

    const page3 = await service.listAuditEvents({ page: 3, limit: 10 })
    expect(page3.events).toHaveLength(5)
    expect(page3.total).toBe(25)
    expect(page3.page).toBe(3)
    expect(page3.totalPages).toBe(3)
  })

  it('filters audit events by action, targetType, courseId, and actorUserId', async () => {
    const { auditLog, service } = await buildService()
    const actorId = '00000000-0000-0000-0000-000000000001'
    const courseId = '00000000-0000-0000-0000-000000000002'
    auditLog.seedActor({
      id: actorId,
      email: 'admin@morshid.test',
      displayName: 'Admin User',
    })

    await service.recordEvent({
      actorUserId: actorId,
      action: AUDIT_EVENT_ACTIONS.ADMIN_COURSE_CREATED,
      target: { type: AUDIT_TARGET_TYPES.COURSE, id: courseId },
      courseId,
    })
    await service.recordEvent({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
      target: { type: AUDIT_TARGET_TYPES.AUTH_SESSION },
    })

    const filteredByTarget = await service.listAuditEvents({
      targetType: AUDIT_TARGET_TYPES.COURSE,
    })
    expect(filteredByTarget.events).toHaveLength(1)
    expect(filteredByTarget.events[0].targetType).toBe(
      AUDIT_TARGET_TYPES.COURSE,
    )

    const filteredByAction = await service.listAuditEvents({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
    })
    expect(filteredByAction.events).toHaveLength(1)
    expect(filteredByAction.events[0].action).toBe(
      AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
    )

    const filteredByCourse = await service.listAuditEvents({ courseId })
    expect(filteredByCourse.events).toHaveLength(1)
    expect(filteredByCourse.events[0].courseId).toBe(courseId)

    const filteredByActor = await service.listAuditEvents({
      actorUserId: actorId,
    })
    expect(filteredByActor.events).toHaveLength(1)
    expect(filteredByActor.events[0].actorUserId).toBe(actorId)
  })

  it('searches audit events by text matching action, targetType, and actor details', async () => {
    const { auditLog, service } = await buildService()
    const actorId = '00000000-0000-0000-0000-000000000001'
    auditLog.seedActor({
      id: actorId,
      email: 'prof.smith@morshid.test',
      displayName: 'Professor Smith',
    })

    await service.recordEvent({
      actorUserId: actorId,
      action: AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_SUCCEEDED,
      target: { type: AUDIT_TARGET_TYPES.MATERIAL },
    })
    await service.recordEvent({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_FAILED,
      target: { type: AUDIT_TARGET_TYPES.AUTH_SESSION },
    })

    const searchAction = await service.listAuditEvents({
      search: 'material.upload',
    })
    expect(searchAction.events).toHaveLength(1)
    expect(searchAction.events[0].action).toBe(
      AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_SUCCEEDED,
    )

    const searchActor = await service.listAuditEvents({ search: 'Professor' })
    expect(searchActor.events).toHaveLength(1)
    expect(searchActor.events[0].actorUserId).toBe(actorId)

    const searchEmail = await service.listAuditEvents({
      search: 'smith@morshid',
    })
    expect(searchEmail.events).toHaveLength(1)
  })

  it('filters audit events by date range', async () => {
    const { service } = await buildService()
    await service.recordEvent({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
      target: { type: AUDIT_TARGET_TYPES.AUTH_SESSION },
    })
    await service.recordEvent({
      action: AUDIT_EVENT_ACTIONS.AUTH_LOGOUT,
      target: { type: AUDIT_TARGET_TYPES.AUTH_SESSION },
    })

    const startDate = new Date('2026-07-06T00:00:01.500Z')
    const result = await service.listAuditEvents({ startDate })
    expect(result.events).toHaveLength(1)
    expect(result.events[0].action).toBe(AUDIT_EVENT_ACTIONS.AUTH_LOGOUT)
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
