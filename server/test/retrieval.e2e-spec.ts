import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import type { ConfigService } from '@nestjs/config'
import { Client } from 'pg'

import type { AppEnvironment } from '../src/modules/config/env.schema'
import { DeterministicEmbeddingProvider } from '../src/modules/embedding/deterministic-embedding.provider'
import type { EmbeddingProvider } from '../src/modules/embedding/embedding-provider'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { MaterialChunkEmbeddingService } from '../src/modules/rag-persistence/material-chunk-embedding.service'
import {
  PrismaRagPersistenceRepository,
  type RagPersistenceRepository,
} from '../src/modules/rag-persistence/rag-persistence.repository'
import { PrismaCourseRetrievalRepository } from '../src/modules/retrieval/course-retrieval.repository'
import { RetrievalService } from '../src/modules/retrieval/retrieval.service'

const TOP_K = 5
const MIN_SIMILARITY = 0.7

describe('Course-filtered top-k retrieval (e2e)', () => {
  let originalDatabaseUrl: string
  let disposableDatabaseName: string
  let prisma: PrismaService
  let persistence: RagPersistenceRepository
  let retrievalRepository: PrismaCourseRetrievalRepository

  beforeAll(async () => {
    originalDatabaseUrl = requireDatabaseUrl()
    disposableDatabaseName = `morshid_issue82_${randomUUID().replaceAll('-', '')}`
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
    persistence = new PrismaRagPersistenceRepository(prisma)
    retrievalRepository = new PrismaCourseRetrievalRepository(prisma)
  })

  afterAll(async () => {
    try {
      await disconnectQuietly(prisma)
    } finally {
      await runDatabaseAdminStatement(
        originalDatabaseUrl,
        `DROP DATABASE IF EXISTS "${disposableDatabaseName}" WITH (FORCE)`,
      )
    }
  })

  it('returns at most five same-course chunks in descending similarity order', async () => {
    const { courseId, materialId } = await seedCourseWithMaterial(prisma, {
      title: 'Python Basics',
    })
    // Six eligible chunks above the 0.70 floor; the cap must cut the sixth.
    const similarities = [0.95, 0.9, 0.85, 0.8, 0.75, 0.72]
    await persistence.insertMaterialChunks(
      materialId,
      similarities.map((similarity, chunkIndex) => ({
        chunkIndex,
        content: `Chunk with similarity ${String(similarity)}`,
        embedding: similarityVector(similarity),
        embeddingModel: 'test-embedding-1536',
      })),
    )

    const service = buildService(queryVectorProvider())
    const result = await service.retrieveCourseEvidence(courseId, 'query')

    expect(result.kind).toBe('evidence')
    if (result.kind !== 'evidence') {
      return
    }
    expect(result.chunks).toHaveLength(TOP_K)
    expect(result.chunks.map(({ rank }) => rank)).toEqual([1, 2, 3, 4, 5])
    expect(result.chunks.map(({ chunkIndex }) => chunkIndex)).toEqual([
      0, 1, 2, 3, 4,
    ])
    result.chunks.forEach((chunk, index) => {
      expect(chunk.similarityScore).toBeCloseTo(similarities[index], 5)
      expect(chunk).toEqual(
        expect.objectContaining({
          chunkId: expect.any(String) as string,
          materialId,
          materialTitle: 'Python Basics',
          content: `Chunk with similarity ${String(similarities[index])}`,
        }),
      )
    })
    const scores = result.chunks.map(({ similarityScore }) => similarityScore)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
  })

  it('reports insufficient evidence when no chunk reaches the threshold', async () => {
    const { courseId, materialId } = await seedCourseWithMaterial(prisma, {})
    await persistence.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Weakly related chunk',
        embedding: similarityVector(0.3),
        embeddingModel: 'test-embedding-1536',
      },
      {
        chunkIndex: 1,
        content: 'Barely related chunk',
        embedding: similarityVector(0.5),
        embeddingModel: 'test-embedding-1536',
      },
    ])

    const service = buildService(queryVectorProvider())
    await expect(
      service.retrieveCourseEvidence(courseId, 'unrelated question'),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })
  })

  it('excludes processing, failed, and soft-deleted materials while keeping warning ones', async () => {
    const owner = await createOwner(prisma)
    const courseId = await createCourse(
      prisma,
      owner,
      `I82-${randomUUID().slice(0, 20)}`,
    )
    const readyMaterialId = await createMaterial(prisma, {
      courseId,
      uploadedById: owner,
      title: 'Ready material',
      status: 'READY',
    })
    const warningMaterialId = await createMaterial(prisma, {
      courseId,
      uploadedById: owner,
      title: 'Warning material',
      status: 'WARNING',
    })
    const excludedMaterials = [
      await createMaterial(prisma, {
        courseId,
        uploadedById: owner,
        title: 'Processing material',
        status: 'PROCESSING',
      }),
      await createMaterial(prisma, {
        courseId,
        uploadedById: owner,
        title: 'Failed material',
        status: 'FAILED',
      }),
      await createMaterial(prisma, {
        courseId,
        uploadedById: owner,
        title: 'Deleted material',
        status: 'READY',
        deletedAt: new Date(),
      }),
    ]

    await persistence.insertMaterialChunks(readyMaterialId, [
      {
        chunkIndex: 0,
        content: 'Ready chunk',
        embedding: similarityVector(0.9),
        embeddingModel: 'test-embedding-1536',
      },
    ])
    await persistence.insertMaterialChunks(warningMaterialId, [
      {
        chunkIndex: 0,
        content: 'Warning chunk',
        embedding: similarityVector(0.8),
        embeddingModel: 'test-embedding-1536',
      },
    ])
    // The ineligible materials hold the most similar chunks; none may return.
    for (const materialId of excludedMaterials) {
      await persistence.insertMaterialChunks(materialId, [
        {
          chunkIndex: 0,
          content: 'Ineligible chunk',
          embedding: similarityVector(0.99),
          embeddingModel: 'test-embedding-1536',
        },
      ])
    }

    const service = buildService(queryVectorProvider())
    const result = await service.retrieveCourseEvidence(courseId, 'query')

    expect(result.kind).toBe('evidence')
    if (result.kind !== 'evidence') {
      return
    }
    expect(result.chunks.map(({ materialTitle }) => materialTitle)).toEqual([
      'Ready material',
      'Warning material',
    ])
    expect(
      result.chunks.some(({ content }) => content === 'Ineligible chunk'),
    ).toBe(false)
  })

  it('never returns chunks from another course, even more similar or identical ones', async () => {
    const owner = await createOwner(prisma)
    const pythonCourseId = await createCourse(
      prisma,
      owner,
      `PY-${randomUUID().slice(0, 20)}`,
    )
    const hiddenCourseId = await createCourse(prisma, owner, 'HIDDEN-ISOLATION')
    const pythonMaterialId = await createMaterial(prisma, {
      courseId: pythonCourseId,
      uploadedById: owner,
      title: 'Python material',
      status: 'READY',
    })
    const hiddenMaterialId = await createMaterial(prisma, {
      courseId: hiddenCourseId,
      uploadedById: owner,
      title: 'Hidden material',
      status: 'READY',
    })

    const duplicateContent = 'Variables bind names to values.'
    await persistence.insertMaterialChunks(pythonMaterialId, [
      {
        chunkIndex: 0,
        content: 'Python chunk',
        embedding: similarityVector(0.85),
        embeddingModel: 'test-embedding-1536',
      },
      {
        chunkIndex: 1,
        content: duplicateContent,
        embedding: similarityVector(0.8),
        embeddingModel: 'test-embedding-1536',
      },
    ])
    // The hidden course holds a deliberately more similar chunk and a copy of
    // the duplicate text; neither may cross the course boundary.
    await persistence.insertMaterialChunks(hiddenMaterialId, [
      {
        chunkIndex: 0,
        content: 'Hidden more-similar chunk',
        embedding: similarityVector(0.99),
        embeddingModel: 'test-embedding-1536',
      },
      {
        chunkIndex: 1,
        content: duplicateContent,
        embedding: similarityVector(0.98),
        embeddingModel: 'test-embedding-1536',
      },
    ])

    const service = buildService(queryVectorProvider())
    const result = await service.retrieveCourseEvidence(pythonCourseId, 'query')

    expect(result.kind).toBe('evidence')
    if (result.kind !== 'evidence') {
      return
    }
    expect(result.chunks.map(({ materialId }) => materialId)).toEqual([
      pythonMaterialId,
      pythonMaterialId,
    ])
    const duplicates = result.chunks.filter(
      ({ content }) => content === duplicateContent,
    )
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].materialId).toBe(pythonMaterialId)
    expect(duplicates[0].similarityScore).toBeCloseTo(0.8, 5)
  })

  it('round-trips deterministic embeddings from persistence to ranked evidence', async () => {
    const { courseId, materialId } = await seedCourseWithMaterial(prisma, {
      title: 'Python Basics',
    })
    const provider = new DeterministicEmbeddingProvider()
    const chunkEmbedding = new MaterialChunkEmbeddingService(
      provider,
      persistence,
    )
    const chunkText = 'Python variables store references to objects.'
    await chunkEmbedding.embedAndReplaceMaterialChunks(materialId, [
      { chunkIndex: 0, content: chunkText },
      { chunkIndex: 1, content: 'Loops repeat a block of statements.' },
    ])

    const stored = await persistence.findMaterialChunks(materialId)
    expect(stored).toHaveLength(2)
    expect(
      stored.every(({ embeddingModel }) => embeddingModel === provider.model),
    ).toBe(true)
    expect(stored.every(({ embedding }) => embedding.length === 1_536)).toBe(
      true,
    )

    const service = buildService(provider)
    const sameTextResult = await service.retrieveCourseEvidence(
      courseId,
      chunkText,
    )
    expect(sameTextResult.kind).toBe('evidence')
    if (sameTextResult.kind !== 'evidence') {
      return
    }
    expect(sameTextResult.chunks[0]).toEqual(
      expect.objectContaining({ rank: 1, chunkIndex: 0, content: chunkText }),
    )
    expect(sameTextResult.chunks[0].similarityScore).toBeCloseTo(1, 4)

    // Deterministic embeddings of unrelated texts are nearly orthogonal, so an
    // off-topic query must fall below the 0.70 floor.
    await expect(
      service.retrieveCourseEvidence(
        courseId,
        'How do medieval trade routes explain spice prices?',
      ),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })
  })

  function buildService(provider: EmbeddingProvider): RetrievalService {
    const configService = {
      get: (key: 'RETRIEVAL_TOP_K' | 'RETRIEVAL_MIN_SIMILARITY') =>
        key === 'RETRIEVAL_TOP_K' ? TOP_K : MIN_SIMILARITY,
    } as unknown as ConfigService<AppEnvironment, true>

    return new RetrievalService(provider, retrievalRepository, configService)
  }
})

// A stub provider that embeds every query as the reference vector the seeded
// chunks were built against, so each chunk's cosine similarity is exactly the
// value passed to similarityVector (up to float4 quantization).
function queryVectorProvider(): EmbeddingProvider {
  return {
    model: 'query-vector-stub',
    embedBatch: (texts: readonly string[]) =>
      Promise.resolve(texts.map(() => referenceQueryVector())),
  }
}

function referenceQueryVector(): number[] {
  const vector = new Array<number>(1_536).fill(0)
  vector[0] = 1
  return vector
}

// Unit vector whose cosine similarity against the reference query vector is
// exactly `similarity`: [s, sqrt(1 - s^2), 0, ...].
function similarityVector(similarity: number): number[] {
  const vector = new Array<number>(1_536).fill(0)
  vector[0] = similarity
  vector[1] = Math.sqrt(1 - similarity * similarity)
  return vector
}

async function seedCourseWithMaterial(
  prisma: PrismaService,
  options: { title?: string },
): Promise<{ courseId: string; materialId: string }> {
  const owner = await createOwner(prisma)
  const courseId = await createCourse(
    prisma,
    owner,
    `I82-${randomUUID().slice(0, 20)}`,
  )
  const materialId = await createMaterial(prisma, {
    courseId,
    uploadedById: owner,
    title: options.title ?? 'Course material',
    status: 'READY',
  })

  return { courseId, materialId }
}

async function createOwner(prisma: PrismaService): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `issue82-${randomUUID()}@morshid.test`,
      displayName: 'Issue 82 uploader',
      role: 'INSTRUCTOR',
      passwordHash: 'test-password-hash',
    },
  })

  return user.id
}

async function createCourse(
  prisma: PrismaService,
  createdById: string,
  code: string,
): Promise<string> {
  const course = await prisma.course.create({
    data: {
      code,
      title: `Course ${code}`,
      createdById,
    },
  })

  return course.id
}

async function createMaterial(
  prisma: PrismaService,
  options: {
    courseId: string
    uploadedById: string
    title: string
    status: 'PROCESSING' | 'READY' | 'WARNING' | 'FAILED'
    deletedAt?: Date
  },
): Promise<string> {
  const material = await prisma.material.create({
    data: {
      courseId: options.courseId,
      uploadedById: options.uploadedById,
      title: options.title,
      originalFilename: `${randomUUID()}.pdf`,
      storagePath: `${randomUUID()}.pdf`,
      status: options.status,
      deletedAt: options.deletedAt,
    },
  })

  return material.id
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
    throw new Error('DATABASE_URL is required for retrieval e2e tests')
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
