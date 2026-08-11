import type {
  AnalysisContextMessage,
  AnalysisContextPackage,
} from './analysis-context.types'
import type { PersistedEducationalAnalysisRecord } from './educational-analysis.repository'

export const RETRIEVAL_QUERY_VERSION = 'retrieval-query.v1'
export const MAX_RETRIEVAL_QUERY_LENGTH = 2000

export interface RetrievalQueryContext {
  readonly currentMessage: AnalysisContextPackage['studentMessage']
  readonly activeTopic: AnalysisContextPackage['activeTopic']
  readonly topicState: AnalysisContextPackage['topicState']
  readonly previousTutorQuestion: AnalysisContextPackage['previousTutorQuestion']
  readonly previousStudentAttempt: AnalysisContextPackage['previousStudentAttempt']
  readonly selectedHistory: readonly AnalysisContextMessage[]
  readonly acceptedAnalysis: PersistedEducationalAnalysisRecord
}

export interface RetrievalRequest {
  readonly query: string
  readonly queryVersion: typeof RETRIEVAL_QUERY_VERSION
  readonly contextMessageIds: readonly string[]
}
