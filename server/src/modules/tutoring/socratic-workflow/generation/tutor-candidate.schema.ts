import { z } from 'zod'

import { StudentActionPurpose, TeachingTechnique } from '../../tutoring-values'
import {
  TUTOR_CANDIDATE_LIMITS,
  TUTOR_RESPONSE_INTENTS,
  TUTOR_STUDENT_ACTION_TYPES,
  type CandidateResponse,
  type CandidateResponsePolicyContext,
  type CandidateResponseValidationDiagnostic,
} from './tutor-generation.types'
import { TUTOR_GENERATION_PROMPT_VERSION } from './tutor-prompt.definition'
import { renderDebuggingGuidanceMessage } from '../debugging-guidance/debugging-guidance.output-validator'

const BACKEND_OWNED_METADATA_KEYS = [
  'provider',
  'model',
  'promptVersion',
  'tokenUsage',
] as const

const candidateContentKeys = [
  'message',
  'debuggingGuidance',
  'responseIntent',
  'usedCitationIds',
  'requiresStudentAction',
  'studentAction',
  'reflectionIncluded',
  'selfReportedCompliance',
] as const

const studentActionSchema = z
  .object({
    type: z.enum(TUTOR_STUDENT_ACTION_TYPES),
    description: boundedNonBlankString(
      TUTOR_CANDIDATE_LIMITS.maxStudentActionDescriptionCodePoints,
    ),
  })
  .strict()

const commonContentFields = {
  responseIntent: z.enum(TUTOR_RESPONSE_INTENTS),
  usedCitationIds: z
    .array(
      boundedNonBlankString(TUTOR_CANDIDATE_LIMITS.maxCitationIdCodePoints),
    )
    .max(TUTOR_CANDIDATE_LIMITS.maxCitationIds),
  requiresStudentAction: z.boolean(),
  reflectionIncluded: z.boolean(),
  selfReportedCompliance: z
    .object({
      finalAnswerRevealed: z.literal(false),
      completeSolutionRevealed: z.literal(false),
    })
    .strict(),
} as const

const debuggingGuidanceResponseSchema = z
  .object({
    diagnosis: boundedString(1_000).optional(),
    relevantLocation: boundedString(500).optional(),
    conceptExplanation: boundedString(2_000).optional(),
    inspectionActions: z
      .array(
        boundedNonBlankString(
          TUTOR_CANDIDATE_LIMITS.maxStudentActionDescriptionCodePoints,
        ),
      )
      .length(1),
  })
  .strict()

export const CandidateResponseContentSchema = z
  .object({
    ...commonContentFields,
    message: boundedNonBlankString(
      TUTOR_CANDIDATE_LIMITS.maxMessageCodePoints,
    ).nullable(),
    debuggingGuidance: debuggingGuidanceResponseSchema.nullable(),
    studentAction: studentActionSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.debuggingGuidance !== null) {
      if (value.message !== null) {
        addContractIssue(context, 'message', 'Debugging message must be null')
      }
      if (value.studentAction !== null) {
        addContractIssue(
          context,
          'studentAction',
          'Debugging studentAction must be null and backend-derived',
        )
      }
      return
    }

    if (value.message === null) {
      addContractIssue(context, 'message', 'General message is required')
    }
    if (value.requiresStudentAction && value.studentAction === null) {
      addContractIssue(
        context,
        'studentAction',
        'studentAction is required when requiresStudentAction is true',
      )
    }
    if (!value.requiresStudentAction && value.studentAction !== null) {
      addContractIssue(
        context,
        'studentAction',
        'studentAction must be null when requiresStudentAction is false',
      )
    }
  })

export type CandidateResponseContent = z.infer<
  typeof CandidateResponseContentSchema
>

export type CandidateResponseValidationResult =
  | {
      readonly success: true
      readonly data: CandidateResponse
    }
  | {
      readonly success: false
      readonly errorCode:
        | 'TUTOR_MALFORMED_OUTPUT'
        | 'TUTOR_INVALID_OUTPUT'
        | 'TUTOR_INVALID_CITATION'
      readonly diagnostic: CandidateResponseValidationDiagnostic
    }

export function parseCandidateResponseContent(
  rawOutput: unknown,
): CandidateResponseContent | null {
  if (typeof rawOutput === 'string') {
    try {
      return parseCandidateResponseContent(JSON.parse(rawOutput))
    } catch {
      return null
    }
  }

  if (
    typeof rawOutput !== 'object' ||
    rawOutput === null ||
    Array.isArray(rawOutput)
  ) {
    return null
  }

  const parsed = CandidateResponseContentSchema.safeParse(rawOutput)
  return parsed.success ? parsed.data : null
}

export function validateCandidateResponse(
  rawOutput: unknown,
  policy: CandidateResponsePolicyContext,
  metadata: Pick<CandidateResponse, 'provider' | 'model' | 'tokenUsage'>,
): CandidateResponseValidationResult {
  if (hasBackendOwnedMetadata(rawOutput) || hasApprovalLikeField(rawOutput)) {
    const backendField = backendOwnedMetadataField(rawOutput)
    const approvalField = approvalLikeField(rawOutput)
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
      diagnostic: {
        contractStage: 'CANDIDATE_POLICY',
        field: backendField ?? approvalField,
        reason:
          backendField === null ? 'APPROVAL_FIELD' : 'BACKEND_OWNED_FIELD',
      },
    }
  }

  const parsedRawOutput = parseRawOutput(rawOutput)
  if (parsedRawOutput === null) {
    return {
      success: false,
      errorCode: 'TUTOR_MALFORMED_OUTPUT',
      diagnostic: schemaDiagnostic(null),
    }
  }
  const parsed = CandidateResponseContentSchema.safeParse(parsedRawOutput)
  if (!parsed.success) {
    return {
      success: false,
      errorCode: malformedOrInvalid(parsedRawOutput),
      diagnostic: schemaDiagnostic(parsed.error.issues[0]?.path ?? []),
    }
  }
  const content = parsed.data

  const usedCitationIds = Array.from(new Set(content.usedCitationIds))
  if (usedCitationIds.length !== content.usedCitationIds.length) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
      diagnostic: policyDiagnostic('usedCitationIds', 'DUPLICATE_CITATION'),
    }
  }
  if (
    content.usedCitationIds.some((id) => !policy.allowedCitationIds.has(id))
  ) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_CITATION',
      diagnostic: policyDiagnostic('usedCitationIds', 'INVALID_CITATION'),
    }
  }
  if (
    policy.requireGrounding &&
    policy.enforceCitationSupport &&
    policy.allowedCitationIds.size > 0 &&
    content.usedCitationIds.length === 0
  ) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_CITATION',
      diagnostic: policyDiagnostic('usedCitationIds', 'MISSING_CITATION'),
    }
  }
  if (
    content.requiresStudentAction !== policy.studentActionObligation.required
  ) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
      diagnostic: policyDiagnostic(
        'requiresStudentAction',
        'STUDENT_ACTION_OBLIGATION_MISMATCH',
      ),
    }
  }
  if (content.reflectionIncluded !== (policy.reflectionMode !== 'NONE')) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
      diagnostic: policyDiagnostic(
        'reflectionIncluded',
        'REFLECTION_MODE_MISMATCH',
      ),
    }
  }

  const debuggingRequired = policy.debuggingGuidanceRequired === true
  if (!debuggingRequired && content.debuggingGuidance !== null) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
      diagnostic: policyDiagnostic(
        'debuggingGuidance',
        'DEBUGGING_CONTRACT_MISMATCH',
      ),
    }
  }

  if (
    content.debuggingGuidance !== null &&
    policy.studentActionObligation.purpose ===
      StudentActionPurpose.PRIMARY_TECHNIQUE &&
    policy.studentActionObligation.technique ===
      TeachingTechnique.FOCUSED_QUESTION &&
    !content.debuggingGuidance.inspectionActions[0]?.endsWith('?')
  ) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
      diagnostic: policyDiagnostic(
        'debuggingGuidance.inspectionActions',
        'DEBUGGING_CONTRACT_MISMATCH',
      ),
    }
  }

  let message: string
  let studentAction: CandidateResponse['studentAction']
  if (content.debuggingGuidance === null) {
    message = content.message ?? ''
    studentAction = content.studentAction
  } else {
    const action = content.debuggingGuidance.inspectionActions[0] ?? ''
    message = renderDebuggingGuidanceMessage({
      guidance: content.debuggingGuidance,
      usedCitationIds,
      action,
      rewriteRequested: policy.debuggingRewriteRequested === true,
    })
    studentAction = Object.freeze({
      type: policy.studentActionObligation.technique,
      description: action,
    })
  }

  return {
    success: true,
    data: Object.freeze({
      ...content,
      message,
      debuggingGuidance:
        content.debuggingGuidance === null
          ? null
          : Object.freeze({
              ...content.debuggingGuidance,
              inspectionActions: Object.freeze([
                ...content.debuggingGuidance.inspectionActions,
              ]),
            }),
      usedCitationIds: Object.freeze(usedCitationIds),
      studentAction,
      provider: metadata.provider,
      model: metadata.model,
      promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
      tokenUsage: metadata.tokenUsage,
    }),
  }
}

function boundedNonBlankString(maximumCodePoints: number) {
  return z
    .string()
    .trim()
    .min(1)
    .refine((value) => hasAtMostCodePoints(value, maximumCodePoints), {
      message: `String must contain at most ${String(maximumCodePoints)} Unicode code points`,
    })
}

function boundedString(maximumCodePoints: number) {
  return z
    .string()
    .trim()
    .refine((value) => hasAtMostCodePoints(value, maximumCodePoints), {
      message: `String must contain at most ${String(maximumCodePoints)} Unicode code points`,
    })
}

function addContractIssue(
  context: z.RefinementCtx,
  field: string,
  message: string,
): void {
  context.addIssue({
    code: 'custom',
    path: [field],
    message,
  })
}

function parseRawOutput(rawOutput: unknown): unknown {
  if (typeof rawOutput !== 'string') {
    return rawOutput
  }

  try {
    return JSON.parse(rawOutput)
  } catch {
    return null
  }
}

function schemaDiagnostic(
  path: readonly PropertyKey[] | null,
): CandidateResponseValidationDiagnostic {
  return {
    contractStage: 'CANDIDATE_SCHEMA',
    field:
      path === null || path.length === 0 ? null : path.map(String).join('.'),
    reason: 'SCHEMA_MISMATCH',
  }
}

function policyDiagnostic(
  field: string,
  reason: CandidateResponseValidationDiagnostic['reason'],
): CandidateResponseValidationDiagnostic {
  return {
    contractStage: 'CANDIDATE_POLICY',
    field,
    reason,
  }
}

function hasAtMostCodePoints(value: string, maximum: number): boolean {
  return Array.from(value).length <= maximum
}

function hasBackendOwnedMetadata(value: unknown): boolean {
  return (
    isRecord(value) &&
    BACKEND_OWNED_METADATA_KEYS.some((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    )
  )
}

function backendOwnedMetadataField(value: unknown): string | null {
  if (!isRecord(value)) {
    return null
  }
  return (
    BACKEND_OWNED_METADATA_KEYS.find((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    ) ?? null
  )
}

function hasApprovalLikeField(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return Reflect.ownKeys(value).some(
    (key) =>
      typeof key === 'string' &&
      ['approved', 'isApproved', 'guardPassed', 'studentVisible'].includes(key),
  )
}

function approvalLikeField(value: unknown): string | null {
  if (!isRecord(value)) {
    return null
  }

  const field = Reflect.ownKeys(value).find(
    (key) =>
      typeof key === 'string' &&
      ['approved', 'isApproved', 'guardPassed', 'studentVisible'].includes(key),
  )
  return typeof field === 'string' ? field : null
}

function malformedOrInvalid(
  rawOutput: unknown,
): 'TUTOR_MALFORMED_OUTPUT' | 'TUTOR_INVALID_OUTPUT' {
  if (typeof rawOutput !== 'object' || rawOutput === null) {
    return 'TUTOR_MALFORMED_OUTPUT'
  }

  const keys = Reflect.ownKeys(rawOutput)
  return candidateContentKeys.some((key) => !keys.includes(key))
    ? 'TUTOR_MALFORMED_OUTPUT'
    : 'TUTOR_INVALID_OUTPUT'
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
