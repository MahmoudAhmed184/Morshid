import { queryOptions } from '@tanstack/react-query'

import {
  getInstructorMaterialStatus,
  listInstructorMaterials,
} from '@/features/instructor/data/instructor-materials.api'

interface InstructorCourseScope {
  instructorId: string
  courseId: string
}

interface InstructorMaterialScope extends InstructorCourseScope {
  materialId: string
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
  statuses: ({ instructorId, courseId }: InstructorCourseScope) =>
    [
      ...instructorMaterialKeys.all(instructorId),
      'courses',
      courseId,
      'status',
    ] as const,
  status: ({ instructorId, courseId, materialId }: InstructorMaterialScope) =>
    [
      ...instructorMaterialKeys.statuses({ instructorId, courseId }),
      materialId,
    ] as const,
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
      query.state.data?.some((material) => material.status === 'PROCESSING')
        ? materialPollingIntervalMs
        : false,
  })
}

export function instructorMaterialStatusQueryOptions({
  instructorId,
  courseId,
  materialId,
}: InstructorMaterialScope) {
  return queryOptions({
    queryKey: instructorMaterialKeys.status({
      instructorId,
      courseId,
      materialId,
    }),
    queryFn: () => getInstructorMaterialStatus(courseId, materialId),
    refetchInterval: (query) =>
      query.state.data?.status === 'PROCESSING'
        ? materialPollingIntervalMs
        : false,
  })
}
