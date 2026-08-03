import type {
  LearningStatus,
  MessageRequestKind,
  MisconceptionStatus,
  ResolutionEvidenceStrength,
  RevealPolicy,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../generated/prisma/client'

export interface TopicStateSnapshot {
  id: string
  topicId: string
  version: number
  requestKind: MessageRequestKind | null
  studentState: StudentState
  activeStrategy: TeachingStrategy | null
  primaryTechnique: TeachingTechnique | null
  supportingTechnique: TeachingTechnique | null
  guidanceLevel: number
  revealPolicy: RevealPolicy
  attemptCount: number
  meaningfulAttemptCount: number
  misconceptionStatus: MisconceptionStatus | null
  learningStatus: LearningStatus
  resolutionEvidenceStrength: ResolutionEvidenceStrength
  summary: string | null
  lastTutorQuestion: string | null
  lastStudentAction: string | null
  resolved: boolean
  updatedAt: Date
}

export type TopicStatePatch = Partial<{
  requestKind: MessageRequestKind | null
  studentState: StudentState
  activeStrategy: TeachingStrategy | null
  primaryTechnique: TeachingTechnique | null
  supportingTechnique: TeachingTechnique | null
  guidanceLevel: number
  revealPolicy: RevealPolicy
  attemptCount: number
  meaningfulAttemptCount: number
  misconceptionStatus: MisconceptionStatus | null
  learningStatus: LearningStatus
  resolutionEvidenceStrength: ResolutionEvidenceStrength
  summary: string | null
  lastTutorQuestion: string | null
  lastStudentAction: string | null
  resolved: boolean
}>
