import { z } from 'zod'

const materialStatusSchema = z.enum([
  'PROCESSING',
  'READY',
  'WARNING',
  'FAILED',
])

export const materialSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  title: z.string(),
  originalFilename: z.string(),
  status: materialStatusSchema,
  extractedTextLength: z.number().int().nonnegative().nullable(),
  chunkCount: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  canDelete: z.boolean().optional(),
})

export const materialsResponseSchema = z.object({
  materials: z.array(materialSchema),
  nextCursor: z.uuid().optional(),
})

export const materialResponseSchema = z.object({
  material: materialSchema,
})

export const materialUploadConfigurationSchema = z.object({
  maxUploadBytes: z.number().int().positive(),
  acceptedMimeType: z.literal('application/pdf'),
  acceptedFileExtension: z.literal('.pdf'),
})

export function createMaterialUploadSchema(maxUploadBytes: number) {
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

export type Material = z.infer<typeof materialSchema>
export type MaterialsResponse = z.infer<typeof materialsResponseSchema>
export type MaterialResponse = z.infer<typeof materialResponseSchema>
export type MaterialUploadConfiguration = z.infer<
  typeof materialUploadConfigurationSchema
>
export type MaterialUpload = z.infer<
  ReturnType<typeof createMaterialUploadSchema>
>
