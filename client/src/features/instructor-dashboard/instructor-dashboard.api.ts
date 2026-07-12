import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiJson } from '@/features/auth/api/authenticated-api-client'

const instructorCourseSchema = z.object({
  code: z.string(),
  title: z.string(),
})

const instructorCourseListSchema = z.object({
  courses: z.array(instructorCourseSchema),
})

export async function getInstructorCourses() {
  const response = await apiJson<unknown>('/api/v1/courses')

  return instructorCourseListSchema.parse(response).courses
}

export function instructorCoursesQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: ['instructor', 'owned-courses', userId],
    queryFn: getInstructorCourses,
  })
}
