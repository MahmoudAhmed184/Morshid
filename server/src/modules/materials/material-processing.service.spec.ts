import type { PdfStorage } from '../pdf-storage/pdf-storage'
import type { MaterialChunkEmbeddingService } from '../rag-persistence/material-chunk-embedding.service'
import type {
  CompleteMaterialProcessingInput,
  FailMaterialProcessingInput,
  MaterialsRepository,
  MaterialProcessingRecord,
} from './materials.repository'
import {
  MATERIAL_PROCESSING_FAILURES,
  MATERIAL_PROCESSING_SAFE_MESSAGES,
  MATERIAL_PROCESSING_WARNING_MESSAGES,
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
    claimMaterialProcessing: jest.Mock
    completeMaterialProcessing: jest.Mock
    failMaterialProcessing: jest.Mock
  }
  let storage: { read: jest.Mock }
  let extractor: { extract: jest.Mock }
  let embedding: { embedMaterialChunks: jest.Mock }
  let service: MaterialProcessingService

  beforeEach(() => {
    repository = {
      claimMaterialProcessing: jest.fn().mockResolvedValue(material),
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
      embedMaterialChunks: jest.fn().mockResolvedValue([
        {
          chunkIndex: 0,
          content: 'Variables bind names to values.',
          embedding: [0.1],
          embeddingModel: 'test-model',
        },
      ]),
    }
    service = new MaterialProcessingService(
      repository as unknown as MaterialsRepository,
      storage as unknown as PdfStorage,
      extractor,
      new MaterialTextChunker(),
      embedding as unknown as MaterialChunkEmbeddingService,
    )
  })

  it('finalizes a clean source only after embedding completes', async () => {
    await service.processMaterial(material.id)

    expect(embedding.embedMaterialChunks).toHaveBeenCalledWith([
      { chunkIndex: 0, content: 'Variables bind names to values.' },
    ])
    expect(repository.completeMaterialProcessing).toHaveBeenCalledWith(
      material.id,
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        status: 'READY',
        extractedTextLength: 31,
        chunkCount: 1,
        errorMessage: null,
      }),
    )
    const completeCalls = repository.completeMaterialProcessing.mock
      .calls as unknown as [
      string,
      string,
      unknown[],
      CompleteMaterialProcessingInput,
    ][]
    const completeInput = completeCalls[0][3]
    expect(completeInput.auditEvent.action).toBe('material.processing_ready')
    expect(completeInput.auditEvent.metadata).toMatchObject({ status: 'READY' })
    expect(repository.failMaterialProcessing).not.toHaveBeenCalled()
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

    expect(repository.failMaterialProcessing).toHaveBeenCalledWith(
      material.id,
      expect.any(String),
      expect.objectContaining({
        reasonCode: reason,
        errorMessage: MATERIAL_PROCESSING_SAFE_MESSAGES[reason],
        extractedTextLength: 0,
      }),
    )
    const failureCalls = repository.failMaterialProcessing.mock
      .calls as unknown as [string, string, FailMaterialProcessingInput][]
    const failureInput = failureCalls[0][2]
    expect(failureInput.auditEvent.action).toBe('material.processing_failed')
    expect(failureInput.auditEvent.metadata).toMatchObject({
      reasonCode: reason,
    })
    expect(embedding.embedMaterialChunks).not.toHaveBeenCalled()
  })

  it('turns a partially extracted warning into an eligible-completion state', async () => {
    extractor.extract.mockResolvedValue({
      text: 'Usable text',
      warnings: ['PARTIAL_PAGE_TEXT'],
    })

    await service.processMaterial(material.id)

    expect(repository.completeMaterialProcessing).toHaveBeenCalledWith(
      material.id,
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        status: 'WARNING',
        chunkCount: 1,
        errorMessage: MATERIAL_PROCESSING_WARNING_MESSAGES.PARTIAL_PAGE_TEXT,
      }),
    )
    const completeCalls = repository.completeMaterialProcessing.mock
      .calls as unknown as [
      string,
      string,
      unknown[],
      CompleteMaterialProcessingInput,
    ][]
    const completeInput = completeCalls[0][3]
    expect(completeInput.auditEvent.action).toBe('material.processing_warning')
    expect(completeInput.auditEvent.metadata).toMatchObject({
      status: 'WARNING',
      warningCodes: ['PARTIAL_PAGE_TEXT'],
    })
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
        embedding.embedMaterialChunks.mockRejectedValue(
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

    expect(repository.failMaterialProcessing).toHaveBeenCalledWith(
      material.id,
      expect.any(String),
      expect.objectContaining({
        reasonCode: reason,
        errorMessage: MATERIAL_PROCESSING_SAFE_MESSAGES[reason],
        extractedTextLength:
          reason === MATERIAL_PROCESSING_FAILURES.EMBEDDING_FAILED ? 31 : null,
      }),
    )
    const serializedFinalization = JSON.stringify(
      repository.failMaterialProcessing.mock.calls,
    )
    expect(serializedFinalization).not.toContain(
      'SYNTHETIC_SENTINEL_TASK80_7f2b',
    )
  })

  it('rolls back chunks and fails safely when final state persistence is unavailable', async () => {
    repository.completeMaterialProcessing.mockResolvedValue(false)

    await service.processMaterial(material.id)

    expect(repository.failMaterialProcessing).toHaveBeenCalledWith(
      material.id,
      expect.any(String),
      expect.objectContaining({
        reasonCode: MATERIAL_PROCESSING_FAILURES.FINALIZATION_FAILED,
        extractedTextLength: 31,
      }),
    )
  })

  it('lets only the atomic claim winner process and audit a material', async () => {
    repository.claimMaterialProcessing
      .mockResolvedValueOnce(material)
      .mockResolvedValueOnce(null)

    await Promise.all([
      service.processMaterial(material.id),
      service.processMaterial(material.id),
    ])

    expect(repository.claimMaterialProcessing).toHaveBeenCalledTimes(2)
    expect(embedding.embedMaterialChunks).toHaveBeenCalledTimes(1)
    expect(repository.failMaterialProcessing).not.toHaveBeenCalled()
    expect(repository.completeMaterialProcessing).toHaveBeenCalledTimes(1)
  })

  it('contains claim lookup failures before any background work escapes', async () => {
    repository.claimMaterialProcessing.mockRejectedValue(
      new Error('database unavailable'),
    )

    await expect(service.processMaterial(material.id)).resolves.toBeUndefined()

    expect(storage.read).not.toHaveBeenCalled()
    expect(embedding.embedMaterialChunks).not.toHaveBeenCalled()
    expect(repository.completeMaterialProcessing).not.toHaveBeenCalled()
  })

  it('does not emit a terminal audit when an expired stale attempt loses ownership', async () => {
    let releaseStaleEmbedding: ((value: unknown[]) => void) | undefined
    const staleEmbedding = new Promise<unknown[]>((resolve) => {
      releaseStaleEmbedding = resolve
    })
    repository.claimMaterialProcessing.mockResolvedValue(material)
    embedding.embedMaterialChunks
      .mockReturnValueOnce(staleEmbedding)
      .mockResolvedValueOnce([
        {
          chunkIndex: 0,
          content: 'Variables bind names to values.',
          embedding: [0.1],
          embeddingModel: 'test-model',
        },
      ])
    repository.completeMaterialProcessing
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    repository.failMaterialProcessing.mockResolvedValue(false)

    const staleProcessing = service.processMaterial(material.id)
    await waitForCalls(embedding.embedMaterialChunks, 1)
    await service.processMaterial(material.id)
    releaseStaleEmbedding?.([
      {
        chunkIndex: 0,
        content: 'Variables bind names to values.',
        embedding: [0.1],
        embeddingModel: 'test-model',
      },
    ])
    await staleProcessing

    const attempts = repository.claimMaterialProcessing.mock.calls.map(
      (call) => (call as [string, string])[1],
    )
    expect(new Set(attempts).size).toBe(2)
    expect(repository.completeMaterialProcessing).toHaveBeenCalledTimes(2)
  })
})

async function waitForCalls(mock: jest.Mock, count: number): Promise<void> {
  while (mock.mock.calls.length < count) {
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
}
