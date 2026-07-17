import { expect, it } from 'vitest'

import { getAdminAuditEvents } from './admin-audit.api'

it('loads recent audit events from the admin API', async () => {
  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe(
      'http://localhost:4000/api/v1/admin/audit?limit=5',
    )
    expect(init?.method).toBe('GET')
    return Response.json({
      events: [
        {
          id: '4c530c42-67bf-4cbe-a6f3-2c662564ddd1',
          actorUserId: null,
          actor: null,
          action: 'auth.login_failed',
          targetType: 'auth_session',
          targetId: null,
          courseId: null,
          createdAt: '2026-07-11T10:00:00.000Z',
        },
      ],
    })
  }

  await expect(
    getAdminAuditEvents(5, { fetchImpl: fetchMock }),
  ).resolves.toEqual([
    expect.objectContaining({
      action: 'auth.login_failed',
      targetType: 'auth_session',
    }),
  ])
})
