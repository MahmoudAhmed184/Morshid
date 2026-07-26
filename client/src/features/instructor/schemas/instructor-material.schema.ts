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

export const instructorMaterialUploadConfigurationSchema = z.object({
  maxUploadBytes: z.number().int().positive(),
  acceptedMimeType: z.literal('application/pdf'),
  acceptedFileExtension: z.literal('.pdf'),
})

export function createInstructorMaterialUploadSchema(maxUploadBytes: number) {
  return z.object({
    title: z.string().trim().min(1, 'Title is required').max(180),
    file: z
      .file()
      .mime('application/pdf', 'File MIME type must be application/pdf')
      .max(
        maxUploadBytes,
        `PDF must be ${formatFileSize(maxUploadBytes)} or smaller`,
      )
      .refine(
        (file) => file.name.toLowerCase().endsWith('.pdf'),
        'File extension must be .pdf',
      ),
  })
}

export function formatFileSize(bytes: number) {
  const units = ['bytes', 'KB', 'MB', 'GB'] as const
  let value = bytes
  let unitIndex = 0

  while (value >= 1_024 && unitIndex < units.length - 1) {
    value /= 1_024
    unitIndex += 1
  }

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value < 10 && unitIndex > 0 ? 1 : 0,
  }).format(value)} ${units[unitIndex]}`
}

export type InstructorMaterial = z.infer<typeof instructorMaterialSchema>
export type InstructorMaterialsResponse = z.infer<
  typeof instructorMaterialsResponseSchema
>
export type InstructorMaterialResponse = z.infer<
  typeof instructorMaterialResponseSchema
>
export type InstructorMaterialUploadConfiguration = z.infer<
  typeof instructorMaterialUploadConfigurationSchema
>
export type InstructorMaterialUpload = z.infer<
  ReturnType<typeof createInstructorMaterialUploadSchema>
>
