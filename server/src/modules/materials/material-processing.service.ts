import { randomUUID } from 'node:crypto'

import { Inject, Injectable, Logger } from '@nestjs/common'

import type { RecordAuditEventInput } from '../audit/audit.service'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../audit/audit.constants'
import {
  PDF_STORAGE,
  PdfStorageNotFoundError,
  type PdfStorage,
} from '../pdf-storage/pdf-storage'
import { MaterialChunkEmbeddingService } from '../rag-persistence/material-chunk-embedding.service'
import { MaterialTextChunker } from './material-text-chunker'
import { MaterialsRepository } from './materials.repository'
import {
  PDF_TEXT_EXTRACTOR,
  PdfExtractionError,
  PDF_TEXT_WARNINGS,
  type PdfTextWarning,
  type PdfTextExtractor,
} from './pdf-text-extractor'

export const MATERIAL_PROCESSING_FAILURES = {
  BACKING_FILE_MISSING: 'BACKING_FILE_MISSING',
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
  PDF_EXTRACTION_FAILED: 'PDF_EXTRACTION_FAILED',
  NO_EXTRACTABLE_TEXT: 'NO_EXTRACTABLE_TEXT',
  EMBEDDING_FAILED: 'EMBEDDING_FAILED',
  FINALIZATION_FAILED: 'FINALIZATION_FAILED',
} as const

export type MaterialProcessingFailure =
  (typeof MATERIAL_PROCESSING_FAILURES)[keyof typeof MATERIAL_PROCESSING_FAILURES]

export const MATERIAL_PROCESSING_SAFE_MESSAGES = {
  BACKING_FILE_MISSING: 'The PDF backing file could not be found.',
  STORAGE_READ_FAILED: 'The PDF could not be read from storage.',
  PDF_EXTRACTION_FAILED: 'The PDF text could not be extracted.',
  NO_EXTRACTABLE_TEXT:
    'No extractable text was found. Scanned PDFs are not supported.',
  EMBEDDING_FAILED: 'The material could not be embedded.',
  FINALIZATION_FAILED: 'The extracted content could not be saved.',
} satisfies Record<MaterialProcessingFailure, string>

export const MATERIAL_PROCESSING_WARNING_MESSAGES = {
  [PDF_TEXT_WARNINGS.PARTIAL_PAGE_TEXT]:
    'Some PDF pages did not contain extractable text.',
} satisfies Record<PdfTextWarning, string>

@Injectable()
export class MaterialProcessingService {
  private readonly logger = new Logger(MaterialProcessingService.name)

  constructor(
    private readonly materialsRepository: MaterialsRepository,
    @Inject(PDF_STORAGE) private readonly pdfStorage: PdfStorage,
    @Inject(PDF_TEXT_EXTRACTOR)
    private readonly pdfTextExtractor: PdfTextExtractor,
    private readonly materialTextChunker: MaterialTextChunker,
    private readonly materialChunkEmbeddingService: MaterialChunkEmbeddingService,
  ) {}

  async processMaterial(materialId: string): Promise<void> {
    const processingAttemptId = randomUUID()
    let material: {
      id: string
      courseId: string
      uploadedById: string
      storagePath: string
    } | null

    try {
      material = await this.materialsRepository.claimMaterialProcessing(
        materialId,
        processingAttemptId,
      )
    } catch {
      this.logger.error(
        `Material processing claim failed materialId=${materialId}`,
      )
      return
    }

    if (material === null) {
      return
    }

    let stage: 'storage' | 'extraction' | 'embedding' | 'finalization' =
      'storage'
    let extractedTextLength: number | null = null

    try {
      const contents = await this.pdfStorage.read(material.storagePath)
      stage = 'extraction'
      const extraction = await this.pdfTextExtractor.extract(contents)
      const normalizedText = this.materialTextChunker.normalize(extraction.text)
      extractedTextLength = normalizedText.length
      const chunks = this.materialTextChunker.chunk(normalizedText)

      if (normalizedText.length === 0 || chunks.length === 0) {
        await this.failMaterial(
          material,
          processingAttemptId,
          'NO_EXTRACTABLE_TEXT',
          extractedTextLength,
        )
        return
      }

      stage = 'embedding'
      const embeddedChunks =
        await this.materialChunkEmbeddingService.embedMaterialChunks(chunks)

      stage = 'finalization'
      const status = extraction.warnings.length > 0 ? 'WARNING' : 'READY'
      const completed =
        await this.materialsRepository.completeMaterialProcessing(
          material.id,
          processingAttemptId,
          embeddedChunks,
          {
            status,
            extractedTextLength: normalizedText.length,
            chunkCount: chunks.length,
            errorMessage: warningMessage(extraction.warnings),
            auditEvent: processingAuditEvent(material, status, {
              chunkCount: chunks.length,
              extractedTextLength: normalizedText.length,
              warningCodes: extraction.warnings,
            }),
          },
        )

      if (!completed) {
        throw new Error('Material processing finalization was not applied')
      }
    } catch (error) {
      const reason = classifyFailure(error, stage)
      await this.failMaterial(
        material,
        processingAttemptId,
        reason,
        extractedTextLength,
      )
    }
  }

  private async failMaterial(
    material: {
      id: string
      courseId: string
      uploadedById: string
    },
    processingAttemptId: string,
    reason: MaterialProcessingFailure,
    extractedTextLength: number | null,
  ): Promise<void> {
    try {
      await this.materialsRepository.failMaterialProcessing(
        material.id,
        processingAttemptId,
        {
          reasonCode: reason,
          extractedTextLength,
          errorMessage: MATERIAL_PROCESSING_SAFE_MESSAGES[reason],
          auditEvent: processingAuditEvent(material, 'FAILED', {
            reasonCode: reason,
            ...(extractedTextLength === null ? {} : { extractedTextLength }),
          }),
        },
      )
    } catch {
      this.logger.error(
        `Material processing failure finalization failed materialId=${material.id} reasonCode=${reason}`,
      )
    }
  }
}

function processingAuditEvent(
  material: { id: string; courseId: string; uploadedById: string },
  status: 'READY' | 'WARNING' | 'FAILED',
  metadata: Record<string, number | string | string[]>,
): RecordAuditEventInput {
  const action =
    status === 'READY'
      ? AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_READY
      : status === 'WARNING'
        ? AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_WARNING
        : AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_FAILED

  return {
    actorUserId: material.uploadedById,
    action,
    target: { type: AUDIT_TARGET_TYPES.MATERIAL, id: material.id },
    courseId: material.courseId,
    metadata: { materialId: material.id, status, ...metadata },
  }
}

function warningMessage(warnings: readonly PdfTextWarning[]): string | null {
  if (warnings.length === 0) {
    return null
  }

  return warnings
    .map((warning) => MATERIAL_PROCESSING_WARNING_MESSAGES[warning])
    .join(' ')
}

function classifyFailure(
  error: unknown,
  stage: 'storage' | 'extraction' | 'embedding' | 'finalization',
): MaterialProcessingFailure {
  if (error instanceof PdfStorageNotFoundError) {
    return 'BACKING_FILE_MISSING'
  }
  if (error instanceof PdfExtractionError || stage === 'extraction') {
    return 'PDF_EXTRACTION_FAILED'
  }
  if (stage === 'storage') {
    return 'STORAGE_READ_FAILED'
  }
  if (stage === 'embedding') {
    return 'EMBEDDING_FAILED'
  }
  return 'FINALIZATION_FAILED'
}
