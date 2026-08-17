import type { AutomaticSafetyRiskDetection } from '../response-governance/automatic-safety-risk.detector'
import type { ControlledSourceConflict } from '../response-governance/controlled-source-conflict.detector'
import type { RequestBudget } from '../../../common/http/request-deadline'
import type { CourseEvidenceChunk } from '../../materials/interface/course-evidence'
import type { ApprovedResponse } from './response-approval/response-validation.types'
import type { ResponseAuditGraph } from './response-approval/response-audit.types'
import type { SafeFallbackReason } from './response-approval/safe-fallback.service'
import type { TopicStateTransition } from './topic/topic-state-transition'
import type {
  MessageGuidanceLabel,
  MessageRequestKind,
} from '../tutoring-values'

export interface SocraticTopicSelection {
  readonly topicId?: string | null
  readonly problemId?: string
  readonly conceptId?: string
  readonly title?: string
}

/**
 * Input from the Tutoring runtime adapter to the private Socratic workflow.
 *
 * Admission has already persisted the Attempt and its Student/Assistant
 * message pair before the workflow is invoked.
 */
export interface SocraticWorkflowInput {
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
  readonly attemptId: string
  readonly studentMessageId: string
  readonly assistantMessageId: string
  readonly studentMessageContent: string
  readonly explicitProtectedSolutionSignal: boolean
  readonly debuggingAdmission?: {
    readonly rewriteRequested: boolean
  }
  readonly topicSelection?: SocraticTopicSelection
  readonly requestBudget?: RequestBudget
}

export type SocraticWorkflowResult =
  | {
      readonly kind: 'completed'
      readonly completion:
        | {
            readonly kind: 'classified'
            readonly content: string
            readonly requestKind: MessageRequestKind
            readonly guidanceLabel: MessageGuidanceLabel
            readonly errorCode: string
            readonly promptVersion: string
            readonly topicId: string
            readonly topicStateTransition: TopicStateTransition
          }
        | {
            readonly kind: 'approved'
            readonly approvedResponse: ApprovedResponse
            readonly evidence: readonly CourseEvidenceChunk[]
            readonly requestKind: MessageRequestKind
            readonly topicId: string
            readonly guidanceLevel: number
            readonly safeFallbackReason: SafeFallbackReason | null
            readonly auditGraph: ResponseAuditGraph
            readonly topicStateTransition: TopicStateTransition
          }
    }
  | {
      readonly kind: 'safety_refusal'
      readonly detection: AutomaticSafetyRiskDetection
      readonly topicId: string | null
      readonly auditGraph?: ResponseAuditGraph
    }
  | {
      readonly kind: 'source_conflict'
      readonly conflict: ControlledSourceConflict
      readonly topicId: string | null
    }
  | {
      readonly kind: 'blocked'
      readonly reason: 'insufficient_evidence' | 'embedding_profile_not_ready'
      readonly topicId: string | null
    }
  | {
      readonly kind: 'failed'
      readonly errorCode: string
      readonly topicId: string | null
    }
