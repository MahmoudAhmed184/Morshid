import type { AuditService } from '../audit/audit.service'
import type { PdfStorage } from '../pdf-storage/pdf-storage'
import type { MaterialChunkEmbeddingService } from '../rag-persistence/material-chunk-embedding.service'
import type {
  MaterialsRepository,
  MaterialProcessingRecord,
} from './materials.repository'
import {
  MATERIAL_PROCESSING_FAILURES,
  MaterialProcessingService,
} from './material-processing.service'
import { MaterialTextChunker } from './material-text-chunker'

const material: MaterialProcessingRecord = {
  id: 'material-80',
  courseId: 'course-80',
  uploadedById: 'instructor-80',
  storagePath: '00000000-0000-4000-8000-000000000080.pdf',
}

describe('MaterialProcessingService', () => {
  let repository: {
    findMaterialForProcessing: jest.Mock
    completeMaterialProcessing: jest.Mock
    failMaterialProcessing: jest.Mock
  }
  let storage: { read: jest.Mock }
  let extractor: { extract: jest.Mock }
  let embedding: { embedAndReplaceMaterialChunks: jest.Mock }
  let audit: { recordEvent: jest.Mock }
  let service: MaterialProcessingService

  beforeEach(() => {
    repository = {
      findMaterialForProcessing: jest.fn().mockResolvedValue(material),
      completeMaterialProcessing: jest.fn().mockResolvedValue(true),
      failMaterialProcessing: jest.fn().mockResolvedValue(true),
    }
    storage = { read: jest.fn().mockResolvedValue(Buffer.from('pdf')) }
    extractor = {
      extract: jest.fn().mockResolvedValue({
        text: 'Variables bind names to values.',
        warnings: [],
      }),
    }
    embedding = {
      embedAndReplaceMaterialChunks: jest.fn().mockResolvedValue(undefined),
    }
    audit = { recordEvent: jest.fn().mockResolvedValue(undefined) }
    service = new MaterialProcessingService(
      repository as unknown as MaterialsRepository,
      storage as unknown as PdfStorage,
      extractor,
      new MaterialTextChunker(),
      embedding as unknown as MaterialChunkEmbeddingService,
      audit as unknown as AuditService,
    )
  })

  it('finalizes a clean source only after embedding completes', async () => {
    await service.processMaterial(material.id)

    expect(embedding.embedAndReplaceMaterialChunks).toHaveBeenCalledWith(
      material.id,
      [{ chunkIndex: 0, content: 'Variables bind names to values.' }],
    )
    expect(repository.completeMaterialProcessing).toHaveBeenCalledWith(
      material.id,
      expect.objectContaining({
        status: 'READY',
        extractedTextLength: 31,
        chunkCount: 1,
      }),
    )
    expect(repository.failMaterialProcessing).not.toHaveBeenCalled()
    const [event] = audit.recordEvent.mock.calls[0] as [
      { action: string; metadata: { status: string } },
    ]
    expect(event).toMatchObject({
      action: 'material.processing_ready',
      metadata: { status: 'READY' },
    })
  })

  it.each([
    {
      name: 'empty text',
      extraction: { text: ' \n\t ', warnings: [] },
      reason: MATERIAL_PROCESSING_FAILURES.NO_EXTRACTABLE_TEXT,
    },
    {
      name: 'image-only text layer',
      extraction: { text: '', warnings: [] },
      reason: MATERIAL_PROCESSING_FAILURES.NO_EXTRACTABLE_TEXT,
    },
  ])('fails safely for $name', async ({ extraction, reason }) => {
    extractor.extract.mockResolvedValue(extraction)

    await service.processMaterial(material.id)

    expect(repository.completeMaterialProcessing).not.toHaveBeenCalled()
    expect(repository.failMaterialProcessing).toHaveBeenCalledWith(
      material.id,
      reason,
    )
    expect(embedding.embedAndReplaceMaterialChunks).toHaveBeenCalledWith(
      material.id,
      [],
    )
  })

  it('turns a partially extracted warning into an eligible-completion state', async () => {
    extractor.extract.mockResolvedValue({
      text: 'Usable text',
      warnings: ['PARTIAL_PAGE_TEXT'],
    })

    await service.processMaterial(material.id)

    expect(repository.completeMaterialProcessing).toHaveBeenCalledWith(
      material.id,
      expect.objectContaining({ status: 'WARNING', chunkCount: 1 }),
    )
  })

  it.each([
    {
      name: 'parser failure after partial extraction',
      configure: () =>
        extractor.extract.mockRejectedValue(
          new Error('parser saw SYNTHETIC_SENTINEL_TASK80_7f2b'),
        ),
      reason: MATERIAL_PROCESSING_FAILURES.PDF_EXTRACTION_FAILED,
    },
    {
      name: 'embedding failure after one chunk',
      configure: () =>
        embedding.embedAndReplaceMaterialChunks.mockRejectedValue(
          new Error('provider saw SYNTHETIC_SENTINEL_TASK80_7f2b'),
        ),
      reason: MATERIAL_PROCESSING_FAILURES.EMBEDDING_FAILED,
    },
    {
      name: 'backing file failure',
      configure: () =>
        storage.read.mockRejectedValue(new Error('storage path failure')),
      reason: MATERIAL_PROCESSING_FAILURES.STORAGE_READ_FAILED,
    },
  ])('leaves no eligible source after $name', async ({ configure, reason }) => {
    configure()

    await service.processMaterial(material.id)

    expect(repository.completeMaterialProcessing).not.toHaveBeenCalled()
    expect(repository.failMaterialProcessing).toHaveBeenCalledWith(
      material.id,
      reason,
    )
    expect(embedding.embedAndReplaceMaterialChunks).toHaveBeenLastCalledWith(
      material.id,
      [],
    )
    const serializedAudit = JSON.stringify(audit.recordEvent.mock.calls)
    expect(serializedAudit).not.toContain('SYNTHETIC_SENTINEL_TASK80_7f2b')
  })

  it('rolls back chunks and fails safely when final state persistence is unavailable', async () => {
    repository.completeMaterialProcessing.mockResolvedValue(false)

    await service.processMaterial(material.id)

    expect(embedding.embedAndReplaceMaterialChunks).toHaveBeenLastCalledWith(
      material.id,
      [],
    )
    expect(repository.failMaterialProcessing).toHaveBeenCalledWith(
      material.id,
      MATERIAL_PROCESSING_FAILURES.FINALIZATION_FAILED,
    )
  })
})
