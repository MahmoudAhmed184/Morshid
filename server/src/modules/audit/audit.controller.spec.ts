import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { AuditController } from './audit.controller'
import type { AuditService } from './audit.service'
import { AUDIT_EVENT_ACTIONS, AUDIT_TARGET_TYPES } from './audit.constants'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import { UserRole } from '../identity/identity.roles'

describe('AuditController', () => {
  const listAuditEvents = jest.fn()
  const findEventById = jest.fn()
  const auditService = {
    listAuditEvents,
    findEventById,
  } as unknown as AuditService
  const controller = new AuditController(auditService)

  const mockRequest = {
    user: {
      id: '00000000-0000-4000-8000-000000000002',
      email: 'admin@morshid.test',
      displayName: 'Admin User',
      role: UserRole.ADMIN,
      status: 'ACTIVE',
      universityId: '00000000-0000-4000-8000-000000000099',
    },
  } as unknown as AuthenticatedHttpRequest

  beforeEach(() => {
    listAuditEvents.mockReset()
    findEventById.mockReset()
  })

  it('delegates search, filters, and pagination parameters with universityId to AuditService', async () => {
    const createdAt = new Date('2026-08-19T10:00:00.000Z')
    listAuditEvents.mockResolvedValue({
      events: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          universityId: '00000000-0000-4000-8000-000000000099',
          actorUserId: '00000000-0000-4000-8000-000000000002',
          action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_CREATED,
          targetType: AUDIT_TARGET_TYPES.USER,
          targetId: '00000000-0000-4000-8000-000000000003',
          courseId: null,
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          metadata: {},
          createdAt,
          actor: {
            id: '00000000-0000-4000-8000-000000000002',
            email: 'admin@morshid.test',
            displayName: 'Admin User',
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    })

    const query = {
      page: 1,
      limit: 20,
      search: 'admin',
      targetType: AUDIT_TARGET_TYPES.USER,
    }

    const result = await controller.listRecentEvents(query, mockRequest)

    expect(listAuditEvents).toHaveBeenCalledWith({
      ...query,
      universityId: '00000000-0000-4000-8000-000000000099',
    })
    expect(result).toEqual({
      events: [
        expect.objectContaining({
          id: '00000000-0000-4000-8000-000000000001',
          action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_CREATED,
          targetType: AUDIT_TARGET_TYPES.USER,
          createdAt: createdAt.toISOString(),
        }),
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    })
  })

  it('rejects listing when admin has no universityId', async () => {
    const noUniRequest = {
      user: {
        ...mockRequest.user,
        universityId: null,
      },
    } as unknown as AuthenticatedHttpRequest

    await expect(
      controller.listRecentEvents({ page: 1, limit: 20 }, noUniRequest),
    ).rejects.toThrow(ForbiddenException)
  })

  it('fetches an event by id within the admin university scope', async () => {
    const createdAt = new Date('2026-08-19T10:00:00.000Z')
    findEventById.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      universityId: '00000000-0000-4000-8000-000000000099',
      actorUserId: '00000000-0000-4000-8000-000000000002',
      action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_CREATED,
      targetType: AUDIT_TARGET_TYPES.USER,
      targetId: '00000000-0000-4000-8000-000000000003',
      courseId: null,
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      metadata: {},
      createdAt,
      actor: null,
    })

    const result = await controller.getEventById(
      '00000000-0000-4000-8000-000000000001',
      mockRequest,
    )

    expect(findEventById).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000099',
    )
    expect(result.id).toBe('00000000-0000-4000-8000-000000000001')
  })

  it('throws NotFoundException when event does not belong to university', async () => {
    findEventById.mockResolvedValue(null)

    await expect(
      controller.getEventById(
        '00000000-0000-4000-8000-000000000001',
        mockRequest,
      ),
    ).rejects.toThrow(NotFoundException)
  })
})
