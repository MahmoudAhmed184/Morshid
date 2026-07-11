import { z } from 'zod'

import { apiJson } from '@/lib/api/api-client'
import type { ApiFetchOptions } from '@/lib/api/api-client'

const studentCourseSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  membershipRole: z.literal('STUDENT'),
})

const studentCoursesResponseSchema = z.object({
  courses: z.array(studentCourseSchema),
})

export type StudentCourse = z.infer<typeof studentCourseSchema>

export async function getStudentCourses(options: ApiFetchOptions = {}) {
  const response = await apiJson<unknown>('/api/v1/courses', {
    ...options,
    method: 'GET',
  })

  return studentCoursesResponseSchema.parse(response).courses
}
