import { z } from 'zod'

export const courseMembershipRoleSchema = z.enum(['INSTRUCTOR', 'STUDENT'])
const userRoleSchema = z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])
const userStatusSchema = z.enum(['ACTIVE', 'DISABLED'])

const courseUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  role: userRoleSchema,
  status: userStatusSchema,
})

export const courseMemberSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  role: courseMembershipRoleSchema,
  createdAt: z.iso.datetime(),
  user: courseUserSchema,
})

export const courseAdministrationSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  title: z.string(),
  adminMetadata: z.object({
    createdById: z.uuid().nullable(),
    createdBy: courseUserSchema.nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    memberships: z.array(courseMemberSchema),
    memberCount: z.number().int().nonnegative(),
    instructorCount: z.number().int().nonnegative(),
    studentCount: z.number().int().nonnegative(),
    materialCount: z.number().int().nonnegative(),
    activeMaterialCount: z.number().int().nonnegative(),
  }),
})

export const courseAdministrationListResponseSchema = z.object({
  courses: z.array(courseAdministrationSchema),
  nextCursor: z.uuid().optional(),
})
export const courseMembersResponseSchema = z.object({
  members: z.array(courseMemberSchema),
  nextCursor: z.uuid().optional(),
})
export const courseMemberResponseSchema = z.object({
  member: courseMemberSchema,
})
export const bulkCourseAssignmentResponseSchema = z.object({
  assignedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
})

export type CourseAdministration = z.infer<typeof courseAdministrationSchema>
export type CourseMember = z.infer<typeof courseMemberSchema>
export type CourseMembershipRole = z.infer<typeof courseMembershipRoleSchema>
