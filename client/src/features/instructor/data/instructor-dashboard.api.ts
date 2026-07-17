import { apiJson } from '@/features/auth/api/authenticated-api-client'
import { instructorCourseListSchema } from '@/features/instructor/schemas/instructor-course.schema'

export async function getInstructorCourses() {
  const response = await apiJson<unknown>('/api/v1/courses')

  return instructorCourseListSchema.parse(response).courses
}
