import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UniversityItem } from '@/features/universities/universities.schema'
import { EditUniversityDialog } from './edit-university-dialog'

const mockUniversity: UniversityItem = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'King Saud University',
  code: 'KSU',
  status: 'ACTIVE',
  owner: {
    id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    displayName: 'Dr. Fatima Al-Otaibi',
    email: 'admin@ksu.edu.sa',
    status: 'ACTIVE',
  },
  studentsCount: 1250,
  instructorsCount: 45,
  coursesCount: 30,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-20T12:00:00.000Z',
}

describe('EditUniversityDialog', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows only university fields and submits an institution update', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body))
        expect(body.name).toBe('King Saud University Updated')
        return Response.json({
          university: {
            ...mockUniversity,
            name: 'King Saud University Updated',
          },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const onOpenChange = vi.fn()

    render(
      <EditUniversityDialog
        university={mockUniversity}
        open={true}
        onOpenChange={onOpenChange}
      />,
      { wrapper },
    )

    // Check title and fields
    expect(screen.getByText('Edit University')).toBeInTheDocument()
    const nameInput = screen.getByLabelText(/university name/i)
    expect(nameInput).toHaveValue('King Saud University')

    expect(
      screen.queryByDisplayValue('Dr. Fatima Al-Otaibi'),
    ).not.toBeInTheDocument()

    // Modify university name
    await user.clear(nameInput)
    await user.type(nameInput, 'King Saud University Updated')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })

  it('shows only manager fields when editing the manager', () => {
    const queryClient = new QueryClient()
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(
      <EditUniversityDialog
        university={mockUniversity}
        open={true}
        onOpenChange={vi.fn()}
        section="manager"
      />,
      { wrapper },
    )

    expect(screen.getByText('Edit Manager')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Dr. Fatima Al-Otaibi')).toBeInTheDocument()
    expect(screen.getByDisplayValue('admin@ksu.edu.sa')).toBeInTheDocument()
    expect(screen.queryByLabelText(/university name/i)).not.toBeInTheDocument()
  })
})
