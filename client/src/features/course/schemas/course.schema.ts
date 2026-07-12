import { z } from 'zod'

const courseMembershipRoleSchema = z.enum(['INSTRUCTOR', 'STUDENT'])
const userRoleSchema = z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])
const userStatusSchema = z.enum(['ACTIVE', 'DISABLED'])
const materialStatusSchema = z.enum([
  'PROCESSING',
  'READY',
  'WARNING',
  'FAILED',
])

const courseUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: userRoleSchema,
  status: userStatusSchema,
})

export const courseMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  role: courseMembershipRoleSchema,
  createdAt: z.string().datetime(),
  user: courseUserSchema,
})

export const courseSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  adminMetadata: z.object({
    createdById: z.string().uuid().nullable(),
    createdBy: courseUserSchema.nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    memberships: z.array(courseMemberSchema),
    memberCount: z.number().int().nonnegative(),
    instructorCount: z.number().int().nonnegative(),
    studentCount: z.number().int().nonnegative(),
    materialCount: z.number().int().nonnegative(),
    activeMaterialCount: z.number().int().nonnegative(),
  }),
})

export const courseMaterialSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  uploadedById: z.string().uuid(),
  title: z.string(),
  originalFilename: z.string(),
  storagePath: z.string(),
  sha256Hash: z.string().nullable(),
  status: materialStatusSchema,
  extractedTextLength: z.number().int().nonnegative().nullable(),
  chunkCount: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const courseListResponseSchema = z.object({
  courses: z.array(courseSchema),
})

export const courseResponseSchema = z.object({ course: courseSchema })

export const courseMembersResponseSchema = z.object({
  members: z.array(courseMemberSchema),
})

export const courseMaterialsResponseSchema = z.object({
  materials: z.array(courseMaterialSchema),
})

export type Course = z.infer<typeof courseSchema>
export type CourseMember = z.infer<typeof courseMemberSchema>
export type CourseMaterial = z.infer<typeof courseMaterialSchema>
