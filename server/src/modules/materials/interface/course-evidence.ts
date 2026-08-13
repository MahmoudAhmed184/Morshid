import type { RequestBudget } from '../../../common/http/request-deadline'

export interface CourseEvidenceChunk {
  chunkId: string
  materialId: string
  materialTitle: string
  chunkIndex: number
  content: string
  rank: number
  similarityScore: number
  embeddingModel: string
}

export type CourseEvidenceResult =
  | { kind: 'evidence'; chunks: CourseEvidenceChunk[] }
  | { kind: 'insufficient_evidence' }
  | {
      kind: 'embedding_profile_not_ready'
      expectedModel: string
      incompleteMaterialIds: readonly string[]
    }

export abstract class CourseEvidence {
  abstract search(
    courseId: string,
    query: string,
    requestBudget?: RequestBudget,
  ): Promise<CourseEvidenceResult>
}
