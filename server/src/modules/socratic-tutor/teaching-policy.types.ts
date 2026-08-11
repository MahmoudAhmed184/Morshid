import type {
  ReflectionMode,
  RevealPolicy,
  TeachingStrategy,
  TeachingTechnique,
} from '../../generated/prisma/client'

export const TEACHING_POLICY_VERSION = 'socratic-policy.mvp.v2'

export interface TeachingGuardPolicy {
  preventDirectAnswer: boolean
  preventFinalResult: boolean
  preventCompleteSolution: boolean
  preventSubmissionReadyCode: boolean
  preventProtectedCodeLeakage: boolean
  requireStudentReasoning: boolean
  requireGrounding: boolean
  enforceCitationSupport: boolean
  maximumDisclosedSteps: 1
}

export function normalizeTeachingGuardPolicy(
  value: unknown,
): TeachingGuardPolicy {
  const policy = isRecord(value) ? value : {}

  return {
    preventDirectAnswer: policy.preventDirectAnswer !== false,
    preventFinalResult: policy.preventFinalResult !== false,
    preventCompleteSolution: policy.preventCompleteSolution !== false,
    preventSubmissionReadyCode: policy.preventSubmissionReadyCode !== false,
    preventProtectedCodeLeakage: policy.preventProtectedCodeLeakage !== false,
    requireStudentReasoning: policy.requireStudentReasoning !== false,
    requireGrounding: policy.requireGrounding !== false,
    enforceCitationSupport: policy.enforceCitationSupport !== false,
    maximumDisclosedSteps: 1,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  attemptId: string
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
