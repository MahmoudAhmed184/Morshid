import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  assertRequestBudget,
  type RequestBudget,
} from '../../../common/http/request-deadline'
import {
  EMBEDDING_PROVIDER_TOKEN,
  type EmbeddingProvider,
} from '../../../platform/ai/embedding/embedding-provider'
import type { AppEnvironment } from '../../../platform/config/env.schema'
import {
  PDF_STORAGE,
  type PdfStorage,
} from '../../../platform/document-storage/pdf-storage'
import { readMaterialsConfiguration } from '../upload/materials.configuration'
import {
  CourseEvidenceRepository,
  type RankedChunkRow,
} from './course-evidence.repository'
import {
  CourseEvidence,
  type CourseEvidenceResult,
} from '../interface/course-evidence'

const AVAILABILITY_SCAN_MULTIPLIER = 5

@Injectable()
export class MaterialsCourseEvidence extends CourseEvidence {
  private readonly logger = new Logger(MaterialsCourseEvidence.name)
  private readonly topK: number
  private readonly minSimilarity: number

  constructor(
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly courseRetrievalRepository: CourseEvidenceRepository,
    configService: ConfigService<AppEnvironment, true>,
    @Inject(PDF_STORAGE) private readonly pdfStorage: PdfStorage,
  ) {
    super()
    const configuration = readMaterialsConfiguration(configService)
    this.topK = configuration.RETRIEVAL_TOP_K
    this.minSimilarity = configuration.RETRIEVAL_MIN_SIMILARITY
  }

  // courseId must already be authorized by the caller (CourseAccessService at
  // the route layer). Enforcement here is structural: the course predicate is
  // a mandatory part of the signature and the SQL, so there is no unscoped
  // variant to call. An unauthorized courseId is not observable at this layer
  // (no request context), so cross-course denial auditing stays at the
  // authorizing access layer (access.course_boundary_denied). Chunk text is
  // never logged.
  async search(
    courseId: string,
    query: string,
    requestBudget?: RequestBudget,
  ): Promise<CourseEvidenceResult> {
    assertRequestBudget(requestBudget)
    // A blank query can never match evidence; short-circuit before the
    // provider, whose contract rejects whitespace-only texts, so callers see
    // the retrieval result type instead of an embedding-module error.
    const trimmedQuery = query.trim()
    if (trimmedQuery.length === 0) {
      return { kind: 'insufficient_evidence' }
    }

    // Strict course readiness, checked before the query is embedded: one
    // incompletely embedded candidate material blocks grounded retrieval for
    // the whole course. Running it first means a course with no vectors in the
    // active profile never spends provider quota on a query vector.
    //
    // Readiness and retrieval are separate queries, not one atomic snapshot,
    // so a material replacement running concurrently can produce a transient
    // not-ready or no-evidence result. The profile filter in the retrieval SQL
    // still prevents cross-space comparisons, which is the property that
    // matters; the transient answer resolves on the next turn.
    const embeddingModel = this.embeddingProvider.model
    const readiness =
      await this.courseRetrievalRepository.findCourseEvidenceReadiness({
        courseId,
        embeddingModel,
      })
    assertRequestBudget(requestBudget)
    this.logger.debug({
      event: 'retrieval_embedding_protocol',
      embeddingModel,
      queryProtocol: this.embeddingProvider.queryProtocol,
      readiness: readiness.kind,
    })

    if (readiness.kind === 'no_candidate_materials') {
      return { kind: 'insufficient_evidence' }
    }

    if (readiness.kind === 'not_ready') {
      // `queryProtocol` is diagnostic only — there is no column for it — so a
      // change to the query task is observable in logs and nowhere else.
      this.logger.warn({
        event: 'retrieval_embedding_profile_not_ready',
        expectedModel: embeddingModel,
        queryProtocol: this.embeddingProvider.queryProtocol,
        incompleteMaterialCount: readiness.incompleteMaterialCount,
        incompleteMaterialIds: readiness.incompleteMaterialIds,
      })
      return {
        kind: 'embedding_profile_not_ready',
        expectedModel: embeddingModel,
        incompleteMaterialIds: readiness.incompleteMaterialIds,
      }
    }

    const queryEmbedding =
      requestBudget === undefined
        ? await this.embeddingProvider.embedQuery(trimmedQuery)
        : await this.embeddingProvider.embedQuery(trimmedQuery, {
            signal: requestBudget.signal,
          })
    assertRequestBudget(requestBudget)

    const availableRows: RankedChunkRow[] = []
    const availabilityByStoragePath = new Map<string, Promise<boolean>>()
    const maxCandidates = this.topK * AVAILABILITY_SCAN_MULTIPLIER
    let offset = 0

    while (offset < maxCandidates && availableRows.length < this.topK) {
      assertRequestBudget(requestBudget)
      const pageSize = Math.min(this.topK, maxCandidates - offset)
      const rows = await this.courseRetrievalRepository.findTopChunksForCourse({
        courseId,
        queryEmbedding,
        embeddingModel,
        topK: pageSize,
        minSimilarity: this.minSimilarity,
        offset,
      })

      const checkedRows = await Promise.all(
        rows.map(async (row) => ({
          row,
          available: await this.getBackingFileAvailability(
            row.storagePath,
            availabilityByStoragePath,
          ),
        })),
      )
      assertRequestBudget(requestBudget)
      for (const checked of checkedRows) {
        if (checked.available) {
          availableRows.push(checked.row)
          if (availableRows.length === this.topK) {
            break
          }
        }
      }

      offset += rows.length
      if (rows.length < pageSize) {
        break
      }
    }

    if (availableRows.length === 0) {
      return { kind: 'insufficient_evidence' }
    }

    return {
      kind: 'evidence',
      chunks: availableRows.map((row, index) => ({
        chunkId: row.chunkId,
        materialId: row.materialId,
        materialTitle: row.materialTitle,
        chunkIndex: row.chunkIndex,
        content: row.content,
        rank: index + 1,
        similarityScore: 1 - row.distance,
        embeddingModel,
      })),
    }
  }

  private getBackingFileAvailability(
    storagePath: string,
    availabilityByStoragePath: Map<string, Promise<boolean>>,
  ): Promise<boolean> {
    const existing = availabilityByStoragePath.get(storagePath)
    if (existing !== undefined) {
      return existing
    }

    const availability = this.isBackingFileAvailable(storagePath)
    availabilityByStoragePath.set(storagePath, availability)
    return availability
  }

  private async isBackingFileAvailable(storagePath: string): Promise<boolean> {
    try {
      return await this.pdfStorage.exists(storagePath)
    } catch {
      return false
    }
  }
}
