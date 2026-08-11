import {
  MessageRequestKind,
  StudentState,
} from '../tutoring-values'
import type { AnalysisContextPackage } from './analysis-context.types'
import type { EducationalAnalysisResult } from './educational-analysis.types'

const reconcilableNonAttemptKinds = new Set<MessageRequestKind>([
  MessageRequestKind.CONCEPTUAL,
  MessageRequestKind.PROBLEM_LIKE,
  MessageRequestKind.AMBIGUOUS,
])

/**
 * Reconciles the provider's primary intent label with its own structured,
 * current-message-supported effort finding. This does not infer effort from
 * student prose and does not override safety classifications.
 */
export function reconcileEducationalAnalysisRequestKind(
  result: EducationalAnalysisResult,
  context: AnalysisContextPackage,
): EducationalAnalysisResult {
  if (
    !reconcilableNonAttemptKinds.has(result.requestKind) ||
    !hasCurrentMessageAttempt(result, context.studentMessage.id)
  ) {
    return result
  }

  return {
    ...result,
    requestKind:
      result.studentState === StudentState.DEBUGGING_ISSUE
        ? MessageRequestKind.CODE_DIAGNOSIS
        : MessageRequestKind.ATTEMPT_DIAGNOSIS,
  }
}

function hasCurrentMessageAttempt(
  result: EducationalAnalysisResult,
  studentMessageId: string,
): boolean {
  const effort = result.effortEvidence

  return (
    effort.present &&
    effort.type !== null &&
    effort.evidenceMessageIds.includes(studentMessageId)
  )
}
