import { z } from 'zod'

export const materialStatusSchema = z.enum([
  'PROCESSING',
  'READY',
  'WARNING',
  'FAILED',
])

const materialAdministrationUserSchema = z.object({
  email: z.email(),
  displayName: z.string(),
})

export const materialAdministrationSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  uploadedBy: materialAdministrationUserSchema,
  title: z.string(),
  originalFilename: z.string(),
  status: materialStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const materialAdministrationListResponseSchema = z.object({
  materials: z.array(materialAdministrationSchema),
  nextCursor: z.uuid().optional(),
})

export const materialAdministrationResponseSchema = z.object({
  material: materialAdministrationSchema,
})

export type MaterialAdministration = z.infer<
  typeof materialAdministrationSchema
>
