import { queryOptions } from '@tanstack/react-query'

import {
  getMaterialUploadConfiguration,
  listCourseMaterials,
} from '@/features/materials/material-ingestion/material-ingestion.api'

interface CourseMaterialScope {
  instructorId: string
  courseId: string
}

const materialPollingIntervalMs = 2_000

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
  return queryOptions({
    queryKey: materialKeys.list({ instructorId, courseId }),
    queryFn: async () => {
      const response = await listCourseMaterials(courseId)
      return response.materials
    },
    refetchInterval: (query) =>
      query.state.error === null &&
      query.state.data?.some((material) => material.status === 'PROCESSING')
        ? materialPollingIntervalMs
        : false,
  })
}
