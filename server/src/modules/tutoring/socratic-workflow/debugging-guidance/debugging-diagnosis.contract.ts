import { z } from 'zod'

export const DEBUGGING_DIAGNOSIS_SCHEMA_VERSION = 'debugging-diagnosis.v2'

const diagnosisStatusSchema = z.enum(['RESOLVED', 'UNCERTAIN'])
const diagnosisSourceSchema = z.enum(['DETERMINISTIC', 'MODEL', 'FALLBACK'])
const diagnosisCategorySchema = z.enum([
  'SYNTAX',
  'NAME_REFERENCE',
  'INITIALIZATION',
  'BOUNDARY',
  'CONDITION',
  'COMPARISON',
  'STATE_UPDATE',
  'RETURN_VALUE',
  'COLLECTION_INDEX',
  'TYPE_COMPATIBILITY',
  'NESTED_CONTROL_FLOW',
  'CALL_SIGNATURE',
  'UNKNOWN',
])
const evidenceKindSchema = z.enum(['CODE', 'SYMPTOM', 'UNKNOWN'])
const runtimeEvidenceNeededSchema = z.enum([
  'NONE',
  'TRACE_VALUES',
  'ACTUAL_INPUT',
  'EXPECTED_RESULT',
  'EXCEPTION_TEXT',
  'EXTERNAL_STATE',
])

export const evidenceReferenceSchema = z
  .object({
    messageId: z.uuid(),
    lineStart: z.number().int().positive().nullable(),
    lineEnd: z.number().int().positive().nullable(),
    kind: evidenceKindSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.lineStart !== null &&
      value.lineEnd !== null &&
      value.lineEnd < value.lineStart
    ) {
      context.addIssue({
        code: 'custom',
        message: 'lineEnd must not precede lineStart',
        path: ['lineEnd'],
      })
    }
  })

export const debuggingDiagnosisSchema = z
  .object({
    schemaVersion: z.literal(DEBUGGING_DIAGNOSIS_SCHEMA_VERSION),
    status: diagnosisStatusSchema,
    source: diagnosisSourceSchema,
    language: z.string().trim().min(1).max(80).nullable(),
    category: diagnosisCategorySchema,
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    likelyDefect: z.string().trim().min(1).max(1_000).nullable(),
    location: evidenceReferenceSchema,
    evidence: z.array(evidenceReferenceSchema).min(1).max(8),
    underlyingConcept: z.string().trim().min(1).max(2_000).nullable(),
    requiresRuntimeEvidence: z.boolean(),
    runtimeEvidenceNeeded: runtimeEvidenceNeededSchema,
    inspectionGoal: z.string().trim().min(1).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    const resolved = value.status === 'RESOLVED'
    const validResolution =
      (value.source === 'DETERMINISTIC' && value.confidence === 'HIGH') ||
      (value.source === 'MODEL' && value.confidence === 'MEDIUM')
    if (resolved !== validResolution) {
      context.addIssue({
        code: 'custom',
        message:
          'Resolved diagnoses must be deterministic/high or model/medium',
        path: ['source'],
      })
    }
    if (
      !resolved &&
      (value.source !== 'FALLBACK' || value.confidence !== 'LOW')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Uncertain diagnoses must be fallback/low',
        path: ['confidence'],
      })
    }
    if (resolved !== (value.likelyDefect !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Only resolved diagnoses may name a likely defect',
        path: ['likelyDefect'],
      })
    }
    if (!resolved && value.category !== 'UNKNOWN') {
      context.addIssue({
        code: 'custom',
        message: 'Uncertain diagnoses must use the UNKNOWN category',
        path: ['category'],
      })
    }
    if (!resolved && !value.requiresRuntimeEvidence) {
      context.addIssue({
        code: 'custom',
        message: 'Uncertain diagnoses must request runtime evidence',
        path: ['requiresRuntimeEvidence'],
      })
    }
  })

export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>
export type DebuggingDiagnosis = z.infer<typeof debuggingDiagnosisSchema>

export function parseDebuggingDiagnosis(value: unknown): DebuggingDiagnosis {
  const diagnosis = debuggingDiagnosisSchema.parse(value)
  return Object.freeze({
    ...diagnosis,
    location: Object.freeze({ ...diagnosis.location }),
    evidence: Object.freeze(
      diagnosis.evidence.map((reference) => Object.freeze({ ...reference })),
    ),
  }) as DebuggingDiagnosis
}
