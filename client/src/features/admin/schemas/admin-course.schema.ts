import { z } from 'zod'

export const courseMembershipRoleSchema = z.enum(['INSTRUCTOR', 'STUDENT'])
const userRoleSchema = z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])
const userStatusSchema = z.enum(['ACTIVE', 'DISABLED'])
export const materialStatusSchema = z.enum([
  'PROCESSING',
  'READY',
  'WARNING',
  'FAILED',
])

const courseUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  role: userRoleSchema,
  status: userStatusSchema,
})

export const adminCourseMemberSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  role: courseMembershipRoleSchema,
  createdAt: z.iso.datetime(),
  user: courseUserSchema,
})

export const adminCourseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  title: z.string(),
  adminMetadata: z.object({
    createdById: z.uuid().nullable(),
    createdBy: courseUserSchema.nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    memberships: z.array(adminCourseMemberSchema),
    memberCount: z.number().int().nonnegative(),
    instructorCount: z.number().int().nonnegative(),
    studentCount: z.number().int().nonnegative(),
    materialCount: z.number().int().nonnegative(),
    activeMaterialCount: z.number().int().nonnegative(),
  }),
})

export const adminMaterialSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  uploadedById: z.uuid(),
  title: z.string(),
  originalFilename: z.string(),
  storagePath: z.string(),
  sha256Hash: z.string().nullable(),
  status: materialStatusSchema,
  extractedTextLength: z.number().int().nonnegative().nullable(),
  chunkCount: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const adminCourseListResponseSchema = z.object({
  courses: z.array(adminCourseSchema),
})
export const adminCourseMembersResponseSchema = z.object({
  members: z.array(adminCourseMemberSchema),
})
export const adminCourseMemberResponseSchema = z.object({
  member: adminCourseMemberSchema,
})
export const adminCourseMaterialsResponseSchema = z.object({
  materials: z.array(adminMaterialSchema),
})
export const adminMaterialResponseSchema = z.object({
  material: adminMaterialSchema,
})

export type AdminCourse = z.infer<typeof adminCourseSchema>
export type AdminCourseMember = z.infer<typeof adminCourseMemberSchema>
export type AdminMaterial = z.infer<typeof adminMaterialSchema>
export type CourseMembershipRole = z.infer<typeof courseMembershipRoleSchema>
