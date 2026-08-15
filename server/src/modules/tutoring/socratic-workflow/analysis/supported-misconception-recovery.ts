import { MessageRequestKind, StudentState } from '../../tutoring-values'
import type { PersistedEducationalAnalysisRecord } from './educational-analysis.repository'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  LEARNING_EVIDENCE_STRENGTH,
} from './educational-analysis.types'

export type SupportedMisconceptionRecoveryAnalysis = Pick<
  PersistedEducationalAnalysisRecord,
  'analysisSource' | 'studentMessageId' | 'result'
>

export function hasSupportedMisconceptionRecoveryEvidence(
  analysis: SupportedMisconceptionRecoveryAnalysis,
): boolean {
  const result = analysis.result
  const learningEvidence = result.learningEvidence

  return (
    analysis.analysisSource === EDUCATIONAL_ANALYSIS_SOURCE.MODEL &&
    result.requestKind === MessageRequestKind.ATTEMPT_DIAGNOSIS &&
    result.studentState === StudentState.NEAR_SOLUTION &&
    result.misconceptions.length === 0 &&
    learningEvidence.present &&
    learningEvidence.strength === LEARNING_EVIDENCE_STRENGTH.STRONG &&
    learningEvidence.evidenceMessageIds.includes(analysis.studentMessageId)
  )
}
