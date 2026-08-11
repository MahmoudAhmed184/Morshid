import { z } from 'zod'

export const courseAccessSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  membershipRole: z.literal('STUDENT'),
})

export const courseAccessResponseSchema = z.object({
  courses: z.array(courseAccessSchema),
})

export type StudentCourseAccess = z.infer<typeof courseAccessSchema>
