import { z } from 'zod'

export const instructorCourseSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  membershipRole: z.literal('INSTRUCTOR'),
  canManageMaterials: z.literal(true),
})

export const instructorCourseListSchema = z.object({
  courses: z.array(instructorCourseSchema),
})

export type InstructorCourse = z.infer<typeof instructorCourseSchema>
