import { MessageRequestKind, StudentState } from '../../tutoring-values'

import type { EducationalAnalysisResult } from '../analysis/educational-analysis.types'

export function isDirectConceptualAnalysis(
  analysis: Pick<
    EducationalAnalysisResult,
    'requestKind' | 'studentState' | 'effortEvidence' | 'misconceptions'
  >,
): boolean {
  return (
    analysis.requestKind === MessageRequestKind.CONCEPTUAL &&
    !analysis.effortEvidence.present &&
    analysis.misconceptions.length === 0 &&
    analysis.studentState !== StudentState.MISCONCEPTION &&
    analysis.studentState !== StudentState.DEBUGGING_ISSUE
  )
}
