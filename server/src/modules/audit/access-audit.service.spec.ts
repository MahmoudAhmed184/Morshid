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

  it('does not throw when audit persistence fails for RBAC denied events', async () => {
    const { auditLog, service } = await buildService()
    auditLog.create.mockRejectedValueOnce(new Error('audit unavailable'))

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
  })
})
