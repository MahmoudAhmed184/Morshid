import { queryOptions } from '@tanstack/react-query'

import {
  getInstructorMaterialUploadConfiguration,
  listInstructorMaterials,
} from '@/features/instructor/data/instructor-materials.api'

interface InstructorCourseScope {
  instructorId: string
  courseId: string
}

const materialPollingIntervalMs = 2_000

export const instructorMaterialKeys = {
  all: (instructorId: string) =>
    ['instructor', instructorId, 'materials'] as const,
  lists: (instructorId: string) =>
    [...instructorMaterialKeys.all(instructorId), 'list'] as const,
  list: ({ instructorId, courseId }: InstructorCourseScope) =>
    [
      ...instructorMaterialKeys.lists(instructorId),
      'courses',
      courseId,
    ] as const,
  uploadConfiguration: (instructorId: string) =>
    [
      ...instructorMaterialKeys.all(instructorId),
      'upload-configuration',
    ] as const,
}

export function instructorMaterialUploadConfigurationQueryOptions(
  instructorId: string,
) {
  return queryOptions({
    queryKey: instructorMaterialKeys.uploadConfiguration(instructorId),
    queryFn: getInstructorMaterialUploadConfiguration,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function instructorMaterialsQueryOptions({
  instructorId,
  courseId,
}: InstructorCourseScope) {
  return queryOptions({
    queryKey: instructorMaterialKeys.list({ instructorId, courseId }),
    queryFn: async () => {
      const response = await listInstructorMaterials(courseId)
      return response.materials
    },
    refetchInterval: (query) =>
      query.state.error === null &&
      query.state.data?.some((material) => material.status === 'PROCESSING')
        ? materialPollingIntervalMs
        : false,
  })
}
