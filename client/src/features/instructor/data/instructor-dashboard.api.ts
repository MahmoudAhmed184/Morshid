import { apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import { instructorCourseListSchema } from '@/features/instructor/schemas/instructor-course.schema'

export async function getInstructorCourses(options: ApiFetchOptions = {}) {
  const response = await apiJson<unknown>(
    '/api/v1/courses/material-management',
    { ...options, method: 'GET' },
  )

  return instructorCourseListSchema.parse(response).courses
}
