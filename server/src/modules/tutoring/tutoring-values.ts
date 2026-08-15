export const MessageRole = {
  STUDENT: 'STUDENT',
  ASSISTANT: 'ASSISTANT',
  SYSTEM: 'SYSTEM',
} as const

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole]

export const MessageStatus = {
  PENDING: 'PENDING',
  STREAMING: 'STREAMING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
} as const

export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus]

export const MessageRequestKind = {
  CONCEPTUAL: 'CONCEPTUAL',
  PROBLEM_LIKE: 'PROBLEM_LIKE',
  ATTEMPT_DIAGNOSIS: 'ATTEMPT_DIAGNOSIS',
  CODE_DIAGNOSIS: 'CODE_DIAGNOSIS',
  UNSAFE: 'UNSAFE',
  OFF_TOPIC: 'OFF_TOPIC',
  AMBIGUOUS: 'AMBIGUOUS',
} as const

export type MessageRequestKind =
  (typeof MessageRequestKind)[keyof typeof MessageRequestKind]

export const MessageGuidanceLabel = {
  COURSE_GROUNDED: 'COURSE_GROUNDED',
  GENERAL_NOT_FOUND: 'GENERAL_NOT_FOUND',
  UNCERTAIN_AWAITING_REVIEW: 'UNCERTAIN_AWAITING_REVIEW',
  INSTRUCTOR_REVIEWED: 'INSTRUCTOR_REVIEWED',
  REFUSAL: 'REFUSAL',
} as const

export type MessageGuidanceLabel =
  (typeof MessageGuidanceLabel)[keyof typeof MessageGuidanceLabel]

export const StudentState = {
  UNKNOWN: 'UNKNOWN',
  NO_PRIOR_KNOWLEDGE: 'NO_PRIOR_KNOWLEDGE',
  PARTIAL_UNDERSTANDING: 'PARTIAL_UNDERSTANDING',
  MISCONCEPTION: 'MISCONCEPTION',
  DEBUGGING_ISSUE: 'DEBUGGING_ISSUE',
  NEAR_SOLUTION: 'NEAR_SOLUTION',
} as const

export type StudentState = (typeof StudentState)[keyof typeof StudentState]

export const TeachingStrategy = {
  SOCRATIC_QUESTIONING: 'SOCRATIC_QUESTIONING',
  GUIDED_EXPLANATION: 'GUIDED_EXPLANATION',
  MISCONCEPTION_REPAIR: 'MISCONCEPTION_REPAIR',
  DEBUGGING_GUIDANCE: 'DEBUGGING_GUIDANCE',
} as const

export type TeachingStrategy =
  (typeof TeachingStrategy)[keyof typeof TeachingStrategy]

export const TeachingTechnique = {
  ORIENTATION_QUESTION: 'ORIENTATION_QUESTION',
  FOCUSED_QUESTION: 'FOCUSED_QUESTION',
  DECOMPOSITION: 'DECOMPOSITION',
  ANALOGY: 'ANALOGY',
  COMPARISON: 'COMPARISON',
  COUNTEREXAMPLE: 'COUNTEREXAMPLE',
  TRACE_EXECUTION: 'TRACE_EXECUTION',
  BOUNDARY_CHECK: 'BOUNDARY_CHECK',
  SELF_EXPLANATION: 'SELF_EXPLANATION',
  VERIFICATION: 'VERIFICATION',
} as const

export type TeachingTechnique =
  (typeof TeachingTechnique)[keyof typeof TeachingTechnique]

export const ReflectionMode = {
  NONE: 'NONE',
  SELF_EXPLANATION: 'SELF_EXPLANATION',
  VERIFICATION: 'VERIFICATION',
  TRANSFER: 'TRANSFER',
} as const

export type ReflectionMode =
  (typeof ReflectionMode)[keyof typeof ReflectionMode]

export const RevealPolicy = {
  NO_FINAL_ANSWER: 'NO_FINAL_ANSWER',
  PARTIAL_RESULT_ALLOWED: 'PARTIAL_RESULT_ALLOWED',
  FINAL_REASONING_ALLOWED: 'FINAL_REASONING_ALLOWED',
  COMPLETE_SOLUTION_ALLOWED: 'COMPLETE_SOLUTION_ALLOWED',
} as const

export type RevealPolicy = (typeof RevealPolicy)[keyof typeof RevealPolicy]

export const TutoringAttemptStatus = {
  RECEIVED: 'RECEIVED',
  ANALYZING: 'ANALYZING',
  RETRIEVING: 'RETRIEVING',
  DECIDING: 'DECIDING',
  GENERATING: 'GENERATING',
  VALIDATING: 'VALIDATING',
  REGENERATING: 'REGENERATING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const

export type TutoringAttemptStatus =
  (typeof TutoringAttemptStatus)[keyof typeof TutoringAttemptStatus]

export const TopicStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  RESOLVED: 'RESOLVED',
  ABANDONED: 'ABANDONED',
} as const

export type TopicStatus = (typeof TopicStatus)[keyof typeof TopicStatus]

export const SolutionProtectionStatus = {
  UNKNOWN: 'UNKNOWN',
  UNPROTECTED: 'UNPROTECTED',
  PROTECTED: 'PROTECTED',
} as const

export type SolutionProtectionStatus =
  (typeof SolutionProtectionStatus)[keyof typeof SolutionProtectionStatus]

export const SolutionProtectionSource = {
  AUTHORITATIVE_TASK_METADATA: 'AUTHORITATIVE_TASK_METADATA',
  EXPLICIT_PROTECTED_REQUEST: 'EXPLICIT_PROTECTED_REQUEST',
  ACCEPTED_TASK_ANALYSIS: 'ACCEPTED_TASK_ANALYSIS',
  ACCEPTED_CONCEPT_ANALYSIS: 'ACCEPTED_CONCEPT_ANALYSIS',
  MIGRATED_TOPIC_HISTORY: 'MIGRATED_TOPIC_HISTORY',
  MIGRATED_CONCEPT_TOPIC: 'MIGRATED_CONCEPT_TOPIC',
  CONSERVATIVE_UNKNOWN: 'CONSERVATIVE_UNKNOWN',
} as const

export type SolutionProtectionSource =
  (typeof SolutionProtectionSource)[keyof typeof SolutionProtectionSource]

export const OutputRiskAuditSource = {
  APPROVAL_CANDIDATE: 'APPROVAL_CANDIDATE',
  SAFE_FALLBACK: 'SAFE_FALLBACK',
  POST_APPROVAL: 'POST_APPROVAL',
} as const

export type OutputRiskAuditSource =
  (typeof OutputRiskAuditSource)[keyof typeof OutputRiskAuditSource]

export const TopicType = {
  PROBLEM: 'PROBLEM',
  CONCEPT: 'CONCEPT',
  DEBUGGING_TASK: 'DEBUGGING_TASK',
  ASSIGNMENT_ITEM: 'ASSIGNMENT_ITEM',
  MISCONCEPTION_REPAIR: 'MISCONCEPTION_REPAIR',
  UNCLASSIFIED: 'UNCLASSIFIED',
} as const

export type TopicType = (typeof TopicType)[keyof typeof TopicType]

export const MisconceptionStatus = {
  SUSPECTED: 'SUSPECTED',
  ACTIVE: 'ACTIVE',
  CORRECTED: 'CORRECTED',
  DISMISSED: 'DISMISSED',
} as const

export type MisconceptionStatus =
  (typeof MisconceptionStatus)[keyof typeof MisconceptionStatus]

export const LearningStatus = {
  UNKNOWN: 'UNKNOWN',
  IN_PROGRESS: 'IN_PROGRESS',
  DEMONSTRATED: 'DEMONSTRATED',
  VERIFIED: 'VERIFIED',
} as const

export type LearningStatus =
  (typeof LearningStatus)[keyof typeof LearningStatus]

export const ResolutionEvidenceStrength = {
  NONE: 'NONE',
  WEAK: 'WEAK',
  MODERATE: 'MODERATE',
  STRONG: 'STRONG',
} as const

export type ResolutionEvidenceStrength =
  (typeof ResolutionEvidenceStrength)[keyof typeof ResolutionEvidenceStrength]

export const EducationalAnalysisEvidenceKind = {
  TOP_LEVEL: 'TOP_LEVEL',
  EFFORT: 'EFFORT',
  LEARNING: 'LEARNING',
} as const

export type EducationalAnalysisEvidenceKind =
  (typeof EducationalAnalysisEvidenceKind)[keyof typeof EducationalAnalysisEvidenceKind]

export const TutoringCandidateGenerationOutcome = {
  GENERATED: 'GENERATED',
  INVALID_OUTPUT: 'INVALID_OUTPUT',
  INFRASTRUCTURE_EXHAUSTED: 'INFRASTRUCTURE_EXHAUSTED',
} as const

export type TutoringCandidateGenerationOutcome =
  (typeof TutoringCandidateGenerationOutcome)[keyof typeof TutoringCandidateGenerationOutcome]

export const TutoringApprovalSource = {
  VALIDATED_CANDIDATE: 'VALIDATED_CANDIDATE',
  SAFE_FALLBACK: 'SAFE_FALLBACK',
  CLASSIFIED_RESPONSE: 'CLASSIFIED_RESPONSE',
} as const

export type TutoringApprovalSource =
  (typeof TutoringApprovalSource)[keyof typeof TutoringApprovalSource]

export const TutoringAttemptFailureCode = {
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  RETRIEVAL_FAILED: 'RETRIEVAL_FAILED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  STRUCTURAL_VALIDATION_FAILED: 'STRUCTURAL_VALIDATION_FAILED',
  DETERMINISTIC_GUARD_REJECTED: 'DETERMINISTIC_GUARD_REJECTED',
  SEMANTIC_GUARD_REJECTED: 'SEMANTIC_GUARD_REJECTED',
  REGENERATION_EXHAUSTED: 'REGENERATION_EXHAUSTED',
  PERSISTENCE_FAILED: 'PERSISTENCE_FAILED',
} as const

export type TutoringAttemptFailureCode =
  (typeof TutoringAttemptFailureCode)[keyof typeof TutoringAttemptFailureCode]

export const TutoringSafeFallbackReason = {
  VALIDATION_EXHAUSTED: 'VALIDATION_EXHAUSTED',
  GUARD_UNAVAILABLE: 'GUARD_UNAVAILABLE',
  GENERATION_RETRY_FAILED: 'GENERATION_RETRY_FAILED',
} as const

export type TutoringSafeFallbackReason =
  (typeof TutoringSafeFallbackReason)[keyof typeof TutoringSafeFallbackReason]
