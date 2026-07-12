import { queryOptions, useQuery } from '@tanstack/react-query'

import { apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  courseListResponseSchema,
  courseMaterialsResponseSchema,
  courseMembersResponseSchema,
  courseResponseSchema,
} from '@/features/course/schemas/course.schema'

export async function getCourses(options: ApiFetchOptions = {}) {
  const response = await apiJson<unknown>('/api/v1/admin/courses', {
    ...options,
    method: 'GET',
  })

  return courseListResponseSchema.parse(response).courses
}

export async function getCourse(
  courseId: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(`/api/v1/admin/courses/${courseId}`, {
    ...options,
    method: 'GET',
  })

  return courseResponseSchema.parse(response).course
}

export async function getCourseMembers(
  courseId: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/members`,
    {
      ...options,
      method: 'GET',
    },
  )

  return courseMembersResponseSchema.parse(response).members
}

export async function getCourseMaterials(
  courseId: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/admin/courses/${courseId}/materials`,
    {
      ...options,
      method: 'GET',
    },
  )

  return courseMaterialsResponseSchema.parse(response).materials
}

export function coursesQueryOptions(adminId: string) {
  return queryOptions({
    queryKey: ['admin', adminId, 'courses'],
    queryFn: getCourses,
  })
}

export function courseQueryOptions(adminId: string, courseId: string) {
  return queryOptions({
    queryKey: ['admin', adminId, 'courses', courseId],
    queryFn: () => getCourse(courseId),
  })
}

export function courseMembersQueryOptions(adminId: string, courseId: string) {
  return queryOptions({
    queryKey: ['admin', adminId, 'courses', courseId, 'members'],
    queryFn: () => getCourseMembers(courseId),
  })
}

export function courseMaterialsQueryOptions(adminId: string, courseId: string) {
  return queryOptions({
    queryKey: ['admin', adminId, 'courses', courseId, 'materials'],
    queryFn: () => getCourseMaterials(courseId),
  })
}

export function useCourses() {
  const adminId = useAuthStore((state) => state.user?.id)

  return useQuery({
    ...coursesQueryOptions(adminId ?? 'anonymous'),
    enabled: adminId !== undefined,
  })
}

export function useCourse(courseId: string | undefined) {
  const adminId = useAuthStore((state) => state.user?.id)

  return useQuery({
    ...courseQueryOptions(adminId ?? 'anonymous', courseId ?? 'unknown'),
    enabled: adminId !== undefined && courseId !== undefined,
  })
}

export function useCourseMembers(courseId: string | undefined) {
  const adminId = useAuthStore((state) => state.user?.id)

  return useQuery({
    ...courseMembersQueryOptions(adminId ?? 'anonymous', courseId ?? 'unknown'),
    enabled: adminId !== undefined && courseId !== undefined,
  })
}

export function useCourseMaterials(courseId: string | undefined) {
  const adminId = useAuthStore((state) => state.user?.id)

  return useQuery({
    ...courseMaterialsQueryOptions(
      adminId ?? 'anonymous',
      courseId ?? 'unknown',
    ),
    enabled: adminId !== undefined && courseId !== undefined,
  })
}
