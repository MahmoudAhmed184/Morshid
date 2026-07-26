import { apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import { studentCoursesResponseSchema } from '@/features/student/schemas/student-course.schema'

export type { StudentCourse } from '@/features/student/schemas/student-course.schema'

export async function getStudentCourses(options: ApiFetchOptions = {}) {
  const response = await apiJson<unknown>('/api/v1/courses', {
    ...options,
    method: 'GET',
  })

  return studentCoursesResponseSchema.parse(response).courses
}
