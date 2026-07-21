import { Inject, Injectable } from '@nestjs/common'

import { MaterialStatus } from '../../generated/prisma/client'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_PROVIDER_TOKEN,
  type EmbeddingProvider,
} from '../embedding/embedding-provider'
import { PDF_STORAGE, type PdfStorage } from '../pdf-storage/pdf-storage'
import { chunkNormalizedText } from './deterministic-text-chunker'
import {
  MATERIAL_PROCESSING_ERROR_CODES,
  MATERIAL_PROCESSING_SAFE_MESSAGES,
  MaterialNoLongerProcessableError,
  SafeMaterialProcessingError,
  type MaterialProcessingErrorCode,
} from './material-processing.errors'
import { MaterialProcessingAuditService } from './material-processing.audit.service'
import { MaterialProcessingRepository } from './material-processing.repository'
import { PdfTextExtractor } from './pdf-text.extractor'
import { normalizeExtractedText } from './text-normalizer'

export type MaterialProcessingOutcome =
  | typeof MaterialStatus.READY
  | typeof MaterialStatus.WARNING
  | typeof MaterialStatus.FAILED
  | 'SKIPPED'

@Injectable()
export class MaterialProcessingService {
  constructor(
    private readonly materialProcessingRepository: MaterialProcessingRepository,
    private readonly pdfTextExtractor: PdfTextExtractor,
    private readonly materialProcessingAuditService: MaterialProcessingAuditService,
    @Inject(PDF_STORAGE) private readonly pdfStorage: PdfStorage,
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  async processMaterial(
    materialId: string,
  ): Promise<MaterialProcessingOutcome> {
    const startedAt = Date.now()
    const material =
      await this.materialProcessingRepository.findProcessableMaterial(
        materialId,
      )

    if (material === null) {
      return 'SKIPPED'
    }

    let normalizedText: string | null = null

    try {
      const pdfBytes = await this.readPdf(material.storagePath)
      const extraction = await this.pdfTextExtractor.extract(pdfBytes)
      normalizedText = normalizeExtractedText(extraction.text)

      if (normalizedText === '') {
        throw new SafeMaterialProcessingError(
          MATERIAL_PROCESSING_ERROR_CODES.NO_EXTRACTABLE_TEXT,
        )
      }

      const chunks = chunkNormalizedText(normalizedText)

      if (chunks.length === 0) {
        throw new SafeMaterialProcessingError(
          MATERIAL_PROCESSING_ERROR_CODES.CHUNKING_FAILED,
        )
      }

      const embeddings = await this.embedChunks(
        chunks.map((chunk) => chunk.content),
      )
      const firstWarning =
        extraction.warnings.length === 0 ? undefined : extraction.warnings[0]
      const finalStatus =
        firstWarning === undefined
          ? MaterialStatus.READY
          : MaterialStatus.WARNING

      try {
        await this.materialProcessingRepository.completeProcessing({
          materialId: material.id,
          status: finalStatus,
          extractedTextLength: normalizedText.length,
          warningMessage:
            firstWarning === undefined ? null : firstWarning.message,
          chunks: chunks.map((chunk, index) => ({
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            embedding: embeddings[index],
            embeddingModel: this.embeddingProvider.model,
          })),
        })
      } catch (error) {
        if (error instanceof MaterialNoLongerProcessableError) {
          return 'SKIPPED'
        }

        throw new SafeMaterialProcessingError(
          MATERIAL_PROCESSING_ERROR_CODES.PERSISTENCE_FAILED,
        )
      }

      await this.recordSuccessfulAudit({
        actorUserId: material.uploadedById,
        materialId: material.id,
        courseId: material.courseId,
        status: finalStatus,
        extractedTextLength: normalizedText.length,
        chunkCount: chunks.length,
        warningCode: firstWarning === undefined ? null : firstWarning.code,
        durationMs: Date.now() - startedAt,
      })

      return finalStatus
    } catch (error) {
      if (error instanceof MaterialNoLongerProcessableError) {
        return 'SKIPPED'
      }

      const safeError = toSafeProcessingError(error)
      const extractedTextLength =
        normalizedText === null ? null : normalizedText.length

      try {
        await this.materialProcessingRepository.failProcessing({
          materialId: material.id,
          extractedTextLength:
            safeError.code ===
            MATERIAL_PROCESSING_ERROR_CODES.NO_EXTRACTABLE_TEXT
              ? 0
              : extractedTextLength,
          errorMessage: safeError.message,
        })
      } catch (failureError) {
        if (failureError instanceof MaterialNoLongerProcessableError) {
          return 'SKIPPED'
        }

        throw failureError
      }

      await this.materialProcessingAuditService.recordFailed({
        actorUserId: material.uploadedById,
        materialId: material.id,
        courseId: material.courseId,
        extractedTextLength:
          safeError.code === MATERIAL_PROCESSING_ERROR_CODES.NO_EXTRACTABLE_TEXT
            ? 0
            : extractedTextLength,
        chunkCount: 0,
        errorCode: safeError.code,
        durationMs: Date.now() - startedAt,
      })

      return MaterialStatus.FAILED
    }
  }

  private async readPdf(storagePath: string): Promise<Buffer> {
    try {
      return await this.pdfStorage.read(storagePath)
    } catch {
      throw new SafeMaterialProcessingError(
        MATERIAL_PROCESSING_ERROR_CODES.STORAGE_READ_FAILED,
      )
    }
  }

  private async embedChunks(
    chunks: readonly string[],
  ): Promise<readonly (readonly number[])[]> {
    try {
      const embeddings = await this.embeddingProvider.embedBatch(chunks)

      if (
        embeddings.length !== chunks.length ||
        !embeddings.every(isValidEmbedding)
      ) {
        throw new SafeMaterialProcessingError(
          MATERIAL_PROCESSING_ERROR_CODES.EMBEDDING_FAILED,
        )
      }

      return embeddings
    } catch (error) {
      if (error instanceof SafeMaterialProcessingError) {
        throw error
      }

      throw new SafeMaterialProcessingError(
        MATERIAL_PROCESSING_ERROR_CODES.EMBEDDING_FAILED,
      )
    }
  }

  private recordSuccessfulAudit(input: {
    actorUserId: string
    materialId: string
    courseId: string
    status: typeof MaterialStatus.READY | typeof MaterialStatus.WARNING
    extractedTextLength: number
    chunkCount: number
    warningCode: string | null
    durationMs: number
  }): Promise<void> {
    const auditInput = {
      actorUserId: input.actorUserId,
      materialId: input.materialId,
      courseId: input.courseId,
      extractedTextLength: input.extractedTextLength,
      chunkCount: input.chunkCount,
      embeddingModel: this.embeddingProvider.model,
      durationMs: input.durationMs,
    }

    if (input.status === MaterialStatus.WARNING) {
      return this.materialProcessingAuditService.recordWarning({
        ...auditInput,
        warningCode: input.warningCode,
      })
    }

    return this.materialProcessingAuditService.recordReady(auditInput)
  }
}

function toSafeProcessingError(error: unknown): SafeMaterialProcessingError {
  if (error instanceof SafeMaterialProcessingError) {
    return error
  }

  return new SafeMaterialProcessingError(
    MATERIAL_PROCESSING_ERROR_CODES.PERSISTENCE_FAILED,
  )
}

function isValidEmbedding(embedding: readonly number[]): boolean {
  return (
    embedding.length === EMBEDDING_DIMENSIONS &&
    embedding.every((component) => Number.isFinite(component))
  )
}

export function getSafeMaterialProcessingMessage(
  code: MaterialProcessingErrorCode,
): string {
  return MATERIAL_PROCESSING_SAFE_MESSAGES[code]
}
