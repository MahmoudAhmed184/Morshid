import { MessageRequestKind, StudentState } from '../../tutoring-values'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  LEARNING_EVIDENCE_STRENGTH,
  type EducationalAnalysisResult,
  type EducationalAnalysisSource,
} from './educational-analysis.types'

export interface SupportedMisconceptionRecoveryAnalysis {
  readonly analysisSource: EducationalAnalysisSource
  readonly studentMessageId: string
  readonly result: Pick<
    EducationalAnalysisResult,
    'requestKind' | 'studentState' | 'learningEvidence' | 'misconceptions'
  >
}

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
