import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CreateUniversityDialog } from './create-university-dialog'

describe('CreateUniversityDialog', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('opens dialog, navigates tabs, fills form, and submits creation request', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body))
        expect(body.name).toBe('Alfaisal University')
        expect(body.code).toBe('ALFAISAL')
        expect(body.owner.displayName).toBe('Prof. Khalid')
        expect(body.owner.email).toBe('khalid@alfaisal.edu')
        return Response.json({
          university: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Alfaisal University',
            code: 'ALFAISAL',
            status: 'ACTIVE',
            owner: {
              id: '00000000-0000-4000-8000-000000000002',
              displayName: 'Prof. Khalid',
              email: 'khalid@alfaisal.edu',
              status: 'ACTIVE',
            },
            studentsCount: 0,
            instructorsCount: 0,
            coursesCount: 0,
            createdAt: '2026-08-19T10:00:00.000Z',
            updatedAt: '2026-08-19T10:00:00.000Z',
          },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(<CreateUniversityDialog />, { wrapper })

    // Open dialog
    await user.click(screen.getByRole('button', { name: /create university/i }))

    expect(
      screen.getByText(
        'Provision a new university tenant along with its initial primary manager account.',
      ),
    ).toBeInTheDocument()

    // Tab 1: Fill university info
    await user.type(
      screen.getByLabelText(/university name/i),
      'Alfaisal University',
    )
    await user.type(screen.getByLabelText(/university code/i), 'alfaisal')

    // Navigate to Tab 2 via Next button
    await user.click(screen.getByRole('button', { name: /next: manager/i }))

    expect(
      screen.queryByText('Owner display name is required'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Owner email is required'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Password must be at least 15 characters'),
    ).not.toBeInTheDocument()

    // Tab 2: Fill manager info
    await user.type(screen.getByLabelText(/manager full name/i), 'Prof. Khalid')
    await user.type(
      screen.getByLabelText(/manager email/i),
      'khalid@alfaisal.edu',
    )
    await user.type(
      screen.getByLabelText(/initial password/i),
      'AlfaisalSecurePassword123!',
    )

    // Test Back button
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByLabelText(/university name/i)).toHaveValue(
      'Alfaisal University',
    )

    // Test switching to Manager tab
    await user.click(screen.getByRole('tab', { name: /manager/i }))
    expect(screen.getByLabelText(/manager full name/i)).toHaveValue(
      'Prof. Khalid',
    )

    // Submit form (finding the submit button inside the dialog)
    const submitButtons = screen.getAllByRole('button', {
      name: /create university/i,
    })
    const dialogSubmitBtn = submitButtons[submitButtons.length - 1]
    await user.click(dialogSubmitBtn)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })

  it('does not show manager validation errors when advancing to manager tab, but shows them on submit', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(<CreateUniversityDialog />, { wrapper })

    // Open dialog
    await user.click(screen.getByRole('button', { name: /create university/i }))

    // Fill university info
    await user.type(
      screen.getByLabelText(/university name/i),
      'Test University',
    )
    await user.type(screen.getByLabelText(/university code/i), 'TEST')

    // Click Next: Manager
    await user.click(screen.getByRole('button', { name: /next: manager/i }))

    // Wait for manager tab content to be in document
    expect(
      await screen.findByLabelText(/manager full name/i),
    ).toBeInTheDocument()

    // Ensure NO manager errors exist upon advancing
    expect(
      screen.queryByText('Owner display name is required'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Owner email is required'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Password must be at least 15 characters'),
    ).not.toBeInTheDocument()

    // Click "Create University" inside the dialog without filling manager fields
    const submitButtons = screen.getAllByRole('button', {
      name: /create university/i,
    })
    const dialogSubmitBtn = submitButtons[submitButtons.length - 1]
    await user.click(dialogSubmitBtn)

    // Now manager validation errors SHOULD appear
    expect(
      screen.getByText('Owner display name is required'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Owner email is required|Invalid email address/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Password must be at least 15 characters'),
    ).toBeInTheDocument()

    // Typing in field should clear its error
    await user.type(screen.getByLabelText(/manager full name/i), 'Dr. John')
    expect(
      screen.queryByText('Owner display name is required'),
    ).not.toBeInTheDocument()
  })
})
