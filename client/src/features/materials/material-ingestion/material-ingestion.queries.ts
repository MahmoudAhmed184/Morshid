import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import type {
  Material,
  MaterialsResponse,
} from '@/features/materials/material-ingestion/material.schema'

import {
  getMaterialUploadConfiguration,
  listCourseMaterials,
} from '@/features/materials/material-ingestion/material-ingestion.api'

interface CourseMaterialScope {
  instructorId: string
  courseId: string
}

const materialPollingIntervalMs = 2_000

interface MaterialPollingQuery {
  state: {
    error: unknown
    data?: InfiniteData<MaterialsResponse, string | undefined> | Material[]
  }
}

function materialPollingInterval(query: MaterialPollingQuery) {
  if (query.state.error !== null || query.state.data === undefined) return false
  const materials = Array.isArray(query.state.data)
    ? query.state.data
    : query.state.data.pages.flatMap((page) => page.materials)

  return materials.some((material) => material.status === 'PROCESSING')
    ? materialPollingIntervalMs
    : false
}

export const materialKeys = {
  all: (instructorId: string) =>
    ['instructor', instructorId, 'materials'] as const,
  lists: (instructorId: string) =>
    [...materialKeys.all(instructorId), 'list'] as const,
  list: ({ instructorId, courseId }: CourseMaterialScope) =>
    [...materialKeys.lists(instructorId), 'courses', courseId] as const,
  uploadConfiguration: (instructorId: string) =>
    [...materialKeys.all(instructorId), 'upload-configuration'] as const,
}

export function materialUploadConfigurationQueryOptions(instructorId: string) {
  return queryOptions({
    queryKey: materialKeys.uploadConfiguration(instructorId),
    queryFn: getMaterialUploadConfiguration,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function materialsQueryOptions({
  instructorId,
  courseId,
}: CourseMaterialScope) {
  return infiniteQueryOptions({
    queryKey: materialKeys.list({ instructorId, courseId }),
    queryFn: ({ pageParam }) =>
      listCourseMaterials(courseId, {}, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
    refetchInterval: materialPollingInterval,
  })
}
