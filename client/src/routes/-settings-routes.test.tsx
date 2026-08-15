import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import type {
  AuthRole,
  AuthSession,
} from '@/features/auth/session/session.schema'
import { routeTree } from '@/routeTree.gen'
import { createAppQueryClient } from '@/lib/query/query-client'

function createSession(role: AuthRole): AuthSession {
  return {
    tokenType: 'Bearer',
    user: {
      id: `${role.toLowerCase()}-user`,
      email: `${role.toLowerCase()}@morshid.demo`,
      displayName: `${role} User`,
      role,
      status: 'ACTIVE',
    },
    accessToken: `${role.toLowerCase()}-access-token`,
    accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
  }
}

async function loadRoute(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] })
  const router = createRouter({
    routeTree,
    history,
    context: { queryClient: createAppQueryClient() },
  })

  await router.load()

  return router.state.location.pathname
}

describe('Settings route shell and deep linking', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('Student settings routes', () => {
    beforeEach(() => {
      const session = createSession('STUDENT')
      useAuthStore.getState().setSession(session)
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) =>
          String(input).endsWith('/api/v1/courses')
            ? Response.json({ courses: [] })
            : Response.json({ user: session.user }),
        ),
      )
    })

    it('redirects /settings index to /settings/account', async () => {
      await expect(loadRoute('/settings')).resolves.toBe('/settings/account')
    })

    it('loads all 5 approved student tabs directly via deep links', async () => {
      await expect(loadRoute('/settings/account')).resolves.toBe(
        '/settings/account',
      )
      await expect(loadRoute('/settings/appearance')).resolves.toBe(
        '/settings/appearance',
      )
      await expect(loadRoute('/settings/learning')).resolves.toBe(
        '/settings/learning',
      )
      await expect(loadRoute('/settings/usage')).resolves.toBe(
        '/settings/usage',
      )
      await expect(loadRoute('/settings/security')).resolves.toBe(
        '/settings/security',
      )
    })
  })

  describe('Instructor settings routes', () => {
    beforeEach(() => {
      const session = createSession('INSTRUCTOR')
      useAuthStore.getState().setSession(session)
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) =>
          String(input).endsWith('/api/v1/courses')
            ? Response.json({ courses: [] })
            : Response.json({ user: session.user }),
        ),
      )
    })

    it('redirects /instructor/settings index to /instructor/settings/account', async () => {
      await expect(loadRoute('/instructor/settings')).resolves.toBe(
        '/instructor/settings/account',
      )
    })

    it('loads all 4 approved instructor tabs directly via deep links', async () => {
      await expect(loadRoute('/instructor/settings/account')).resolves.toBe(
        '/instructor/settings/account',
      )
      await expect(loadRoute('/instructor/settings/appearance')).resolves.toBe(
        '/instructor/settings/appearance',
      )
      await expect(loadRoute('/instructor/settings/workspace')).resolves.toBe(
        '/instructor/settings/workspace',
      )
      await expect(loadRoute('/instructor/settings/security')).resolves.toBe(
        '/instructor/settings/security',
      )
    })
  })

  describe('Admin settings routes', () => {
    beforeEach(() => {
      const session = createSession('ADMIN')
      useAuthStore.getState().setSession(session)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ user: session.user })),
      )
    })

    it('redirects /admin/settings index to /admin/settings/account', async () => {
      await expect(loadRoute('/admin/settings')).resolves.toBe(
        '/admin/settings/account',
      )
    })

    it('loads all 7 approved admin tabs directly via deep links', async () => {
      await expect(loadRoute('/admin/settings/account')).resolves.toBe(
        '/admin/settings/account',
      )
      await expect(loadRoute('/admin/settings/appearance')).resolves.toBe(
        '/admin/settings/appearance',
      )
      await expect(loadRoute('/admin/settings/usage')).resolves.toBe(
        '/admin/settings/usage',
      )
      await expect(loadRoute('/admin/settings/review-policy')).resolves.toBe(
        '/admin/settings/review-policy',
      )
      await expect(loadRoute('/admin/settings/materials')).resolves.toBe(
        '/admin/settings/materials',
      )
      await expect(loadRoute('/admin/settings/security')).resolves.toBe(
        '/admin/settings/security',
      )
      await expect(loadRoute('/admin/settings/ai-capacity')).resolves.toBe(
        '/admin/settings/ai-capacity',
      )
    })
  })

  describe('Role boundary enforcement on settings routes', () => {
    it('redirects unauthenticated users visiting settings to /login', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          Response.json(
            { code: 'INVALID_REFRESH_TOKEN', message: 'Unauthorized' },
            { status: 401 },
          ),
        ),
      )

      await expect(loadRoute('/settings/account')).resolves.toBe('/login')
      await expect(loadRoute('/instructor/settings/account')).resolves.toBe(
        '/login',
      )
      await expect(loadRoute('/admin/settings/account')).resolves.toBe('/login')
    })

    it('prevents students from accessing instructor and admin settings', async () => {
      const session = createSession('STUDENT')
      useAuthStore.getState().setSession(session)
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) =>
          String(input).endsWith('/api/v1/courses')
            ? Response.json({ courses: [] })
            : Response.json({ user: session.user }),
        ),
      )

      await expect(loadRoute('/instructor/settings/account')).resolves.toBe(
        '/chat',
      )
      await expect(loadRoute('/admin/settings/account')).resolves.toBe('/chat')
    })

    it('prevents instructors from accessing student and admin settings', async () => {
      const session = createSession('INSTRUCTOR')
      useAuthStore.getState().setSession(session)
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) =>
          String(input).endsWith('/api/v1/courses')
            ? Response.json({ courses: [] })
            : Response.json({ user: session.user }),
        ),
      )

      await expect(loadRoute('/settings/account')).resolves.toBe('/instructor')
      await expect(loadRoute('/admin/settings/account')).resolves.toBe(
        '/instructor',
      )
    })

    it('prevents admins from accessing student and instructor settings', async () => {
      const session = createSession('ADMIN')
      useAuthStore.getState().setSession(session)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ user: session.user })),
      )

      await expect(loadRoute('/settings/account')).resolves.toBe('/admin')
      await expect(loadRoute('/instructor/settings/account')).resolves.toBe(
        '/admin',
      )
    })
  })
})
