import { z } from 'zod'

export const courseMembershipSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  membershipRole: z.literal('INSTRUCTOR'),
  canManageMaterials: z.literal(true),
})

export const courseMembershipListSchema = z.object({
  courses: z.array(courseMembershipSchema),
})

export type CourseMembership = z.infer<typeof courseMembershipSchema>
