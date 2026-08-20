import { z } from 'zod'

import { StudentActionPurpose, TeachingTechnique } from '../../tutoring-values'
import {
  TUTOR_CANDIDATE_LIMITS,
  TUTOR_RESPONSE_INTENTS,
  TUTOR_STUDENT_ACTION_TYPES,
  type CandidateResponse,
  type CandidateResponsePolicyContext,
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

const generalCandidateResponseContentSchema = z
  .object({
    ...commonContentFields,
    message: boundedNonBlankString(TUTOR_CANDIDATE_LIMITS.maxMessageCodePoints),
    debuggingGuidance: z.null().optional().default(null),
    studentAction: studentActionSchema,
  })
  .strict()

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

const debuggingCandidateResponseContentSchema = z
  .object({
    ...commonContentFields,
    message: z.null().optional().default(null),
    debuggingGuidance: debuggingGuidanceResponseSchema,
    studentAction: z.null().optional().default(null),
  })
  .strict()

export const CandidateResponseContentSchema = z.union([
  generalCandidateResponseContentSchema,
  debuggingCandidateResponseContentSchema,
])

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
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
    }
  }

  const content = parseCandidateResponseContent(rawOutput)
  if (content === null) {
    return {
      success: false,
      errorCode: malformedOrInvalid(rawOutput),
    }
  }

  const usedCitationIds = Array.from(new Set(content.usedCitationIds))
  if (usedCitationIds.length !== content.usedCitationIds.length) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
    }
  }
  if (
    content.usedCitationIds.some((id) => !policy.allowedCitationIds.has(id))
  ) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_CITATION',
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
    }
  }
  if (
    content.requiresStudentAction !== policy.studentActionObligation.required
  ) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
    }
  }
  if (content.reflectionIncluded !== (policy.reflectionMode !== 'NONE')) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
    }
  }

  const debuggingRequired = policy.debuggingGuidanceRequired === true
  if (!debuggingRequired && content.debuggingGuidance !== null) {
    return {
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
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
    }
  }

  let message: string
  let studentAction: CandidateResponse['studentAction']
  if (content.debuggingGuidance === null) {
    message = content.message
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
