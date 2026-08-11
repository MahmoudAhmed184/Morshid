import { z } from 'zod'

import {
  MessageRequestKind,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../tutoring-values'
import {
  EFFORT_QUALITY,
  EFFORT_TYPE,
  LEARNING_EVIDENCE_STRENGTH,
  type EducationalAnalysisResult,
} from './educational-analysis.types'
import { TOPIC_RESOLUTION_OUTCOME } from './topic.types'

export const EDUCATIONAL_ANALYSIS_LIMITS = {
  // These are implementation bounds; the architecture requires bounded values
  // but does not prescribe exact numeric limits for Version 1.
  maxEvidenceReferences: 12,
  maxNestedEvidenceMessageIds: 8,
  maxMisconceptions: 5,
  maxMessageIdCodePoints: 120,
  maxMisconceptionCodeCodePoints: 64,
  maxMisconceptionDescriptionCodePoints: 500,
} as const

export const SUPPORTED_EDUCATIONAL_ANALYSIS_REQUEST_KINDS = [
  MessageRequestKind.CONCEPTUAL,
  MessageRequestKind.PROBLEM_LIKE,
  MessageRequestKind.ATTEMPT_DIAGNOSIS,
  MessageRequestKind.CODE_DIAGNOSIS,
  MessageRequestKind.AMBIGUOUS,
  MessageRequestKind.OFF_TOPIC,
  MessageRequestKind.UNSAFE,
] as const

export const SUPPORTED_EDUCATIONAL_ANALYSIS_STUDENT_STATES = [
  StudentState.UNKNOWN,
  StudentState.NO_PRIOR_KNOWLEDGE,
  StudentState.PARTIAL_UNDERSTANDING,
  StudentState.MISCONCEPTION,
  StudentState.DEBUGGING_ISSUE,
  StudentState.NEAR_SOLUTION,
] as const

export const SUPPORTED_EFFORT_QUALITIES = [
  EFFORT_QUALITY.NONE,
  EFFORT_QUALITY.LOW,
  EFFORT_QUALITY.MEANINGFUL,
  EFFORT_QUALITY.STRONG,
] as const

export const SUPPORTED_EFFORT_TYPES = [
  EFFORT_TYPE.REASONING_ATTEMPT,
  EFFORT_TYPE.CALCULATION_ATTEMPT,
  EFFORT_TYPE.CODE_ATTEMPT,
  EFFORT_TYPE.TRACE_ATTEMPT,
  EFFORT_TYPE.EXPLANATION_ATTEMPT,
  EFFORT_TYPE.TEST_ATTEMPT,
  EFFORT_TYPE.REVISION_ATTEMPT,
] as const

export const SUPPORTED_LEARNING_EVIDENCE_STRENGTHS = [
  LEARNING_EVIDENCE_STRENGTH.NONE,
  LEARNING_EVIDENCE_STRENGTH.WEAK,
  LEARNING_EVIDENCE_STRENGTH.MODERATE,
  LEARNING_EVIDENCE_STRENGTH.STRONG,
] as const

export const SUPPORTED_TOPIC_RELATIONS = [
  TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
  TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
  TOPIC_RESOLUTION_OUTCOME.RESUME_PREVIOUS_TOPIC,
  TOPIC_RESOLUTION_OUTCOME.REOPEN_EXISTING_TOPIC,
  TOPIC_RESOLUTION_OUTCOME.UNRESOLVED,
] as const

export const SUPPORTED_RECOMMENDED_TEACHING_STRATEGIES = [
  TeachingStrategy.GUIDED_EXPLANATION,
  TeachingStrategy.SOCRATIC_QUESTIONING,
  TeachingStrategy.MISCONCEPTION_REPAIR,
  TeachingStrategy.DEBUGGING_GUIDANCE,
] as const

export const SUPPORTED_RECOMMENDED_TEACHING_TECHNIQUES = [
  TeachingTechnique.ORIENTATION_QUESTION,
  TeachingTechnique.FOCUSED_QUESTION,
  TeachingTechnique.DECOMPOSITION,
  TeachingTechnique.ANALOGY,
  TeachingTechnique.COMPARISON,
  TeachingTechnique.COUNTEREXAMPLE,
  TeachingTechnique.TRACE_EXECUTION,
  TeachingTechnique.BOUNDARY_CHECK,
  TeachingTechnique.SELF_EXPLANATION,
  TeachingTechnique.VERIFICATION,
] as const

const messageIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      hasAtMostCodePoints(
        value,
        EDUCATIONAL_ANALYSIS_LIMITS.maxMessageIdCodePoints,
      ),
    {
      message: `Message ID must contain at most ${String(EDUCATIONAL_ANALYSIS_LIMITS.maxMessageIdCodePoints)} Unicode code points`,
    },
  )

const evidenceMessageIdsSchema = z
  .array(messageIdSchema)
  .max(EDUCATIONAL_ANALYSIS_LIMITS.maxNestedEvidenceMessageIds)

export const EffortEvidenceSchema = z
  .object({
    present: z.boolean(),
    quality: z.enum(SUPPORTED_EFFORT_QUALITIES),
    type: z.enum(SUPPORTED_EFFORT_TYPES).nullable(),
    addressesPreviousTutorAction: z.boolean(),
    isRepeated: z.boolean(),
    evidenceMessageIds: evidenceMessageIdsSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.present && value.type !== null) {
      context.addIssue({
        code: 'custom',
        path: ['type'],
        message: 'Absent effort evidence must use a null effort type',
      })
    }

    if (!value.present && value.quality !== EFFORT_QUALITY.NONE) {
      context.addIssue({
        code: 'custom',
        path: ['quality'],
        message: 'Absent effort evidence must use NONE quality',
      })
    }

    if (!value.present && value.addressesPreviousTutorAction) {
      context.addIssue({
        code: 'custom',
        path: ['addressesPreviousTutorAction'],
        message:
          'Absent effort evidence must not claim a previous tutor action was addressed',
      })
    }

    if (!value.present && value.isRepeated) {
      context.addIssue({
        code: 'custom',
        path: ['isRepeated'],
        message: 'Absent effort evidence must not claim a repeated attempt',
      })
    }

    if (!value.present && value.evidenceMessageIds.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceMessageIds'],
        message: 'Absent effort evidence must not include evidence IDs',
      })
    }

    if (value.present && value.type === null) {
      context.addIssue({
        code: 'custom',
        path: ['type'],
        message: 'Present effort evidence requires an effort type',
      })
    }

    if (value.present && value.quality === EFFORT_QUALITY.NONE) {
      context.addIssue({
        code: 'custom',
        path: ['quality'],
        message: 'Present effort evidence requires non-NONE quality',
      })
    }

    if (value.present && value.evidenceMessageIds.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceMessageIds'],
        message: 'Present effort evidence requires at least one evidence ID',
      })
    }
  })

export const LearningEvidenceSchema = z
  .object({
    present: z.boolean(),
    strength: z.enum(SUPPORTED_LEARNING_EVIDENCE_STRENGTHS),
    evidenceMessageIds: evidenceMessageIdsSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.present && value.strength !== LEARNING_EVIDENCE_STRENGTH.NONE) {
      context.addIssue({
        code: 'custom',
        path: ['strength'],
        message: 'Absent learning evidence must use NONE strength',
      })
    }

    if (!value.present && value.evidenceMessageIds.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceMessageIds'],
        message: 'Absent learning evidence must not include evidence IDs',
      })
    }

    if (value.present && value.strength === LEARNING_EVIDENCE_STRENGTH.NONE) {
      context.addIssue({
        code: 'custom',
        path: ['strength'],
        message: 'Present learning evidence requires non-NONE strength',
      })
    }

    if (value.present && value.evidenceMessageIds.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceMessageIds'],
        message: 'Present learning evidence requires at least one evidence ID',
      })
    }
  })

export const MisconceptionAnalysisSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .refine(
        (value) =>
          hasAtMostCodePoints(
            value,
            EDUCATIONAL_ANALYSIS_LIMITS.maxMisconceptionCodeCodePoints,
          ),
        {
          message: `Misconception code must contain at most ${String(EDUCATIONAL_ANALYSIS_LIMITS.maxMisconceptionCodeCodePoints)} Unicode code points`,
        },
      ),
    description: z
      .string()
      .trim()
      .min(1)
      .refine(
        (value) =>
          hasAtMostCodePoints(
            value,
            EDUCATIONAL_ANALYSIS_LIMITS.maxMisconceptionDescriptionCodePoints,
          ),
        {
          message: `Misconception description must contain at most ${String(EDUCATIONAL_ANALYSIS_LIMITS.maxMisconceptionDescriptionCodePoints)} Unicode code points`,
        },
      ),
    confidence: z.number().min(0).max(1),
    evidenceMessageId: messageIdSchema,
  })
  .strict()

export const EducationalAnalysisResultSchema = z
  .object({
    requestKind: z.enum(SUPPORTED_EDUCATIONAL_ANALYSIS_REQUEST_KINDS),
    studentState: z.enum(SUPPORTED_EDUCATIONAL_ANALYSIS_STUDENT_STATES),
    effortEvidence: EffortEvidenceSchema,
    learningEvidence: LearningEvidenceSchema,
    misconceptions: z
      .array(MisconceptionAnalysisSchema)
      .max(EDUCATIONAL_ANALYSIS_LIMITS.maxMisconceptions),
    topicRelation: z.enum(SUPPORTED_TOPIC_RELATIONS),
    recommendedStrategy: z.enum(SUPPORTED_RECOMMENDED_TEACHING_STRATEGIES),
    recommendedTechnique: z.enum(SUPPORTED_RECOMMENDED_TEACHING_TECHNIQUES),
    recommendedGuidanceLevel: z.number().int().min(1).max(4),
    confidence: z.number().min(0).max(1),
    evidenceReferences: z
      .array(messageIdSchema)
      .min(1)
      .max(EDUCATIONAL_ANALYSIS_LIMITS.maxEvidenceReferences),
  })
  .strict() satisfies z.ZodType<EducationalAnalysisResult>

function hasAtMostCodePoints(value: string, maximum: number): boolean {
  let codePoints = 0
  for (const _character of value) {
    codePoints += 1
    if (codePoints > maximum) {
      return false
    }
  }

  return true
}
