import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import type { AuditLog, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AUDIT_EVENT_ACTIONS, AUDIT_TARGET_TYPES } from './audit.constants'
import { AccessAuditService } from './access-audit.service'
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

class InMemoryAuditLogDelegate {
  private readonly records = new Map<string, AuditLog>()

  private nextSequence = 1

  readonly create = jest.fn((args: CreateAuditLogArgs) => {
    const sequence = this.nextSequence
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
      createdAt: new Date(
        `2026-07-06T00:00:${sequence.toString().padStart(2, '0')}.000Z`,
      ),
    }

    this.nextSequence += 1
    this.records.set(record.id, record)

    return Promise.resolve(record)
  })
}

async function buildService() {
  const auditLog = new InMemoryAuditLogDelegate()
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuditService,
      AccessAuditService,
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
    service: moduleRef.get(AccessAuditService),
  }
}

describe('AccessAuditService', () => {
  const requestContext = {
    ip: '203.0.113.10',
    userAgent: 'Jest',
  }

  const route = {
    method: 'GET',
    path: '/test/admin-only',
  }

  it('records RBAC denied audit events with actor and route context', async () => {
    const { auditLog, service } = await buildService()

    await service.recordRbacDenied({
      actor: {
        id: '00000000-0000-4000-8000-000000000003',
        role: 'STUDENT',
      },
      allowedRoles: ['ADMIN'],
      route,
      requestContext,
    })

    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: '00000000-0000-4000-8000-000000000003',
        action: AUDIT_EVENT_ACTIONS.ACCESS_RBAC_DENIED,
        targetType: AUDIT_TARGET_TYPES.SYSTEM,
        targetId: null,
        courseId: null,
        ip: '203.0.113.10',
        userAgent: 'Jest',
        metadata: {
          requiredRoles: ['ADMIN'],
          actorRole: 'STUDENT',
          method: 'GET',
          path: '/test/admin-only',
        },
      },
    })
  })

  it('does not throw but logs when audit persistence fails for RBAC denied events', async () => {
    const { auditLog, service } = await buildService()
    auditLog.create.mockRejectedValueOnce(new Error('audit unavailable'))
    const logSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)

    await expect(
      service.recordRbacDenied({
        actor: {
          id: '00000000-0000-4000-8000-000000000003',
          role: 'STUDENT',
        },
        allowedRoles: ['ADMIN'],
        route,
        requestContext,
      }),
    ).resolves.toBeUndefined()

    expect(logSpy).toHaveBeenCalledWith(
      'Failed to record RBAC-denied audit event',
      expect.any(String),
    )

    logSpy.mockRestore()
  })

  it('records course-boundary denied audit events with the verified course id and operation', async () => {
    const { auditLog, service } = await buildService()

    await service.recordCourseBoundaryDenied({
      actor: {
        id: '00000000-0000-4000-8000-000000000003',
        role: 'STUDENT',
      },
      courseId: '00000000-0000-4000-8000-000000000102',
      route: {
        method: 'GET',
        path: '/api/v1/courses/:courseId/chat-sessions',
      },
      requestContext,
    })

    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: '00000000-0000-4000-8000-000000000003',
        action: AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED,
        targetType: AUDIT_TARGET_TYPES.COURSE,
        targetId: '00000000-0000-4000-8000-000000000102',
        courseId: '00000000-0000-4000-8000-000000000102',
        ip: '203.0.113.10',
        userAgent: 'Jest',
        metadata: {
          actorRole: 'STUDENT',
          method: 'GET',
          path: '/api/v1/courses/:courseId/chat-sessions',
          operation: 'GET /api/v1/courses/:courseId/chat-sessions',
        },
      },
    })
  })

  it('keeps an unverified course id out of the FK column and in metadata', async () => {
    const { auditLog, service } = await buildService()

    await service.recordCourseBoundaryDenied({
      actor: {
        id: '00000000-0000-4000-8000-000000000003',
        role: 'STUDENT',
      },
      courseId: null,
      unverifiedCourseId: '11111111-1111-4111-8111-111111111111',
      route: {
        method: 'POST',
        path: '/api/v1/courses/:courseId/chat-sessions',
      },
      requestContext,
    })

    const call = auditLog.create.mock.calls[0][0] as {
      data: { courseId: string | null; metadata: Record<string, unknown> }
    }
    expect(call.data.courseId).toBeNull()
    expect(call.data.metadata).toMatchObject({
      unverifiedCourseId: '11111111-1111-4111-8111-111111111111',
      operation: 'POST /api/v1/courses/:courseId/chat-sessions',
    })
  })

  it('does not throw but logs when audit persistence fails for course-boundary events', async () => {
    const { auditLog, service } = await buildService()
    auditLog.create.mockRejectedValueOnce(new Error('audit unavailable'))
    const logSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)

    await expect(
      service.recordCourseBoundaryDenied({
        actor: {
          id: '00000000-0000-4000-8000-000000000003',
          role: 'STUDENT',
        },
        courseId: '00000000-0000-4000-8000-000000000102',
        route: {
          method: 'GET',
          path: '/api/v1/courses/:courseId/chat-sessions',
        },
        requestContext,
      }),
    ).resolves.toBeUndefined()

    expect(logSpy).toHaveBeenCalledWith(
      'Failed to record course-boundary-denied audit event',
      expect.any(String),
    )

    logSpy.mockRestore()
  })
})
