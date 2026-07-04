import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DevelopmentStatusPage } from './development-status-page'

describe('DevelopmentStatusPage', () => {
  it('renders the scaffold status page', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <DevelopmentStatusPage />
      </QueryClientProvider>,
    )

    expect(
      screen.getByRole('heading', { name: /morshid development status/i }),
    ).toBeDefined()
    expect(screen.getByText('TanStack Start React')).toBeDefined()
    expect(screen.getByText('http://localhost:4000')).toBeDefined()
  })
})
