export interface StudentCitationEvidence {
  rank: number
  similarityScore: number
  chunkId: string
  chunkNumber: number
  excerpt: string
}

export interface StudentCitationSource {
  messageId: string
  order: number
  materialId: string
  materialTitle: string
  sourceAvailable: boolean
  sourceStatus: 'AVAILABLE' | 'DELETED' | 'UNAVAILABLE'
  evidence: readonly StudentCitationEvidence[]
}

export interface MessagePolicyEvidenceSource {
  materialId: string
  materialTitle?: string
  chunkId: string
  chunkIndex: number
  excerpt: string
  rank: number
  score?: number
  embeddingModel: string
}

export abstract class StudentCitationSources {
  abstract loadForMessages(
    messageIds: readonly string[],
  ): Promise<readonly StudentCitationSource[]>

  abstract loadPolicyEvidence(
    messageId: string,
  ): Promise<readonly MessagePolicyEvidenceSource[]>
}
