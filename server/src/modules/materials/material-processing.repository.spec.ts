import { MaterialStatus } from '../../generated/prisma/client'
import type { PrismaService } from '../prisma/prisma.service'
import { MaterialNoLongerProcessableError } from './material-processing.errors'
import { PrismaMaterialProcessingRepository } from './material-processing.repository'

const materialId = '00000000-0000-4000-8000-000000000701'
const courseId = '00000000-0000-4000-8000-000000000101'
const uploadedById = '00000000-0000-4000-8000-000000000002'
const embedding = new Array<number>(1_536).fill(0.01)

function buildRepository() {
  const tx = {
    material: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  }
  const prismaService = {
    material: {
      findFirst: jest.fn().mockResolvedValue({
        id: materialId,
        courseId,
        uploadedById,
        storagePath: '00000000-0000-4000-8000-000000000701.pdf',
      }),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService

  return {
    tx,
    prismaService,
    repository: new PrismaMaterialProcessingRepository(prismaService),
  }
}

describe('PrismaMaterialProcessingRepository', () => {
  it('loads only non-deleted processing materials', async () => {
    const { prismaService, repository } = buildRepository()

    await expect(repository.findProcessableMaterial(materialId)).resolves.toEqual(
      {
        id: materialId,
        courseId,
        uploadedById,
        storagePath: '00000000-0000-4000-8000-000000000701.pdf',
      },
    )
    expect(prismaService.material.findFirst).toHaveBeenCalledWith({
      where: {
        id: materialId,
        status: MaterialStatus.PROCESSING,
        deletedAt: null,
      },
      select: {
        id: true,
        courseId: true,
        uploadedById: true,
        storagePath: true,
      },
    })
  })

  it('transactionally marks ready and replaces chunks', async () => {
    const { tx, repository } = buildRepository()

    await repository.completeProcessing({
      materialId,
      status: MaterialStatus.READY,
      extractedTextLength: 1_500,
      chunks: [
        {
          chunkIndex: 0,
          content: 'variables store values',
          embedding,
          embeddingModel: 'deterministic-embedding-v1',
        },
        {
          chunkIndex: 1,
          content: 'loops repeat work',
          embedding,
          embeddingModel: 'deterministic-embedding-v1',
        },
      ],
    })

    expect(tx.material.updateMany).toHaveBeenCalledWith({
      where: {
        id: materialId,
        status: MaterialStatus.PROCESSING,
        deletedAt: null,
      },
      data: {
        status: MaterialStatus.READY,
        extractedTextLength: 1_500,
        chunkCount: 2,
        errorMessage: null,
      },
    })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2)
  })

  it('stores a safe warning message when material finishes with warning', async () => {
    const { tx, repository } = buildRepository()

    await repository.completeProcessing({
      materialId,
      status: MaterialStatus.WARNING,
      extractedTextLength: 20,
      warningMessage: 'Processed with non-fatal PDF extraction warnings.',
      chunks: [
        {
          chunkIndex: 0,
          content: 'usable text',
          embedding,
          embeddingModel: 'deterministic-embedding-v1',
        },
      ],
    })

    expect(tx.material.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: MaterialStatus.WARNING,
          errorMessage: 'Processed with non-fatal PDF extraction warnings.',
        }),
      }),
    )
  })

  it('transactionally marks failed and clears chunks', async () => {
    const { tx, repository } = buildRepository()

    await repository.failProcessing({
      materialId,
      extractedTextLength: 0,
      errorMessage:
        'No extractable text was found. Scanned PDFs are not supported.',
    })

    expect(tx.material.updateMany).toHaveBeenCalledWith({
      where: {
        id: materialId,
        status: MaterialStatus.PROCESSING,
        deletedAt: null,
      },
      data: {
        status: MaterialStatus.FAILED,
        extractedTextLength: 0,
        chunkCount: 0,
        errorMessage:
          'No extractable text was found. Scanned PDFs are not supported.',
      },
    })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('rejects stale complete transitions without clearing chunks', async () => {
    const { tx, repository } = buildRepository()
    tx.material.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      repository.completeProcessing({
        materialId,
        status: MaterialStatus.READY,
        extractedTextLength: 11,
        chunks: [
          {
            chunkIndex: 0,
            content: 'ready text',
            embedding,
            embeddingModel: 'deterministic-embedding-v1',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(MaterialNoLongerProcessableError)
    expect(tx.$executeRaw).not.toHaveBeenCalled()
  })

  it('rejects malformed embeddings before opening a transaction', async () => {
    const { prismaService, repository } = buildRepository()

    await expect(
      repository.completeProcessing({
        materialId,
        status: MaterialStatus.READY,
        extractedTextLength: 11,
        chunks: [
          {
            chunkIndex: 0,
            content: 'ready text',
            embedding: [0.1],
            embeddingModel: 'deterministic-embedding-v1',
          },
        ],
      }),
    ).rejects.toThrow('embedding must contain exactly')
    expect(prismaService.$transaction).not.toHaveBeenCalled()
  })
})
