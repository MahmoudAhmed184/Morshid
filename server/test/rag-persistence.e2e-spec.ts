import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import type { ConfigService } from '@nestjs/config'
import { Client } from 'pg'

import type { AppEnvironment } from '../src/modules/config/env.schema'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import {
  InvalidMaterialChunkEmbeddingError,
  MAX_INSERT_BATCH_ROWS,
  PrismaRagPersistenceRepository,
  type RagPersistenceRepository,
} from '../src/modules/rag-persistence/rag-persistence.repository'

describe('RAG persistence (e2e)', () => {
  let originalDatabaseUrl: string
  let disposableDatabaseName: string
  let prisma: PrismaService
  let repository: RagPersistenceRepository
  let materialId: string

  beforeAll(async () => {
    originalDatabaseUrl = requireDatabaseUrl()
    disposableDatabaseName = `morshid_issue76_${randomUUID().replaceAll('-', '')}`
    await runDatabaseAdminStatement(
      originalDatabaseUrl,
      `CREATE DATABASE "${disposableDatabaseName}"`,
    )
    const disposableDatabaseUrl = databaseUrlFor(
      originalDatabaseUrl,
      disposableDatabaseName,
    )
    await applyMigrations(disposableDatabaseUrl)

    const configService = {
      get: () => disposableDatabaseUrl,
    } as unknown as ConfigService<AppEnvironment, true>
    prisma = new PrismaService(configService)
    await prisma.$connect()
    repository = new PrismaRagPersistenceRepository(prisma)
  })

  beforeEach(async () => {
    materialId = await createMaterial(prisma)
  })

  afterAll(async () => {
    try {
      // `prisma` is undefined when beforeAll throws after CREATE DATABASE; the
      // guard keeps teardown from masking the real setup failure and orphaning
      // the disposable database.
      await disconnectQuietly(prisma)
    } finally {
      await runDatabaseAdminStatement(
        originalDatabaseUrl,
        `DROP DATABASE IF EXISTS "${disposableDatabaseName}" WITH (FORCE)`,
      )
    }
  })

  it('migrates an empty database and round-trips 1,536-value vectors', async () => {
    const embedding = Array.from(
      { length: 1_536 },
      (_, index) => [0.25, 0.5, 0.75][index % 3],
    )

    await repository.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Python functions package reusable behavior.',
        embedding,
        embeddingModel: 'test-embedding-1536',
      },
    ])

    await expect(repository.findMaterialChunks(materialId)).resolves.toEqual([
      expect.objectContaining({
        materialId,
        chunkIndex: 0,
        content: 'Python functions package reusable behavior.',
        embedding,
        embeddingModel: 'test-embedding-1536',
      }),
    ])
  })

  it.each([
    ['the wrong number of dimensions', Array.from({ length: 1_535 }, () => 0)],
    [
      'a non-finite component',
      [...Array.from({ length: 1_535 }, () => 0), NaN],
    ],
  ])('rejects embeddings with %s before persistence', async (_, embedding) => {
    await expect(
      repository.insertMaterialChunks(materialId, [
        {
          chunkIndex: 0,
          content: 'Invalid chunk',
          embedding,
          embeddingModel: 'test-embedding-1536',
        },
      ]),
    ).rejects.toBeInstanceOf(InvalidMaterialChunkEmbeddingError)
    await expect(repository.findMaterialChunks(materialId)).resolves.toEqual([])
  })

  it('rolls back the whole batch when one chunk violates a database constraint', async () => {
    const embedding = makeEmbedding(0.5)

    await expect(
      repository.insertMaterialChunks(materialId, [
        {
          chunkIndex: 0,
          content: 'First chunk',
          embedding,
          embeddingModel: 'test-embedding-1536',
        },
        {
          chunkIndex: 0,
          content: 'Duplicate chunk index',
          embedding,
          embeddingModel: 'test-embedding-1536',
        },
      ]),
    ).rejects.toThrow()
    await expect(repository.findMaterialChunks(materialId)).resolves.toEqual([])
  })

  it('parameterizes chunk values and returns them in zero-based order', async () => {
    const suspiciousContent = "Robert'); DROP TABLE materials; --"
    const suspiciousModel = "model'); SELECT pg_sleep(10); --"

    await repository.insertMaterialChunks(materialId, [
      {
        chunkIndex: 1,
        content: 'Second chunk',
        embedding: makeEmbedding(0.75),
        embeddingModel: 'test-embedding-1536',
      },
      {
        chunkIndex: 0,
        content: suspiciousContent,
        embedding: makeEmbedding(0.25),
        embeddingModel: suspiciousModel,
      },
    ])

    const chunks = await repository.findMaterialChunks(materialId)
    expect(chunks.map(({ chunkIndex }) => chunkIndex)).toEqual([0, 1])
    expect(chunks[0]).toEqual(
      expect.objectContaining({
        content: suspiciousContent,
        embeddingModel: suspiciousModel,
      }),
    )
    await expect(prisma.material.count()).resolves.toBeGreaterThan(0)
  })

  it('rejects wrong dimensions and negative chunk indexes at the database boundary', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO material_chunks (
          material_id,
          chunk_index,
          content,
          embedding,
          embedding_model
        ) VALUES (
          ${materialId}::uuid,
          0,
          'Wrong dimensions',
          ${'[0,1]'}::vector,
          'test-embedding-1536'
        )
      `,
    ).rejects.toThrow()

    await expect(
      prisma.$executeRaw`
        INSERT INTO material_chunks (
          material_id,
          chunk_index,
          content,
          embedding,
          embedding_model
        ) VALUES (
          ${materialId}::uuid,
          -1,
          'Negative index',
          ${serializeVector(makeEmbedding(0.5))}::vector,
          'test-embedding-1536'
        )
      `,
    ).rejects.toThrow()
  })

  it('supports cosine distance with the documented HNSW operator class', async () => {
    const firstBasisVector = makeBasisEmbedding(0)
    const secondBasisVector = makeBasisEmbedding(1)
    await repository.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Closest chunk',
        embedding: firstBasisVector,
        embeddingModel: 'test-embedding-1536',
      },
      {
        chunkIndex: 1,
        content: 'Orthogonal chunk',
        embedding: secondBasisVector,
        embeddingModel: 'test-embedding-1536',
      },
    ])
    const queryVector = serializeVector(firstBasisVector)

    const rankedChunks = await prisma.$queryRaw<
      { chunkIndex: number; distance: number }[]
    >`
      SELECT
        chunk_index AS "chunkIndex",
        embedding <=> ${queryVector}::vector AS distance
      FROM material_chunks
      WHERE material_id = ${materialId}::uuid
      ORDER BY embedding <=> ${queryVector}::vector, chunk_index
      LIMIT 2
    `
    const indexes = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = 'idx_chunks_embedding_hnsw'
    `

    expect(rankedChunks.map(({ chunkIndex }) => chunkIndex)).toEqual([0, 1])
    expect(rankedChunks[0].distance).toBeCloseTo(0)
    expect(rankedChunks[1].distance).toBeCloseTo(1)
    expect(indexes[0].indexdef).toContain('USING hnsw')
    expect(indexes[0].indexdef).toContain('vector_cosine_ops')
  })

  it('enforces retrieval and citation ordering constraints and ranges', async () => {
    await repository.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Constraint test chunk',
        embedding: makeEmbedding(0.5),
        embeddingModel: 'test-embedding-1536',
      },
    ])
    const [chunk] = await repository.findMaterialChunks(materialId)
    const messageId = await createMessage(prisma, materialId)

    await prisma.messageRetrieval.create({
      data: {
        messageId,
        chunkId: chunk.id,
        rank: 1,
        similarityScore: 0.75,
      },
    })
    // Raw cosine similarity is legitimately negative for dissimilar embeddings.
    await prisma.messageRetrieval.create({
      data: {
        messageId,
        chunkId: chunk.id,
        rank: 2,
        similarityScore: -0.05,
      },
    })
    await expect(
      prisma.messageRetrieval.create({
        data: { messageId, chunkId: chunk.id, rank: 1 },
      }),
    ).rejects.toThrow()
    await expect(
      prisma.messageRetrieval.create({
        data: { messageId, chunkId: chunk.id, rank: 0 },
      }),
    ).rejects.toThrow()
    await expect(
      prisma.messageRetrieval.create({
        data: {
          messageId,
          chunkId: chunk.id,
          rank: 3,
          similarityScore: 1.000_001,
        },
      }),
    ).rejects.toThrow()
    await expect(
      prisma.messageRetrieval.create({
        data: {
          messageId,
          chunkId: chunk.id,
          rank: 4,
          similarityScore: -1.000_001,
        },
      }),
    ).rejects.toThrow()

    await prisma.messageCitation.create({
      data: { messageId, materialId, citationOrder: 1 },
    })
    await expect(
      prisma.messageCitation.create({
        data: { messageId, materialId, citationOrder: 1 },
      }),
    ).rejects.toThrow()
    await expect(
      prisma.messageCitation.create({
        data: { messageId, materialId, citationOrder: 0 },
      }),
    ).rejects.toThrow()
  })

  it('applies the documented foreign-key delete behavior', async () => {
    await repository.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Foreign key test chunk',
        embedding: makeEmbedding(0.5),
        embeddingModel: 'test-embedding-1536',
      },
    ])
    const [chunk] = await repository.findMaterialChunks(materialId)
    const messageId = await createMessage(prisma, materialId)
    const retrieval = await prisma.messageRetrieval.create({
      data: { messageId, chunkId: chunk.id, rank: 1 },
    })
    await prisma.messageCitation.create({
      data: { messageId, materialId, citationOrder: 1 },
    })

    await prisma.materialChunk.delete({ where: { id: chunk.id } })
    await expect(
      prisma.messageRetrieval.findUniqueOrThrow({
        where: { id: retrieval.id },
        select: { chunkId: true },
      }),
    ).resolves.toEqual({ chunkId: null })
    await expect(
      prisma.material.delete({ where: { id: materialId } }),
    ).rejects.toThrow()

    await repository.insertMaterialChunks(materialId, [
      {
        chunkIndex: 1,
        content: 'Cascading chunk',
        embedding: makeEmbedding(0.25),
        embeddingModel: 'test-embedding-1536',
      },
    ])
    await prisma.message.delete({ where: { id: messageId } })
    await expect(
      prisma.messageRetrieval.count({ where: { messageId } }),
    ).resolves.toBe(0)
    await expect(
      prisma.messageCitation.count({ where: { messageId } }),
    ).resolves.toBe(0)

    await prisma.material.delete({ where: { id: materialId } })
    await expect(
      prisma.materialChunk.count({ where: { materialId } }),
    ).resolves.toBe(0)
  })

  it('persists batches that exceed the single-statement bind-parameter limit', async () => {
    const chunkCount = MAX_INSERT_BATCH_ROWS + 200
    const embedding = makeEmbedding(0.5)
    const chunks = Array.from({ length: chunkCount }, (_, chunkIndex) => ({
      chunkIndex,
      content: `Chunk ${String(chunkIndex)}`,
      embedding,
      embeddingModel: 'test-embedding-1536',
    }))

    await repository.insertMaterialChunks(materialId, chunks)

    const stored = await repository.findMaterialChunks(materialId)
    expect(stored).toHaveLength(chunkCount)
    expect(stored.map(({ chunkIndex }) => chunkIndex)).toEqual(
      Array.from({ length: chunkCount }, (_, chunkIndex) => chunkIndex),
    )
  })

  it('rolls back the whole insert across batch boundaries on a constraint violation', async () => {
    await repository.insertMaterialChunks(materialId, [
      {
        chunkIndex: MAX_INSERT_BATCH_ROWS + 5,
        content: 'Pre-existing chunk',
        embedding: makeEmbedding(0.5),
        embeddingModel: 'test-embedding-1536',
      },
    ])

    const chunks = Array.from(
      { length: MAX_INSERT_BATCH_ROWS + 10 },
      (_, chunkIndex) => ({
        chunkIndex,
        content: `Chunk ${String(chunkIndex)}`,
        embedding: makeEmbedding(0.25),
        embeddingModel: 'test-embedding-1536',
      }),
    )

    // The duplicate index lands in the second batch; the first batch must roll back.
    await expect(
      repository.insertMaterialChunks(materialId, chunks),
    ).rejects.toThrow()
    await expect(
      prisma.materialChunk.count({ where: { materialId } }),
    ).resolves.toBe(1)
  })

  it('replaces material chunks and preserves retrieval provenance', async () => {
    await repository.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Model A chunk 0',
        embedding: makeEmbedding(0.25),
        embeddingModel: 'text-embedding-a',
      },
      {
        chunkIndex: 1,
        content: 'Model A chunk 1',
        embedding: makeEmbedding(0.5),
        embeddingModel: 'text-embedding-a',
      },
      {
        chunkIndex: 2,
        content: 'Model A chunk 2',
        embedding: makeEmbedding(0.75),
        embeddingModel: 'text-embedding-a',
      },
    ])
    const [firstChunk] = await repository.findMaterialChunks(materialId)
    const messageId = await createMessage(prisma, materialId)
    const retrieval = await prisma.messageRetrieval.create({
      data: { messageId, chunkId: firstChunk.id, rank: 1 },
    })

    await repository.replaceMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Model B chunk 0',
        embedding: makeEmbedding(0.1),
        embeddingModel: 'text-embedding-b',
      },
      {
        chunkIndex: 1,
        content: 'Model B chunk 1',
        embedding: makeEmbedding(0.2),
        embeddingModel: 'text-embedding-b',
      },
    ])

    const replaced = await repository.findMaterialChunks(materialId)
    expect(replaced).toHaveLength(2)
    expect(replaced.map(({ content }) => content)).toEqual([
      'Model B chunk 0',
      'Model B chunk 1',
    ])
    expect(
      replaced.every(
        ({ embeddingModel }) => embeddingModel === 'text-embedding-b',
      ),
    ).toBe(true)
    await expect(
      prisma.messageRetrieval.findUniqueOrThrow({
        where: { id: retrieval.id },
        select: { chunkId: true },
      }),
    ).resolves.toEqual({ chunkId: null })
  })

  it('excludes chunks of soft-deleted materials from readback', async () => {
    await repository.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Soft-deleted material chunk',
        embedding: makeEmbedding(0.5),
        embeddingModel: 'test-embedding-1536',
      },
    ])
    await expect(
      repository.findMaterialChunks(materialId),
    ).resolves.toHaveLength(1)

    await prisma.material.update({
      where: { id: materialId },
      data: { deletedAt: new Date() },
    })

    await expect(repository.findMaterialChunks(materialId)).resolves.toEqual([])
  })

  it('round-trips float4-quantized embeddings with tolerance, not exact equality', async () => {
    // float4 holds ~7 significant decimal digits, so a 9-digit component cannot
    // be stored exactly and reads back quantized.
    const lossyComponent = 0.123456789
    const embedding = makeEmbedding(lossyComponent)

    await repository.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Lossy embedding chunk',
        embedding,
        embeddingModel: 'test-embedding-1536',
      },
    ])

    const [chunk] = await repository.findMaterialChunks(materialId)
    expect(chunk.embedding[0]).toBeCloseTo(lossyComponent, 5)
    expect(chunk.embedding[0]).not.toBe(lossyComponent)
  })
})

async function createMaterial(prisma: PrismaService): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `issue76-${randomUUID()}@morshid.test`,
      displayName: 'Issue 76 uploader',
      role: 'STUDENT',
      passwordHash: 'test-password-hash',
    },
  })
  const course = await prisma.course.create({
    data: {
      code: `I76-${randomUUID().slice(0, 24)}`,
      title: 'Issue 76 test course',
      createdById: user.id,
    },
  })
  const material = await prisma.material.create({
    data: {
      courseId: course.id,
      uploadedById: user.id,
      title: 'Functions',
      originalFilename: 'functions.pdf',
      storagePath: `${randomUUID()}.pdf`,
    },
  })
  await prisma.courseMembership.create({
    data: {
      courseId: course.id,
      userId: user.id,
      role: 'STUDENT',
      createdById: user.id,
    },
  })

  return material.id
}

async function createMessage(
  prisma: PrismaService,
  materialId: string,
): Promise<string> {
  const material = await prisma.material.findUniqueOrThrow({
    where: { id: materialId },
    select: { courseId: true, uploadedById: true },
  })
  const session = await prisma.chatSession.create({
    data: {
      courseId: material.courseId,
      studentId: material.uploadedById,
      title: 'Issue 76 test session',
    },
  })
  const message = await prisma.message.create({
    data: {
      sessionId: session.id,
      sequence: 1,
      role: 'ASSISTANT',
      content: 'Grounded answer',
      status: 'COMPLETED',
    },
  })

  return message.id
}

function makeEmbedding(value: number): number[] {
  return Array.from({ length: 1_536 }, () => value)
}

function makeBasisEmbedding(dimension: number): number[] {
  return Array.from({ length: 1_536 }, (_, index) =>
    index === dimension ? 1 : 0,
  )
}

function serializeVector(embedding: readonly number[]): string {
  return `[${embedding.join(',')}]`
}

async function disconnectQuietly(
  client: PrismaService | undefined,
): Promise<void> {
  if (client === undefined) {
    return
  }

  await client.$disconnect()
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required for persistence e2e tests')
  }

  return databaseUrl
}

function databaseUrlFor(databaseUrl: string, databaseName: string): string {
  const url = new URL(databaseUrl)
  url.pathname = `/${databaseName}`
  url.searchParams.delete('schema')
  return url.toString()
}

async function runDatabaseAdminStatement(
  databaseUrl: string,
  statement: string,
): Promise<void> {
  const client = new Client({
    connectionString: databaseUrlFor(databaseUrl, 'postgres'),
  })
  await client.connect()

  try {
    await client.query(statement)
  } finally {
    await client.end()
  }
}

async function applyMigrations(databaseUrl: string): Promise<void> {
  const migrationsDirectory = join(process.cwd(), 'prisma', 'migrations')
  const migrationDirectories = (
    await readdir(migrationsDirectory, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    for (const migrationDirectory of migrationDirectories) {
      const sql = await readFile(
        join(migrationsDirectory, migrationDirectory, 'migration.sql'),
        'utf8',
      )
      await client.query(sql)
    }
  } finally {
    await client.end()
  }
}
