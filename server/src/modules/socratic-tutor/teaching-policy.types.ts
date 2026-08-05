import type {
  ReflectionMode,
  RevealPolicy,
  TeachingStrategy,
  TeachingTechnique,
} from '../../generated/prisma/client'

export const TEACHING_POLICY_VERSION = 'socratic-policy.mvp.v1'

export interface TeachingGuardPolicy {
  preventDirectAnswer: true
  preventFinalResult: true
  preventCompleteSolution: true
  preventSubmissionReadyCode: true
  requireStudentReasoning: true
  requireGrounding: true
  enforceCitationSupport: true
  maximumDisclosedSteps: 1
}

export interface CourseTutorConfiguration {
  maximumGuidanceLevel?: number
  defaultRevealPolicy?: RevealPolicy
  reflectionEnabled?: boolean
}

export interface TeachingPolicyDefaults {
  maximumGuidanceLevel: number
  defaultRevealPolicy: RevealPolicy
  reflectionEnabled: false
}

export interface PreviousTeachingDecisionSnapshot {
  id: string
  turnId: string
  topicId: string
  analysisId: string
  strategy: TeachingStrategy
  primaryTechnique: TeachingTechnique
  supportingTechnique: TeachingTechnique | null
  guidanceLevel: number
  revealPolicy: RevealPolicy
  reflectionMode: ReflectionMode
  requireStudentAction: boolean
  guardPolicy: TeachingGuardPolicy
  decisionReason: string
  policyVersion: string
  createdAt: Date
}
