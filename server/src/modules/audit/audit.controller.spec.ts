import { AuditController } from './audit.controller'
import type { AuditService } from './audit.service'
import { AUDIT_EVENT_ACTIONS, AUDIT_TARGET_TYPES } from './audit.constants'

describe('AuditController', () => {
  const listAuditEvents = jest.fn()
  const auditService = {
    listAuditEvents,
  } as unknown as AuditService
  const controller = new AuditController(auditService)

  beforeEach(() => {
    listAuditEvents.mockReset()
  })

  it('delegates search, filters, and pagination parameters to AuditService and formats response', async () => {
    const createdAt = new Date('2026-08-19T10:00:00.000Z')
    listAuditEvents.mockResolvedValue({
      events: [
        {
          id: '00000000-0000-4000-8000-000000000001',
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

    const result = await controller.listRecentEvents(query)

    expect(listAuditEvents).toHaveBeenCalledWith(query)
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
})
