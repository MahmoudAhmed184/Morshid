import type {
  MessageRequestKind,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import type { TopicResolutionOutcome } from '../topic/topic.types'

export const EDUCATIONAL_ANALYSIS_SCHEMA_VERSION = 'educational-analysis.v2'

export const EDUCATIONAL_ANALYSIS_SOURCE = {
  MODEL: 'model',
  FALLBACK: 'fallback',
} as const

export type EducationalAnalysisSource =
  (typeof EDUCATIONAL_ANALYSIS_SOURCE)[keyof typeof EDUCATIONAL_ANALYSIS_SOURCE]

export const EDUCATIONAL_ANALYSIS_FALLBACK_REASON = {
  LOW_CONFIDENCE: 'low_confidence',
  PROVIDER_TIMEOUT: 'provider_timeout',
  PROVIDER_TRANSPORT: 'provider_transport',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  RATE_LIMIT: 'rate_limit',
  MALFORMED_OUTPUT: 'malformed_output',
  SCHEMA_VALIDATION: 'schema_validation',
  UNSUPPORTED_OUTPUT: 'unsupported_output',
} as const

export type EducationalAnalysisFallbackReason =
  (typeof EDUCATIONAL_ANALYSIS_FALLBACK_REASON)[keyof typeof EDUCATIONAL_ANALYSIS_FALLBACK_REASON]

export const EFFORT_QUALITY = {
  NONE: 'NONE',
  LOW: 'LOW',
  MEANINGFUL: 'MEANINGFUL',
  STRONG: 'STRONG',
} as const

export type EffortQuality = (typeof EFFORT_QUALITY)[keyof typeof EFFORT_QUALITY]

export const EFFORT_TYPE = {
  REASONING_ATTEMPT: 'REASONING_ATTEMPT',
  CALCULATION_ATTEMPT: 'CALCULATION_ATTEMPT',
  CODE_ATTEMPT: 'CODE_ATTEMPT',
  TRACE_ATTEMPT: 'TRACE_ATTEMPT',
  EXPLANATION_ATTEMPT: 'EXPLANATION_ATTEMPT',
  TEST_ATTEMPT: 'TEST_ATTEMPT',
  REVISION_ATTEMPT: 'REVISION_ATTEMPT',
} as const

export type EffortType = (typeof EFFORT_TYPE)[keyof typeof EFFORT_TYPE]

export const LEARNING_EVIDENCE_STRENGTH = {
  NONE: 'NONE',
  WEAK: 'WEAK',
  MODERATE: 'MODERATE',
  STRONG: 'STRONG',
} as const

export type LearningEvidenceStrength =
  (typeof LEARNING_EVIDENCE_STRENGTH)[keyof typeof LEARNING_EVIDENCE_STRENGTH]

export const ANSWER_CORRECTNESS = {
  UNASSESSED: 'UNASSESSED',
  INCORRECT: 'INCORRECT',
  PARTIALLY_CORRECT: 'PARTIALLY_CORRECT',
  CORRECT: 'CORRECT',
} as const

export type AnswerCorrectness =
  (typeof ANSWER_CORRECTNESS)[keyof typeof ANSWER_CORRECTNESS]

export const EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY = {
  MALFORMED_INPUT: 'malformed_input',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  INVALID_ENUM: 'invalid_enum',
  INVALID_RANGE: 'invalid_range',
  INVALID_NESTED_SHAPE: 'invalid_nested_shape',
  BOUND_EXCEEDED: 'bound_exceeded',
  UNKNOWN_FIELD: 'unknown_field',
  INVALID_EVIDENCE_REFERENCE: 'invalid_evidence_reference',
  UNSUPPORTED_SCHEMA_VERSION: 'unsupported_schema_version',
} as const

export type EducationalAnalysisValidationCategory =
  (typeof EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY)[keyof typeof EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY]

export interface EducationalAnalysisValidationIssue {
  category: EducationalAnalysisValidationCategory
  path: string
  message: string
}

export type EducationalAnalysisValidationResult =
  | {
      success: true
      data: EducationalAnalysisResult
    }
  | {
      success: false
      issues: EducationalAnalysisValidationIssue[]
    }

export interface EffortEvidence {
  present: boolean
  quality: EffortQuality
  type: EffortType | null
  addressesPreviousTutorAction: boolean
  isRepeated: boolean
  evidenceMessageIds: string[]
}

export interface LearningEvidence {
  present: boolean
  strength: LearningEvidenceStrength
  evidenceMessageIds: string[]
}

export interface MisconceptionAnalysis {
  code: string
  description: string
  confidence: number
  evidenceMessageId: string
}

export type TopicRelation = TopicResolutionOutcome

export interface EducationalAnalysisResult {
  requestKind: MessageRequestKind
  studentState: StudentState
  effortEvidence: EffortEvidence
  learningEvidence: LearningEvidence
  /**
   * Optional only while reading analyses persisted before v2. The v2 schema
   * always supplies these fields and policy treats their absence as unverified.
   */
  answerCorrectness?: AnswerCorrectness
  objectiveCompleted?: boolean
  misconceptionRecoveryVerified?: boolean
  misconceptions: MisconceptionAnalysis[]
  topicRelation: TopicRelation
  recommendedStrategy: TeachingStrategy
  recommendedTechnique: TeachingTechnique
  recommendedGuidanceLevel: number
  confidence: number
  evidenceReferences: string[]
}
