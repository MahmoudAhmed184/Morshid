import { randomUUID } from 'node:crypto'

import { MaterialStatus, Prisma } from '../src/generated/prisma/client'
import {
  MaterialNoLongerProcessableError,
} from '../src/modules/materials/material-processing.errors'
import { PrismaMaterialProcessingRepository } from '../src/modules/materials/material-processing.repository'
import type { PrismaService } from '../src/modules/prisma/prisma.service'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

describe('Material processing persistence (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let repository: PrismaMaterialProcessingRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue78')
    prisma = database.prisma
    repository = new PrismaMaterialProcessingRepository(prisma)
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('marks processing material ready and persists ordered chunks atomically', async () => {
    const materialId = await createMaterial(prisma, MaterialStatus.PROCESSING)

    await repository.completeProcessing({
      materialId,
      status: MaterialStatus.READY,
      extractedTextLength: 42,
      chunks: [
        {
          chunkIndex: 0,
          content: 'Variables store values.',
          embedding: makeEmbedding(0.25),
          embeddingModel: 'test-embedding-1536',
        },
        {
          chunkIndex: 1,
          content: 'Loops repeat work.',
          embedding: makeEmbedding(0.5),
          embeddingModel: 'test-embedding-1536',
        },
      ],
    })

    await expect(readMaterialStatus(prisma, materialId)).resolves.toEqual({
      status: MaterialStatus.READY,
      extractedTextLength: 42,
      chunkCount: 2,
      errorMessage: null,
    })
    await expect(readChunks(prisma, materialId)).resolves.toEqual([
      {
        chunkIndex: 0,
        content: 'Variables store values.',
        embeddingModel: 'test-embedding-1536',
      },
      {
        chunkIndex: 1,
        content: 'Loops repeat work.',
        embeddingModel: 'test-embedding-1536',
      },
    ])
  })

  it('marks failed material and clears pre-existing partial chunks', async () => {
    const materialId = await createMaterial(prisma, MaterialStatus.PROCESSING)
    await insertChunk(prisma, materialId, {
      chunkIndex: 0,
      content: 'partial chunk must be cleared',
      embedding: makeEmbedding(0.75),
      embeddingModel: 'test-embedding-1536',
    })

    await repository.failProcessing({
      materialId,
      extractedTextLength: 0,
      errorMessage:
        'No extractable text was found. Scanned PDFs are not supported.',
    })

    await expect(readMaterialStatus(prisma, materialId)).resolves.toEqual({
      status: MaterialStatus.FAILED,
      extractedTextLength: 0,
      chunkCount: 0,
      errorMessage:
        'No extractable text was found. Scanned PDFs are not supported.',
    })
    await expect(readChunks(prisma, materialId)).resolves.toEqual([])
  })

  it('does not overwrite or clear previously ready materials', async () => {
    const materialId = await createMaterial(prisma, MaterialStatus.READY)
    await insertChunk(prisma, materialId, {
      chunkIndex: 0,
      content: 'existing ready chunk',
      embedding: makeEmbedding(0.25),
      embeddingModel: 'test-embedding-1536',
    })

    await expect(
      repository.completeProcessing({
        materialId,
        status: MaterialStatus.READY,
        extractedTextLength: 12,
        chunks: [
          {
            chunkIndex: 0,
            content: 'replacement should not persist',
            embedding: makeEmbedding(0.5),
            embeddingModel: 'test-embedding-1536',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(MaterialNoLongerProcessableError)

    await expect(readMaterialStatus(prisma, materialId)).resolves.toEqual({
      status: MaterialStatus.READY,
      extractedTextLength: null,
      chunkCount: null,
      errorMessage: null,
    })
    await expect(readChunks(prisma, materialId)).resolves.toEqual([
      {
        chunkIndex: 0,
        content: 'existing ready chunk',
        embeddingModel: 'test-embedding-1536',
      },
    ])
  })
})

async function createMaterial(
  prisma: PrismaService,
  status: MaterialStatus,
): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `issue78-${randomUUID()}@morshid.test`,
      displayName: 'Issue 78 uploader',
      role: 'INSTRUCTOR',
      passwordHash: 'test-password-hash',
    },
  })
  const course = await prisma.course.create({
    data: {
      code: `I78-${randomUUID().slice(0, 24)}`,
      title: 'Issue 78 test course',
      createdById: user.id,
    },
  })
  const material = await prisma.material.create({
    data: {
      courseId: course.id,
      uploadedById: user.id,
      title: 'Processing material',
      originalFilename: 'processing.pdf',
      storagePath: `${randomUUID()}.pdf`,
      status,
    },
  })

  return material.id
}

async function readMaterialStatus(prisma: PrismaService, materialId: string) {
  return prisma.material.findUniqueOrThrow({
    where: { id: materialId },
    select: {
      status: true,
      extractedTextLength: true,
      chunkCount: true,
      errorMessage: true,
    },
  })
}

async function readChunks(prisma: PrismaService, materialId: string) {
  return prisma.$queryRaw<
    { chunkIndex: number; content: string; embeddingModel: string }[]
  >(Prisma.sql`
    SELECT
      chunk_index AS "chunkIndex",
      content,
      embedding_model AS "embeddingModel"
    FROM material_chunks
    WHERE material_id = ${materialId}::uuid
    ORDER BY chunk_index ASC
  `)
}

async function insertChunk(
  prisma: PrismaService,
  materialId: string,
  chunk: {
    chunkIndex: number
    content: string
    embedding: readonly number[]
    embeddingModel: string
  },
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO material_chunks (
      material_id,
      chunk_index,
      content,
      embedding,
      embedding_model
    ) VALUES (
      ${materialId}::uuid,
      ${chunk.chunkIndex},
      ${chunk.content},
      ${serializeEmbedding(chunk.embedding)}::vector(1536),
      ${chunk.embeddingModel}
    )
  `)
}

function makeEmbedding(value: number): number[] {
  return Array.from({ length: 1_536 }, () => value)
}

function serializeEmbedding(embedding: readonly number[]): string {
  return `[${embedding.join(',')}]`
}
