import type { ConfigService } from '@nestjs/config'
import { z } from 'zod'

import type { AppEnvironment } from '../../../platform/config/env.schema'
import { MAX_PDF_OBJECT_BYTES } from '../../../platform/document-storage/pdf-storage'

const PDF_UPLOAD_OPERATIONAL_CEILING_BYTES = 10 * 1024 * 1024

export const MAX_PDF_UPLOAD_BYTES = Math.min(
  PDF_UPLOAD_OPERATIONAL_CEILING_BYTES,
  MAX_PDF_OBJECT_BYTES,
)
export const DEFAULT_PDF_MAX_UPLOAD_BYTES = MAX_PDF_UPLOAD_BYTES

const materialsConfigurationSchema = z.object({
  PDF_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PDF_UPLOAD_BYTES)
    .default(DEFAULT_PDF_MAX_UPLOAD_BYTES),
  RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(50).default(5),
  RETRIEVAL_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.62),
})

export type MaterialsConfiguration = z.infer<
  typeof materialsConfigurationSchema
>

export function readMaterialsConfiguration(
  configService: ConfigService<AppEnvironment, true>,
): MaterialsConfiguration {
  const result = materialsConfigurationSchema.safeParse({
    PDF_MAX_UPLOAD_BYTES: configService.get('PDF_MAX_UPLOAD_BYTES', {
      infer: true,
    }),
    RETRIEVAL_TOP_K: configService.get('RETRIEVAL_TOP_K', { infer: true }),
    RETRIEVAL_MIN_SIMILARITY: configService.get('RETRIEVAL_MIN_SIMILARITY', {
      infer: true,
    }),
  })

  if (!result.success) {
    throw new Error(
      `Invalid materials configuration: ${result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    )
  }

  return result.data
}
