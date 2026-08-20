import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminAllowancePolicyPage } from './admin-allowance-policy-page'
import { useAuthStore } from '@/features/auth/session/interface/session-store'

describe('AdminAllowancePolicyPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'admin-01',
        email: 'admin@example.test',
        displayName: 'Admin User',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      tokenType: 'Bearer',
      accessToken: 'test-token',
      accessTokenExpiresAt: '2026-08-20T12:00:00.000Z',
      isAuthenticated: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderPage(scope: 'TUTORING' | 'REVIEW') {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <AdminAllowancePolicyPage scope={scope} />
      </QueryClientProvider>,
    )
  }

  it('renders default policy and course overrides for tutoring', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL | Request) => {
        const urlString = url.toString()
        if (urlString.includes('/api/v1/admin/allowances/defaults')) {
          return Promise.resolve(
            Response.json({
              defaults: [
                {
                  scope: 'TUTORING',
                  defaultLimit: 30,
                  updatedAt: '2026-08-20T00:00:00.000Z',
                },
                {
                  scope: 'REVIEW',
                  defaultLimit: 3,
                  updatedAt: '2026-08-20T00:00:00.000Z',
                },
              ],
            }),
          )
        }
        if (urlString.includes('/api/v1/admin/allowances/overrides')) {
          return Promise.resolve(
            Response.json({
              overrides: [
                {
                  id: 'ovr-1',
                  courseId: '11111111-1111-4111-8111-111111111111',
                  scope: 'TUTORING',
                  overrideLimit: 50,
                  updatedAt: '2026-08-20T00:00:00.000Z',
                },
              ],
            }),
          )
        }
        if (urlString.includes('/api/v1/admin/courses')) {
          return Promise.resolve(
            Response.json({
              courses: [
                {
                  id: '11111111-1111-4111-8111-111111111111',
                  code: 'CS101',
                  title: 'Introduction to Computer Science',
                  adminMetadata: {
                    createdById: null,
                    createdBy: null,
                    createdAt: '2026-08-20T00:00:00.000Z',
                    updatedAt: '2026-08-20T00:00:00.000Z',
                    memberships: [],
                    memberCount: 0,
                    instructorCount: 0,
                    studentCount: 0,
                    materialCount: 0,
                    activeMaterialCount: 0,
                  },
                },
              ],
            }),
          )
        }
        return Promise.reject(new Error(`Unhandled request: ${urlString}`))
      }),
    )

    renderPage('TUTORING')

    await waitFor(() => {
      expect(screen.getByTestId('policy-default-card')).toBeInTheDocument()
      expect(screen.getByTestId('course-overrides-card')).toBeInTheDocument()
      expect(screen.getByText('30 / day')).toBeInTheDocument()
      expect(screen.getByText('50 / day')).toBeInTheDocument()
      expect(screen.getByText(/CS101/)).toBeInTheDocument()
    })
  })
})
