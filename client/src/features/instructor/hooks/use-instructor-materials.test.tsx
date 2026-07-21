import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  getInstructorMaterialStatus,
  listInstructorMaterials,
  uploadInstructorMaterial,
} from '@/features/instructor/data/instructor-materials.api'
import { instructorMaterialKeys } from '@/features/instructor/data/instructor-materials.queries'

import {
  useInstructorMaterialsByCourse,
  useInstructorMaterials,
  useInstructorMaterialStatus,
  useUploadInstructorMaterial,
} from './use-instructor-materials'

vi.mock('@/features/instructor/data/instructor-materials.api')

const listInstructorMaterialsMock = vi.mocked(listInstructorMaterials)
const getInstructorMaterialStatusMock = vi.mocked(getInstructorMaterialStatus)
const uploadInstructorMaterialMock = vi.mocked(uploadInstructorMaterial)

const instructorId = 'd005dfdb-aabe-4f65-a2dc-61e75ba203a6'
const courseId = 'f5bb713c-09b7-42d3-acf3-02f39a902e5a'
const materialId = '3e533215-42ba-42b8-ad6a-404e7bb3c8d7'
const material = {
  id: materialId,
  courseId,
  title: 'Python Functions',
  originalFilename: 'python-functions.pdf',
  status: 'READY',
  extractedTextLength: 4_820,
  chunkCount: 6,
  errorMessage: null,
  createdAt: '2026-07-21T12:00:00.000Z',
  updatedAt: '2026-07-21T12:01:00.000Z',
} as const

const instructorSession: AuthSession = {
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('Instructor material hooks', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    window.localStorage.clear()
    useAuthStore.getState().setSession(instructorSession)
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('exposes the materials loading state', () => {
    listInstructorMaterialsMock.mockReturnValue(new Promise(() => undefined))

    const { result } = renderHook(() => useInstructorMaterials(courseId), {
      wrapper: createWrapper(createQueryClient()),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('loads the parsed material list for the selected course', async () => {
    listInstructorMaterialsMock.mockResolvedValue({ materials: [material] })

    const { result } = renderHook(() => useInstructorMaterials(courseId), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => expect(result.current.data).toEqual([material]))
    expect(listInstructorMaterialsMock).toHaveBeenCalledWith(courseId)
  })

  it('loads independently scoped material lists for multiple courses', async () => {
    const secondCourseId = '55b55350-4cc4-4cf4-9e00-689c13359c8f'
    const secondMaterial = {
      ...material,
      id: 'b1c32511-1348-411d-be9b-6879be6af035',
      courseId: secondCourseId,
      title: 'Graph Theory',
    }
    listInstructorMaterialsMock.mockImplementation(async (requestedCourseId) =>
      requestedCourseId === secondCourseId
        ? { materials: [secondMaterial] }
        : { materials: [material] },
    )

    const { result } = renderHook(
      () => useInstructorMaterialsByCourse([courseId, secondCourseId]),
      { wrapper: createWrapper(createQueryClient()) },
    )

    await waitFor(() =>
      expect(result.current.map((query) => query.data)).toEqual([
        [material],
        [secondMaterial],
      ]),
    )
    expect(listInstructorMaterialsMock).toHaveBeenCalledWith(courseId)
    expect(listInstructorMaterialsMock).toHaveBeenCalledWith(secondCourseId)
  })

  it('exposes a materials request error', async () => {
    const requestError = new Error('Unable to load materials')
    listInstructorMaterialsMock.mockRejectedValue(requestError)

    const { result } = renderHook(() => useInstructorMaterials(courseId), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => expect(result.current.error).toBe(requestError))
  })

  it('uploads a material and invalidates only its course material list', async () => {
    const queryClient = createQueryClient()
    const selectedListKey = instructorMaterialKeys.list({
      instructorId,
      courseId,
    })
    const unrelatedListKey = instructorMaterialKeys.list({
      instructorId,
      courseId: '55b55350-4cc4-4cf4-9e00-689c13359c8f',
    })
    queryClient.setQueryData(selectedListKey, [])
    queryClient.setQueryData(unrelatedListKey, [])
    const file = new File(['%PDF-1.7'], 'python-functions.pdf', {
      type: 'application/pdf',
    })
    uploadInstructorMaterialMock.mockResolvedValue({
      material: {
        ...material,
        status: 'PROCESSING',
        extractedTextLength: null,
        chunkCount: null,
      },
    })

    const { result } = renderHook(() => useUploadInstructorMaterial(), {
      wrapper: createWrapper(queryClient),
    })

    await act(() =>
      result.current.mutateAsync({
        courseId,
        title: 'Python Functions',
        file,
      }),
    )

    expect(uploadInstructorMaterialMock).toHaveBeenCalledWith(courseId, {
      title: 'Python Functions',
      file,
    })
    expect(queryClient.getQueryState(selectedListKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(unrelatedListKey)?.isInvalidated).toBe(
      false,
    )
  })

  it('loads material status only with complete Instructor material scope', async () => {
    const processingStatus = {
      id: materialId,
      status: 'PROCESSING',
      extractedTextLength: null,
      chunkCount: null,
      errorMessage: null,
      updatedAt: '2026-07-21T12:01:00.000Z',
    } as const
    getInstructorMaterialStatusMock.mockResolvedValue(processingStatus)
    const queryClient = createQueryClient()

    const enabledStatus = renderHook(
      () => useInstructorMaterialStatus(courseId, materialId),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() =>
      expect(enabledStatus.result.current.data).toEqual(processingStatus),
    )
    expect(getInstructorMaterialStatusMock).toHaveBeenCalledWith(
      courseId,
      materialId,
    )

    const disabledStatus = renderHook(
      () => useInstructorMaterialStatus(courseId, undefined),
      { wrapper: createWrapper(queryClient) },
    )
    expect(disabledStatus.result.current.fetchStatus).toBe('idle')
  })
})
