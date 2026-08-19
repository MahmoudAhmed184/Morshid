import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UniversityItem } from '@/features/universities/universities.schema'
import { UpdateUniversityStatusDialog } from './update-university-status-dialog'

const sampleUniversity: UniversityItem = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'King Saud University',
  code: 'KSU',
  status: 'ACTIVE',
  owner: {
    id: '00000000-0000-4000-8000-000000000002',
    displayName: 'Dr. Fatima',
    email: 'fatima@ksu.edu.sa',
    status: 'ACTIVE',
  },
  studentsCount: 100,
  instructorsCount: 10,
  coursesCount: 5,
  createdAt: '2026-08-19T10:00:00.000Z',
  updatedAt: '2026-08-19T10:00:00.000Z',
}

describe('UpdateUniversityStatusDialog', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('updates status to SUSPENDED and triggers status update API', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const onOpenChange = vi.fn()

    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body))
        expect(body.status).toBe('SUSPENDED')
        return Response.json({
          university: {
            ...sampleUniversity,
            status: 'SUSPENDED',
          },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(
      <UpdateUniversityStatusDialog
        university={sampleUniversity}
        open={true}
        onOpenChange={onOpenChange}
      />,
      { wrapper },
    )

    expect(screen.getByText('Update University Status')).toBeInTheDocument()

    // Open select dropdown and choose Suspended
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: /suspended/i }))

    expect(
      screen.getByText(
        /suspending this university immediately blocks all administrators/i,
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /save status/i }))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })
})
