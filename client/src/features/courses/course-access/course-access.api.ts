import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import { courseAccessResponseSchema } from '@/features/courses/course-access/course-access.schema'

export type { StudentCourseAccess } from '@/features/courses/course-access/course-access.schema'

export async function getStudentCourseAccess(options: ApiFetchOptions = {}) {
  const response = await apiJson<unknown>('/api/v1/courses', {
    ...options,
    method: 'GET',
  })

  return courseAccessResponseSchema.parse(response).courses
}
