import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import {
  EMBEDDING_PROVIDER_TOKEN,
  type EmbeddingProvider,
} from '../embedding/embedding-provider'
import { PDF_STORAGE, type PdfStorage } from '../pdf-storage/pdf-storage'
import { CourseRetrievalRepository } from './course-retrieval.repository'

export interface RetrievedChunk {
  chunkId: string
  materialId: string
  materialTitle: string
  chunkIndex: number
  content: string
  // 1-based dense rank matching the result order.
  rank: number
  // Cosine similarity (1 - cosine distance).
  similarityScore: number
}

export type CourseRetrievalResult =
  | { kind: 'evidence'; chunks: RetrievedChunk[] }
  | { kind: 'insufficient_evidence' }

@Injectable()
export class RetrievalService {
  private readonly topK: number
  private readonly minSimilarity: number

  constructor(
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly courseRetrievalRepository: CourseRetrievalRepository,
    configService: ConfigService<AppEnvironment, true>,
    @Inject(PDF_STORAGE) private readonly pdfStorage: PdfStorage,
  ) {
    this.topK = configService.get('RETRIEVAL_TOP_K', { infer: true })
    this.minSimilarity = configService.get('RETRIEVAL_MIN_SIMILARITY', {
      infer: true,
    })
  }

  // courseId must already be authorized by the caller (CourseAccessService at
  // the route layer). Enforcement here is structural: the course predicate is
  // a mandatory part of the signature and the SQL, so there is no unscoped
  // variant to call. An unauthorized courseId is not observable at this layer
  // (no request context), so cross-course denial auditing stays at the
  // authorizing access layer (access.course_boundary_denied). Chunk text is
  // never logged.
  async retrieveCourseEvidence(
    courseId: string,
    query: string,
  ): Promise<CourseRetrievalResult> {
    // A blank query can never match evidence; short-circuit before the
    // provider, whose contract rejects whitespace-only texts, so callers see
    // the retrieval result type instead of an embedding-module error.
    const trimmedQuery = query.trim()
    if (trimmedQuery.length === 0) {
      return { kind: 'insufficient_evidence' }
    }

    const [queryEmbedding] = await this.embeddingProvider.embedBatch([
      trimmedQuery,
    ])

    const rows = await this.courseRetrievalRepository.findTopChunksForCourse({
      courseId,
      queryEmbedding,
      topK: this.topK,
      minSimilarity: this.minSimilarity,
    })

    const availableRows = (
      await Promise.all(
        rows.map(async (row) => ({
          row,
          available: await this.isBackingFileAvailable(row.storagePath),
        })),
      )
    ).filter(({ available }) => available)

    if (availableRows.length === 0) {
      return { kind: 'insufficient_evidence' }
    }

    return {
      kind: 'evidence',
      chunks: availableRows.map(({ row }, index) => ({
        chunkId: row.chunkId,
        materialId: row.materialId,
        materialTitle: row.materialTitle,
        chunkIndex: row.chunkIndex,
        content: row.content,
        rank: index + 1,
        similarityScore: 1 - row.distance,
      })),
    }
  }

  private async isBackingFileAvailable(storagePath: string): Promise<boolean> {
    try {
      return await this.pdfStorage.exists(storagePath)
    } catch {
      return false
    }
  }
}
