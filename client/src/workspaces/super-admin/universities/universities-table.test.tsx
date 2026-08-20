import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UniversityItem } from '@/features/universities/universities.schema'
import { UniversitiesTable } from './universities-table'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children?: React.ReactNode
    to: string
    params?: Record<string, string>
  }) => {
    let href = to
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value)
      }
    }
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { back: vi.fn() } }),
}))

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
  studentsCount: 1200,
  instructorsCount: 80,
  coursesCount: 45,
  createdAt: '2026-08-19T10:00:00.000Z',
  updatedAt: '2026-08-19T10:00:00.000Z',
}

describe('UniversitiesTable', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders university rows with link to university detail page', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(<UniversitiesTable universities={[sampleUniversity]} />, { wrapper })

    const link = screen.getByRole('link', { name: 'King Saud University' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute(
      'href',
      '/super-admin/universities/00000000-0000-4000-8000-000000000001',
    )
    expect(screen.getByText('KSU')).toBeInTheDocument()
    expect(screen.getByText('Dr. Fatima')).toBeInTheDocument()
    expect(screen.getByText('fatima@ksu.edu.sa')).toBeInTheDocument()
    expect(screen.getByText('1200')).toBeInTheDocument()
    expect(screen.getByText('Students')).toBeInTheDocument()
  })

  it('confirms a status selected from the actions menu before updating', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(JSON.parse(String(init?.body))).toEqual({ status: 'SUSPENDED' })
        return Response.json({
          university: { ...sampleUniversity, status: 'SUSPENDED' },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(<UniversitiesTable universities={[sampleUniversity]} />, { wrapper })

    await user.click(
      screen.getByRole('button', {
        name: `Actions for ${sampleUniversity.name}`,
      }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: /suspended/i }),
    )

    expect(
      screen.getByRole('heading', { name: /change status to suspended/i }),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /set to suspended/i }))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
  })
})
