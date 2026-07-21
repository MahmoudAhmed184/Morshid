import { MaterialStatus } from '../../generated/prisma/client'
import type { EmbeddingProvider } from '../embedding/embedding-provider'
import type { PdfStorage } from '../pdf-storage/pdf-storage'
import {
  MATERIAL_PROCESSING_ERROR_CODES,
  MaterialNoLongerProcessableError,
} from './material-processing.errors'
import type { MaterialProcessingAuditService } from './material-processing.audit.service'
import type { MaterialProcessingRepository } from './material-processing.repository'
import { MaterialProcessingService } from './material-processing.service'
import type { PdfTextExtractor } from './pdf-text.extractor'

const materialId = '00000000-0000-4000-8000-000000000701'
const courseId = '00000000-0000-4000-8000-000000000101'
const uploadedById = '00000000-0000-4000-8000-000000000002'
const storagePath = '00000000-0000-4000-8000-000000000701.pdf'
const pdfBytes = Buffer.from('%PDF-1.7\nclean text pdf')
const embedding = new Array<number>(1_536).fill(0.01)

function buildService() {
  const repository = {
    findProcessableMaterial: jest.fn().mockResolvedValue({
      id: materialId,
      courseId,
      uploadedById,
      storagePath,
    }),
    completeProcessing: jest.fn().mockResolvedValue(undefined),
    failProcessing: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<MaterialProcessingRepository>
  const extractor = {
    extract: jest.fn().mockResolvedValue({
      text: '  Variables\tstore values.\r\n\r\nLoops repeat work.  ',
      warnings: [],
    }),
  } as unknown as jest.Mocked<PdfTextExtractor>
  const storage = {
    read: jest.fn().mockResolvedValue(pdfBytes),
  } as unknown as jest.Mocked<PdfStorage>
  const embeddingProvider = {
    model: 'deterministic-embedding-v1',
    embedBatch: jest.fn().mockResolvedValue([embedding]),
  } as unknown as jest.Mocked<EmbeddingProvider>
  const auditService = {
    recordReady: jest.fn().mockResolvedValue(undefined),
    recordWarning: jest.fn().mockResolvedValue(undefined),
    recordFailed: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<MaterialProcessingAuditService>

  return {
    repository,
    extractor,
    storage,
    embeddingProvider,
    auditService,
    service: new MaterialProcessingService(
      repository,
      extractor,
      auditService,
      storage,
      embeddingProvider,
    ),
  }
}

describe('MaterialProcessingService', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('processes a clean PDF into ready chunks and embeddings', async () => {
    const { service, storage, extractor, embeddingProvider, repository, auditService } =
      buildService()

    await expect(service.processMaterial(materialId)).resolves.toBe(
      MaterialStatus.READY,
    )

    expect(storage.read).toHaveBeenCalledWith(storagePath)
    expect(extractor.extract).toHaveBeenCalledWith(pdfBytes)
    expect(embeddingProvider.embedBatch).toHaveBeenCalledWith([
      'Variables store values.\n\nLoops repeat work.',
    ])
    expect(repository.completeProcessing).toHaveBeenCalledWith({
      materialId,
      status: MaterialStatus.READY,
      extractedTextLength: 43,
      warningMessage: null,
      chunks: [
        {
          chunkIndex: 0,
          content: 'Variables store values.\n\nLoops repeat work.',
          embedding,
          embeddingModel: 'deterministic-embedding-v1',
        },
      ],
    })
    expect(repository.failProcessing).not.toHaveBeenCalled()
    expect(auditService.recordReady).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: uploadedById,
        materialId,
        courseId,
        extractedTextLength: 43,
        chunkCount: 1,
        embeddingModel: 'deterministic-embedding-v1',
      }),
    )
  })

  it('marks usable extraction warnings as warning and still persists chunks', async () => {
    const { service, extractor, repository, auditService } = buildService()
    extractor.extract.mockResolvedValueOnce({
      text: 'Usable text',
      warnings: [
        {
          code: 'PDF_EXTRACTION_WARNING',
          message: 'Processed with non-fatal PDF extraction warnings.',
        },
      ],
    })

    await expect(service.processMaterial(materialId)).resolves.toBe(
      MaterialStatus.WARNING,
    )

    expect(repository.completeProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MaterialStatus.WARNING,
        warningMessage: 'Processed with non-fatal PDF extraction warnings.',
      }),
    )
    expect(auditService.recordWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        warningCode: 'PDF_EXTRACTION_WARNING',
        chunkCount: 1,
      }),
    )
  })

  it('fails empty normalized extraction without embedding chunks', async () => {
    const { service, extractor, embeddingProvider, repository, auditService } =
      buildService()
    extractor.extract.mockResolvedValueOnce({
      text: '   \n\t  ',
      warnings: [],
    })

    await expect(service.processMaterial(materialId)).resolves.toBe(
      MaterialStatus.FAILED,
    )

    expect(embeddingProvider.embedBatch).not.toHaveBeenCalled()
    expect(repository.completeProcessing).not.toHaveBeenCalled()
    expect(repository.failProcessing).toHaveBeenCalledWith({
      materialId,
      extractedTextLength: 0,
      errorMessage:
        'No extractable text was found. Scanned PDFs are not supported.',
    })
    expect(auditService.recordFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: MATERIAL_PROCESSING_ERROR_CODES.NO_EXTRACTABLE_TEXT,
        chunkCount: 0,
      }),
    )
  })

  it('marks embedding provider errors as failed without persisting chunks', async () => {
    const { service, embeddingProvider, repository, auditService } =
      buildService()
    embeddingProvider.embedBatch.mockRejectedValueOnce(
      new Error('provider payload should stay private'),
    )

    await expect(service.processMaterial(materialId)).resolves.toBe(
      MaterialStatus.FAILED,
    )

    expect(repository.completeProcessing).not.toHaveBeenCalled()
    expect(repository.failProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: 'The material could not be embedded.',
      }),
    )
    expect(auditService.recordFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: MATERIAL_PROCESSING_ERROR_CODES.EMBEDDING_FAILED,
      }),
    )
  })

  it('rejects malformed embedding dimensions as embedding failure', async () => {
    const { service, embeddingProvider, repository } = buildService()
    embeddingProvider.embedBatch.mockResolvedValueOnce([[0.1]])

    await expect(service.processMaterial(materialId)).resolves.toBe(
      MaterialStatus.FAILED,
    )

    expect(repository.failProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: 'The material could not be embedded.',
      }),
    )
  })

  it('skips non-processable materials without mutating chunks or status', async () => {
    const { service, repository, storage } = buildService()
    repository.findProcessableMaterial.mockResolvedValueOnce(null)

    await expect(service.processMaterial(materialId)).resolves.toBe('SKIPPED')
    expect(storage.read).not.toHaveBeenCalled()
    expect(repository.completeProcessing).not.toHaveBeenCalled()
    expect(repository.failProcessing).not.toHaveBeenCalled()
  })

  it('treats stale duplicate completion calls as no-op', async () => {
    const { service, repository, auditService } = buildService()
    repository.completeProcessing.mockRejectedValueOnce(
      new MaterialNoLongerProcessableError(materialId),
    )

    await expect(service.processMaterial(materialId)).resolves.toBe('SKIPPED')
    expect(repository.failProcessing).not.toHaveBeenCalled()
    expect(auditService.recordReady).not.toHaveBeenCalled()
  })

  it('clears chunks and fails safely when ready persistence fails', async () => {
    const { service, repository, auditService } = buildService()
    repository.completeProcessing.mockRejectedValueOnce(new Error('sql details'))

    await expect(service.processMaterial(materialId)).resolves.toBe(
      MaterialStatus.FAILED,
    )

    expect(repository.failProcessing).toHaveBeenCalledWith({
      materialId,
      extractedTextLength: 43,
      errorMessage:
        'The extracted content could not be prepared for retrieval.',
    })
    expect(auditService.recordFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: MATERIAL_PROCESSING_ERROR_CODES.PERSISTENCE_FAILED,
      }),
    )
  })
})
