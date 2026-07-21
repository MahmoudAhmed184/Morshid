import { z } from 'zod'

const instructorMaterialStatusValueSchema = z.enum([
  'PROCESSING',
  'READY',
  'WARNING',
  'FAILED',
])

export const instructorMaterialSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  title: z.string(),
  originalFilename: z.string(),
  status: instructorMaterialStatusValueSchema,
  extractedTextLength: z.number().int().nonnegative().nullable(),
  chunkCount: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const instructorMaterialsResponseSchema = z.object({
  materials: z.array(instructorMaterialSchema),
})

export const instructorMaterialResponseSchema = z.object({
  material: instructorMaterialSchema,
})

export const instructorMaterialStatusSchema = z.object({
  id: z.uuid(),
  status: instructorMaterialStatusValueSchema,
  extractedTextLength: z.number().int().nonnegative().nullable(),
  chunkCount: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable(),
  updatedAt: z.iso.datetime(),
})

export const instructorMaterialUploadSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(180),
  file: z
    .file()
    .mime('application/pdf', 'File MIME type must be application/pdf')
    .refine(
      (file) => file.name.toLowerCase().endsWith('.pdf'),
      'File extension must be .pdf',
    ),
})

export type InstructorMaterial = z.infer<typeof instructorMaterialSchema>
export type InstructorMaterialsResponse = z.infer<
  typeof instructorMaterialsResponseSchema
>
export type InstructorMaterialResponse = z.infer<
  typeof instructorMaterialResponseSchema
>
export type InstructorMaterialStatus = z.infer<
  typeof instructorMaterialStatusSchema
>
export type InstructorMaterialUpload = z.infer<
  typeof instructorMaterialUploadSchema
>
