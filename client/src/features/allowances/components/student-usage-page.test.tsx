import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StudentUsagePage } from './student-usage-page'
import { useAuthStore } from '@/features/auth/session/interface/session-store'

describe('StudentUsagePage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'student-01',
        email: 'student@example.test',
        displayName: 'Student One',
        role: 'STUDENT',
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

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <StudentUsagePage />
      </QueryClientProvider>,
    )
  }

  it('renders student tutoring and review allowance cards with limits and reset info', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL | Request) => {
        const urlString = url.toString()
        if (urlString.includes('/api/v1/courses')) {
          return Promise.resolve(
            Response.json({
              courses: [
                {
                  id: 'course-101',
                  code: 'CS101',
                  title: 'Introduction to Computer Science',
                  membershipRole: 'STUDENT',
                },
              ],
            }),
          )
        }
        if (urlString.includes('/api/v1/tutoring/allowance')) {
          return Promise.resolve(
            Response.json({
              scope: 'TUTORING',
              used: 5,
              limit: 30,
              remaining: 25,
              resetAt: '2026-08-21T00:00:00.000Z',
              policyTimeZone: 'Africa/Cairo',
              policyDayWindow: {
                start: '2026-08-20T00:00:00.000Z',
                end: '2026-08-21T00:00:00.000Z',
                timeZone: 'Africa/Cairo',
              },
            }),
          )
        }
        if (urlString.includes('/api/v1/reviews/allowance')) {
          return Promise.resolve(
            Response.json({
              scope: 'REVIEW',
              used: 1,
              limit: 3,
              remaining: 2,
              resetAt: '2026-08-21T00:00:00.000Z',
              policyTimeZone: 'Africa/Cairo',
              policyDayWindow: {
                start: '2026-08-20T00:00:00.000Z',
                end: '2026-08-21T00:00:00.000Z',
                timeZone: 'Africa/Cairo',
              },
            }),
          )
        }
        return Promise.reject(new Error(`Unhandled request: ${urlString}`))
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('tutoring-allowance-card')).toBeInTheDocument()
      expect(screen.getByTestId('review-allowance-card')).toBeInTheDocument()
      expect(screen.getByText('25 remaining')).toBeInTheDocument()
      expect(screen.getByText('2 remaining')).toBeInTheDocument()
      expect(screen.getByText(/CS101/)).toBeInTheDocument()
    })
  })
})
