import { describe, expect, it } from 'vitest'

import { getAuditEvents } from './audit.api'

describe('getAuditEvents', () => {
  it('loads recent audit events from the admin API with numeric limit', async () => {
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
        total: 1,
        page: 1,
        limit: 5,
        totalPages: 1,
      })
    }

    const result = await getAuditEvents(5, { fetchImpl: fetchMock })
    expect(result.events).toEqual([
      expect.objectContaining({
        action: 'auth.login_failed',
        targetType: 'auth_session',
      }),
    ])
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(1)
  })

  it('sends structured search, filter, and pagination query parameters', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      expect(url.pathname).toBe('/api/v1/admin/audit')
      expect(url.searchParams.get('page')).toBe('2')
      expect(url.searchParams.get('limit')).toBe('10')
      expect(url.searchParams.get('search')).toBe('admin')
      expect(url.searchParams.get('targetType')).toBe('user')
      expect(url.searchParams.get('action')).toBe('admin.account_created')
      expect(url.searchParams.get('courseId')).toBe(
        '00000000-0000-4000-8000-000000000001',
      )
      expect(url.searchParams.get('actorUserId')).toBe(
        '00000000-0000-4000-8000-000000000002',
      )
      expect(url.searchParams.get('startDate')).toBe('2026-08-01')
      expect(url.searchParams.get('endDate')).toBe('2026-08-19')
      expect(init?.method).toBe('GET')

      return Response.json({
        events: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 1,
      })
    }

    const result = await getAuditEvents(
      {
        page: 2,
        limit: 10,
        search: 'admin',
        targetType: 'user',
        action: 'admin.account_created',
        courseId: '00000000-0000-4000-8000-000000000001',
        actorUserId: '00000000-0000-4000-8000-000000000002',
        startDate: '2026-08-01',
        endDate: '2026-08-19',
      },
      { fetchImpl: fetchMock },
    )

    expect(result.events).toHaveLength(0)
    expect(result.page).toBe(2)
  })
})
