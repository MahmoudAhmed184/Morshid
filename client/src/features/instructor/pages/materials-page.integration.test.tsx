import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { instructorCoursesQueryOptions } from '@/features/instructor/data/instructor-dashboard.queries'
import { listInstructorMaterials } from '@/features/instructor/data/instructor-materials.api'
import type * as InstructorMaterialsApi from '@/features/instructor/data/instructor-materials.api'
import { instructorMaterialKeys } from '@/features/instructor/data/instructor-materials.queries'

import { MaterialsPage } from './materials-page'

vi.mock(
  '@/features/instructor/data/instructor-materials.api',
  async (importOriginal) => {
    const actual = await importOriginal<typeof InstructorMaterialsApi>()

    return {
      ...actual,
      listInstructorMaterials: vi.fn(),
    }
  },
)

const instructorId = 'd005dfdb-aabe-4f65-a2dc-61e75ba203a6'
const course = {
  id: 'f5bb713c-09b7-42d3-acf3-02f39a902e5a',
  code: 'CS-201',
  title: 'Data Structures',
  membershipRole: 'INSTRUCTOR',
  canManageMaterials: true,
} as const
const material = {
  id: '3e533215-42ba-42b8-ad6a-404e7bb3c8d7',
  courseId: course.id,
  title: 'Linked Lists',
  originalFilename: 'linked-lists.pdf',
  status: 'READY',
  extractedTextLength: 4_820,
  chunkCount: 6,
  errorMessage: null,
  createdAt: '2026-07-21T12:00:00.000Z',
  updatedAt: '2026-07-21T12:01:00.000Z',
} as const
const session: AuthSession = {
  user: {
    id: instructorId,
    email: 'instructor@morshid.demo',
    displayName: 'Demo Instructor',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    courses: [],
  },
  tokenType: 'Bearer',
  accessToken: 'instructor-access-token',
  accessTokenExpiresAt: '2027-07-21T12:00:00.000Z',
  refreshToken: 'instructor-refresh-token',
  refreshTokenExpiresAt: '2027-07-28T12:00:00.000Z',
}

const listInstructorMaterialsMock = vi.mocked(listInstructorMaterials)

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
  queryClient.setQueryData(
    instructorCoursesQueryOptions(instructorId).queryKey,
    [course],
  )
  queryClient.setQueryData(
    instructorMaterialKeys.uploadConfiguration(instructorId),
    {
      maxUploadBytes: 1_048_576,
      acceptedMimeType: 'application/pdf',
      acceptedFileExtension: '.pdf',
    },
  )

  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <MaterialsPage />
    </QueryClientProvider>,
  )

  return { queryClient, ...renderResult }
}

describe('MaterialsPage query recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    window.localStorage.clear()
    useAuthStore.getState().setSession(session)
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('renders material data after the failed request itself is retried successfully', async () => {
    listInstructorMaterialsMock
      .mockRejectedValueOnce(new Error('materials unavailable'))
      .mockResolvedValueOnce({ materials: [material] })
    const user = userEvent.setup()
    const { queryClient } = renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Unable to load materials' }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() =>
      expect(listInstructorMaterialsMock).toHaveBeenCalledTimes(2),
    )
    await waitFor(() =>
      expect(
        queryClient.getQueryData(
          instructorMaterialKeys.list({ instructorId, courseId: course.id }),
        ),
      ).toEqual([material]),
    )

    expect(
      await screen.findByRole('heading', { name: material.title }),
    ).toBeVisible()
  })
})
