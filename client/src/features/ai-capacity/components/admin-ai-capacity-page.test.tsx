import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminAiCapacityPage } from './admin-ai-capacity-page'
import { useAuthStore } from '@/features/auth/session/interface/session-store'

describe('AdminAiCapacityPage', () => {
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
        <AdminAiCapacityPage />
      </QueryClientProvider>,
    )
  }

  it('renders operational view with chat pool and embedding cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL | Request) => {
        const urlString = url.toString()
        if (urlString.includes('/api/v1/admin/ai-capacity')) {
          return Promise.resolve(
            Response.json({
              overallStatus: 'Ready',
              disclaimer:
                'Local operational view based on in-memory and cache state. Actual upstream Google Cloud quotas, billing accounts, and project configurations are managed in Google Cloud Console and may differ.',
              chatPool: {
                status: 'Ready',
                totalProjects: 2,
                availableProjects: 2,
                cooledDownProjects: 0,
                cooldownDetails: [],
              },
              embedding: {
                status: 'Ready',
                provider: 'gemini',
                model: 'gemini-embedding-2',
                dimensions: 1536,
                quotaDimensions: [
                  {
                    name: 'requests_minute',
                    mode: 'token_bucket',
                    capacity: 60,
                    availableOrUsed: 60,
                    windowMs: 60000,
                    status: 'Ready',
                  },
                ],
              },
              observedAt: '2026-08-20T10:00:00.000Z',
            }),
          )
        }
        return Promise.reject(new Error(`Unhandled request: ${urlString}`))
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('chat-pool-card')).toBeInTheDocument()
      expect(screen.getByTestId('embedding-quota-card')).toBeInTheDocument()
    })

    expect(screen.getByText('Local Operational View')).toBeInTheDocument()
    expect(screen.getByText('Total Projects')).toBeInTheDocument()
    expect(screen.getByText('Requests / Minute')).toBeInTheDocument()
  })
})
