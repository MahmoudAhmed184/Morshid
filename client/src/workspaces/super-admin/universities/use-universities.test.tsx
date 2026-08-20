import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { universitiesQueryKeys } from '@/features/universities/universities.queries'
import type { UniversityItem } from '@/features/universities/universities.schema'
import {
  useUniversities,
  useUniversityDetail,
  useUniversityMutations,
} from './use-universities'

const sampleUniversity: UniversityItem = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'King Fahd University',
  code: 'KFUPM',
  status: 'ACTIVE',
  owner: {
    id: '00000000-0000-4000-8000-000000000002',
    displayName: 'Admin User',
    email: 'admin@kfupm.edu.sa',
    status: 'ACTIVE',
  },
  studentsCount: 500,
  instructorsCount: 40,
  coursesCount: 20,
  createdAt: '2026-08-19T10:00:00.000Z',
  updatedAt: '2026-08-19T10:00:00.000Z',
}

describe('useUniversities and useUniversityMutations', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('queries universities with parameters', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          data: [sampleUniversity],
          pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 },
        }),
      ),
    )

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () => useUniversities({ search: 'KFUPM', status: 'ACTIVE' }),
      { wrapper },
    )

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.data).toHaveLength(1)
    expect(result.current.data?.data[0].code).toBe('KFUPM')
  })

  it('queries single university detail', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          university: sampleUniversity,
        }),
      ),
    )

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () => useUniversityDetail(sampleUniversity.id),
      { wrapper },
    )

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.id).toBe(sampleUniversity.id)
  })

  it('invalidates universities cache on create mutation', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    queryClient.setQueryData(universitiesQueryKeys.list({}), {
      data: [sampleUniversity],
      pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          university: { ...sampleUniversity, name: 'Created Uni' },
        }),
      ),
    )

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useUniversityMutations(), { wrapper })

    await act(() =>
      result.current.createUniversity.mutateAsync({
        name: 'Created Uni',
        code: 'CREATED',
        status: 'ACTIVE',
        ownerDisplayName: 'Owner',
        ownerEmail: 'owner@created.edu',
        ownerPassword: 'StrongPassword123!',
      }),
    )

    expect(
      queryClient.getQueryState(universitiesQueryKeys.list({}))?.isInvalidated,
    ).toBe(true)
  })
})
