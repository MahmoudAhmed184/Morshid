import { z } from 'zod'

export const studentCourseSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  membershipRole: z.literal('STUDENT'),
})

export const studentCoursesResponseSchema = z.object({
  courses: z.array(studentCourseSchema),
})

export type StudentCourse = z.infer<typeof studentCourseSchema>
