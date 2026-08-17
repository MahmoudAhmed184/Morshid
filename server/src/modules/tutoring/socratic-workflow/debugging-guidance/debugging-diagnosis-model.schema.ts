import { z } from 'zod'

import { debuggingDiagnosisSchema } from './debugging-diagnosis.contract'

const categorySchema = debuggingDiagnosisSchema.shape.category
const runtimeEvidenceNeededSchema =
  debuggingDiagnosisSchema.shape.runtimeEvidenceNeeded

export const debuggingDiagnosisModelOutputSchema = z
  .object({
    status: z.enum(['RESOLVED', 'UNCERTAIN']),
    category: categorySchema,
    likelyDefect: z.string().trim().min(1).max(1_000).nullable(),
    location: z
      .object({
        lineStart: z.number().int().positive().nullable(),
        lineEnd: z.number().int().positive().nullable(),
        kind: z.enum(['CODE', 'SYMPTOM', 'UNKNOWN']),
      })
      .strict(),
    evidenceReferences: z
      .array(
        z
          .object({
            source: z.enum(['CODE', 'SYMPTOM']),
            lineStart: z.number().int().positive().nullable(),
            lineEnd: z.number().int().positive().nullable(),
          })
          .strict(),
      )
      .max(8),
    underlyingConcept: z.string().trim().min(1).max(2_000).nullable(),
    requiresRuntimeEvidence: z.boolean(),
    runtimeEvidenceNeeded: runtimeEvidenceNeededSchema,
    inspectionGoal: z.string().trim().min(1).max(1_000),
  })
  .strict()

export type DebuggingDiagnosisModelOutput = z.infer<
  typeof debuggingDiagnosisModelOutputSchema
>
