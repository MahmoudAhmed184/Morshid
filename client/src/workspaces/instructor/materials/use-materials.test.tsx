import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/session/session.schema'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import {
  deleteCourseMaterial,
  getMaterialUploadConfiguration,
  listCourseMaterials,
  uploadCourseMaterial,
} from '@/features/materials/material-ingestion/material-ingestion.api'
import type { MaterialsResponse } from '@/features/materials/material-ingestion/material.schema'
import { materialKeys } from '@/features/materials/material-ingestion/material-ingestion.queries'

import {
  useCourseMaterials,
  useDeleteCourseMaterial,
  useMaterialUploadConfiguration,
  useUploadCourseMaterial,
} from './use-materials'

vi.mock('@/features/materials/material-ingestion/material-ingestion.api')

const listCourseMaterialsMock = vi.mocked(listCourseMaterials)
const getMaterialUploadConfigurationMock = vi.mocked(
  getMaterialUploadConfiguration,
)
const uploadCourseMaterialMock = vi.mocked(uploadCourseMaterial)
const deleteCourseMaterialMock = vi.mocked(deleteCourseMaterial)

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
const processingMaterial = {
  ...material,
  status: 'PROCESSING',
  extractedTextLength: null,
  chunkCount: null,
} as const

const instructorSession: AuthSession = {
  user: {
    id: instructorId,
    email: 'instructor@morshid.demo',
    displayName: 'Demo Instructor',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
  },
  tokenType: 'Bearer',
  accessToken: 'instructor-access-token',
  accessTokenExpiresAt: '2027-07-21T12:00:00.000Z',
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
    vi.useRealTimers()
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('exposes the materials loading state', () => {
    listCourseMaterialsMock.mockReturnValue(new Promise(() => undefined))

    const { result } = renderHook(() => useCourseMaterials(courseId), {
      wrapper: createWrapper(createQueryClient()),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('loads the parsed material list for the selected course', async () => {
    listCourseMaterialsMock.mockResolvedValue({ materials: [material] })

    const { result } = renderHook(() => useCourseMaterials(courseId), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() =>
      expect(result.current.data?.pages[0]?.materials).toEqual([material]),
    )
    expect(listCourseMaterialsMock).toHaveBeenCalledWith(
      courseId,
      {},
      { cursor: undefined },
    )
  })

  it('loads the server-derived PDF upload configuration once', async () => {
    const configuration = {
      maxUploadBytes: 1_048_576,
      acceptedMimeType: 'application/pdf',
      acceptedFileExtension: '.pdf',
    } as const
    getMaterialUploadConfigurationMock.mockResolvedValue(configuration)

    const { result } = renderHook(() => useMaterialUploadConfiguration(), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => expect(result.current.data).toEqual(configuration))
    expect(getMaterialUploadConfigurationMock).toHaveBeenCalledOnce()
  })

  it('exposes a materials request error', async () => {
    const requestError = new Error('Unable to load materials')
    listCourseMaterialsMock.mockRejectedValue(requestError)

    const { result } = renderHook(() => useCourseMaterials(courseId), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => expect(result.current.error).toBe(requestError))
  })

  it('polls a mounted processing list until terminal and then stops', async () => {
    vi.useFakeTimers()
    listCourseMaterialsMock
      .mockResolvedValueOnce({ materials: [processingMaterial] })
      .mockResolvedValueOnce({ materials: [material] })
    const queryClient = createQueryClient()

    const { result } = renderHook(() => useCourseMaterials(courseId), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() =>
      expect(result.current.data?.pages[0]?.materials[0]?.status).toBe(
        'PROCESSING',
      ),
    )
    expect(listCourseMaterialsMock).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(2_000))
    await vi.waitFor(() =>
      expect(result.current.data?.pages[0]?.materials[0]?.status).toBe('READY'),
    )

    await act(() => vi.advanceTimersByTimeAsync(6_000))
    expect(listCourseMaterialsMock).toHaveBeenCalledTimes(2)
  })

  it('cancels scheduled processing polling when the component unmounts', async () => {
    vi.useFakeTimers()
    listCourseMaterialsMock.mockResolvedValue({
      materials: [processingMaterial],
    })

    const { result, unmount } = renderHook(() => useCourseMaterials(courseId), {
      wrapper: createWrapper(createQueryClient()),
    })

    await vi.waitFor(() =>
      expect(result.current.data?.pages[0]?.materials[0]?.status).toBe(
        'PROCESSING',
      ),
    )
    unmount()

    await act(() => vi.advanceTimersByTimeAsync(6_000))
    expect(listCourseMaterialsMock).toHaveBeenCalledOnce()
  })

  it('surfaces polling and repeated retry failures before a manual retry succeeds', async () => {
    vi.useFakeTimers()
    listCourseMaterialsMock
      .mockResolvedValueOnce({ materials: [processingMaterial] })
      .mockRejectedValueOnce(new Error('polling unavailable'))
      .mockRejectedValueOnce(new Error('retry still unavailable'))
      .mockResolvedValueOnce({ materials: [material] })
    const queryClient = createQueryClient()

    const { result } = renderHook(() => useCourseMaterials(courseId), {
      wrapper: createWrapper(queryClient),
    })

    await vi.waitFor(() =>
      expect(result.current.data?.pages[0]?.materials[0]?.status).toBe(
        'PROCESSING',
      ),
    )
    expect(result.current.isRefetchError).toBe(false)
    await act(() => vi.advanceTimersByTimeAsync(2_000))
    await vi.waitFor(() =>
      expect(listCourseMaterialsMock).toHaveBeenCalledTimes(2),
    )
    await vi.waitFor(() => expect(result.current.isRefetchError).toBe(true))
    expect((result.current.error as Error | null)?.message).toBe(
      'polling unavailable',
    )

    await act(async () => {
      await result.current.refetch()
    })
    expect(result.current.isRefetchError).toBe(true)
    expect(result.current.data?.pages[0]?.materials[0]?.status).toBe(
      'PROCESSING',
    )

    await act(async () => {
      await result.current.refetch()
    })
    await vi.waitFor(() =>
      expect(result.current.data?.pages[0]?.materials[0]?.status).toBe('READY'),
    )
    await vi.waitFor(() => expect(result.current.isRefetchError).toBe(false))
    expect(listCourseMaterialsMock).toHaveBeenCalledTimes(4)
  })

  it('uploads a material and invalidates only its course material list', async () => {
    const queryClient = createQueryClient()
    const selectedListKey = materialKeys.list({
      instructorId,
      courseId,
    })
    const unrelatedListKey = materialKeys.list({
      instructorId,
      courseId: '55b55350-4cc4-4cf4-9e00-689c13359c8f',
    })
    queryClient.setQueryData(selectedListKey, {
      pages: [{ materials: [] }],
      pageParams: [undefined],
    })
    queryClient.setQueryData(unrelatedListKey, {
      pages: [{ materials: [] }],
      pageParams: [undefined],
    })
    const file = new File(['%PDF-1.7'], 'python-functions.pdf', {
      type: 'application/pdf',
    })
    uploadCourseMaterialMock.mockResolvedValue({
      material: {
        ...material,
        status: 'PROCESSING',
        extractedTextLength: null,
        chunkCount: null,
      },
    })

    const { result } = renderHook(() => useUploadCourseMaterial(), {
      wrapper: createWrapper(queryClient),
    })

    await act(() =>
      result.current.mutateAsync({
        courseId,
        title: 'Python Functions',
        file,
      }),
    )

    expect(uploadCourseMaterialMock).toHaveBeenCalledWith(courseId, {
      title: 'Python Functions',
      file,
    })
    expect(queryClient.getQueryState(selectedListKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(unrelatedListKey)?.isInvalidated).toBe(
      false,
    )
  })

  it('deletes a material and updates the infinite query cache', async () => {
    deleteCourseMaterialMock.mockResolvedValue(undefined)
    const queryClient = createQueryClient()
    const selectedListKey = materialKeys.list({ instructorId, courseId })
    queryClient.setQueryData(selectedListKey, {
      pages: [{ materials: [material] }],
      pageParams: [undefined],
    })

    const { result } = renderHook(() => useDeleteCourseMaterial(), {
      wrapper: createWrapper(queryClient),
    })

    await act(() =>
      result.current.mutateAsync({
        courseId,
        materialId,
      }),
    )

    expect(deleteCourseMaterialMock).toHaveBeenCalledWith(courseId, materialId)
    const cached =
      queryClient.getQueryData<
        InfiniteData<MaterialsResponse, string | undefined>
      >(selectedListKey)
    expect(cached?.pages[0]?.materials).toHaveLength(0)
    expect(queryClient.getQueryState(selectedListKey)?.isInvalidated).toBe(true)
  })
})
