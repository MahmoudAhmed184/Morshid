import { randomUUID } from 'node:crypto'

import type { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../../src/platform/config/env.schema'
import { DeterministicEmbeddingProvider } from '../../src/platform/ai/embedding/deterministic-embedding.provider'
import type { EmbeddingProvider } from '../../src/platform/ai/embedding/embedding-provider'
import type { PrismaService } from '../../src/platform/database/prisma.service'
import type { PdfStorage } from '../../src/platform/document-storage/pdf-storage'
import { MaterialChunkEmbeddingService } from '../../src/modules/materials/processing/material-chunk-embedding.service'
import {
  PrismaMaterialChunkRepository,
  type MaterialChunkRepository,
} from '../../src/modules/materials/processing/material-chunk.repository'
import { PrismaCourseEvidenceRepository } from '../../src/modules/materials/evidence/course-evidence.repository'
import { MaterialsCourseEvidence } from '../../src/modules/materials/evidence/materials-course-evidence'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

const TOP_K = 5
// Seeded similarities deliberately straddle this floor (0.63 above, 0.61
// below) rather than sitting exactly on it: embeddings are stored as float4,
// so a chunk seeded at exactly 0.62 quantizes to a value marginally on either
// side of the >= boundary and the assertion would hinge on pgvector's
// float internals instead of the threshold semantics under test.
const MIN_SIMILARITY = 0.62
// Retrieval filters on the active document profile, so the seeded chunks and
// the stub provider must agree on it. A mismatch is exactly the cross-space
// mixing the filter exists to prevent, and is asserted separately below.
const TEST_EMBEDDING_MODEL = 'test-embedding-1536'

describe('Course-filtered top-k evidence (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let persistence: MaterialChunkRepository
  let courseEvidenceRepository: PrismaCourseEvidenceRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue82')
    prisma = database.prisma
    persistence = new PrismaMaterialChunkRepository(prisma)
    courseEvidenceRepository = new PrismaCourseEvidenceRepository(prisma)
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('returns at most five same-course chunks in descending similarity order', async () => {
    const { courseId, materialId } = await seedCourseWithMaterial(prisma, {
      title: 'Python Basics',
    })
    // Six eligible chunks above the calibrated 0.62 floor; the cap must cut
    // the sixth.
    const similarities = [0.95, 0.9, 0.85, 0.8, 0.75, 0.63]
    await persistence.insertMaterialChunks(
      materialId,
      similarities.map((similarity, chunkIndex) => ({
        chunkIndex,
        content: `Chunk with similarity ${String(similarity)}`,
        embedding: similarityVector(similarity),
        embeddingModel: TEST_EMBEDDING_MODEL,
      })),
    )

    const service = buildService(queryVectorProvider())
    const result = await service.search(courseId, 'query')

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

  it('uses the calibrated threshold to include just-above scores and reject below-threshold scores', async () => {
    const { courseId, materialId } = await seedCourseWithMaterial(prisma, {
      title: 'Calibrated threshold material',
    })
    await persistence.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Just above calibrated threshold',
        embedding: similarityVector(0.63),
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
      {
        chunkIndex: 1,
        content: 'Below calibrated threshold',
        embedding: similarityVector(0.61),
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
    ])

    const result = await buildService(queryVectorProvider()).search(
      courseId,
      'query',
    )

    expect(result.kind).toBe('evidence')
    if (result.kind !== 'evidence') {
      return
    }
    expect(result.chunks).toEqual([
      expect.objectContaining({
        content: 'Just above calibrated threshold',
        similarityScore: expect.closeTo(0.63, 5) as number,
      }),
    ])
  })

  it('reports insufficient evidence when no chunk reaches the threshold', async () => {
    const { courseId, materialId } = await seedCourseWithMaterial(prisma, {})
    await persistence.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Weakly related chunk',
        embedding: similarityVector(0.3),
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
      {
        chunkIndex: 1,
        content: 'Barely related chunk',
        embedding: similarityVector(0.5),
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
    ])

    const service = buildService(queryVectorProvider())
    await expect(
      service.search(courseId, 'unrelated question'),
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
    const incompleteWarningMaterialId = await createMaterial(prisma, {
      courseId,
      uploadedById: owner,
      title: 'Incomplete warning material',
      status: 'WARNING',
      completed: false,
    })
    const excludedMaterials = [
      incompleteWarningMaterialId,
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
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
    ])
    await persistence.insertMaterialChunks(warningMaterialId, [
      {
        chunkIndex: 0,
        content: 'Warning chunk',
        embedding: similarityVector(0.8),
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
    ])
    // The ineligible materials hold the most similar chunks; none may return.
    for (const materialId of excludedMaterials) {
      await persistence.insertMaterialChunks(materialId, [
        {
          chunkIndex: 0,
          content: 'Ineligible chunk',
          embedding: similarityVector(0.99),
          embeddingModel: TEST_EMBEDDING_MODEL,
        },
      ])
    }

    const service = buildService(queryVectorProvider())
    const result = await service.search(courseId, 'query')

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

  it('excludes a completed material when its backing PDF is missing', async () => {
    const { courseId, materialId } = await seedCourseWithMaterial(prisma, {
      title: 'Missing backing file',
    })
    await persistence.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Unavailable despite a highly similar vector',
        embedding: similarityVector(0.99),
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
    ])
    const unavailableStorage = {
      exists: () => Promise.resolve(false),
    } as unknown as PdfStorage

    await expect(
      buildService(queryVectorProvider(), unavailableStorage).search(
        courseId,
        'query',
      ),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })
  })

  it('backfills rank K+1 when the top K chunks share a missing PDF', async () => {
    const owner = await createOwner(prisma)
    const courseId = await createCourse(
      prisma,
      owner,
      `I80-${randomUUID().slice(0, 20)}`,
    )
    const missingMaterialId = await createMaterial(prisma, {
      courseId,
      uploadedById: owner,
      title: 'Missing top ranks',
      status: 'READY',
    })
    const availableMaterialId = await createMaterial(prisma, {
      courseId,
      uploadedById: owner,
      title: 'Available rank six',
      status: 'READY',
    })
    await persistence.insertMaterialChunks(
      missingMaterialId,
      [0.99, 0.98, 0.97, 0.96, 0.95].map((similarity, chunkIndex) => ({
        chunkIndex,
        content: `Missing ${String(chunkIndex)}`,
        embedding: similarityVector(similarity),
        embeddingModel: TEST_EMBEDDING_MODEL,
      })),
    )
    await persistence.insertMaterialChunks(availableMaterialId, [
      {
        chunkIndex: 0,
        content: 'Available rank K+1',
        embedding: similarityVector(0.94),
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
    ])
    const availableMaterial = await prisma.material.findUniqueOrThrow({
      where: { id: availableMaterialId },
      select: { storagePath: true },
    })
    const storage = {
      exists: (storagePath: string) =>
        Promise.resolve(storagePath === availableMaterial.storagePath),
    } as unknown as PdfStorage

    await expect(
      buildService(queryVectorProvider(), storage).search(courseId, 'query'),
    ).resolves.toEqual({
      kind: 'evidence',
      chunks: [
        expect.objectContaining({
          materialId: availableMaterialId,
          content: 'Available rank K+1',
          rank: 1,
        }),
      ],
    })
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
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
      {
        chunkIndex: 1,
        content: duplicateContent,
        embedding: similarityVector(0.8),
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
    ])
    // The hidden course holds a deliberately more similar chunk and a copy of
    // the duplicate text; neither may cross the course boundary.
    await persistence.insertMaterialChunks(hiddenMaterialId, [
      {
        chunkIndex: 0,
        content: 'Hidden more-similar chunk',
        embedding: similarityVector(0.99),
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
      {
        chunkIndex: 1,
        content: duplicateContent,
        embedding: similarityVector(0.98),
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
    ])

    const service = buildService(queryVectorProvider())
    const result = await service.search(pythonCourseId, 'query')

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

  it('never compares a query against chunks stored under another document profile', async () => {
    const { courseId, materialId } = await seedCourseWithMaterial(prisma, {
      title: 'Deterministic profile material',
    })
    await persistence.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        // A near-perfect vector under a *different* profile: dimensions match,
        // so Postgres would happily rank it first without the profile filter.
        content: 'Deterministic-profile chunk',
        embedding: similarityVector(0.99),
        embeddingModel: 'deterministic-embedding-v1',
      },
    ])

    // The course has one candidate material whose chunks all belong to another
    // profile, so the active profile covers none of them.
    await expect(
      buildService(
        queryVectorProvider('gemini/gemini-embedding-2/1536/document-v1'),
      ).search(courseId, 'query'),
    ).resolves.toEqual({
      kind: 'embedding_profile_not_ready',
      expectedModel: 'gemini/gemini-embedding-2/1536/document-v1',
      incompleteMaterialIds: [materialId],
    })
  })

  it('isolates two profiles stored side by side in the same material', async () => {
    const { courseId, materialId } = await seedCourseWithMaterial(prisma, {
      title: 'Mixed profile material',
    })
    await persistence.insertMaterialChunks(materialId, [
      {
        chunkIndex: 0,
        content: 'Active profile chunk',
        embedding: similarityVector(0.8),
        embeddingModel: TEST_EMBEDDING_MODEL,
      },
      {
        chunkIndex: 1,
        content: 'Foreign profile chunk',
        embedding: similarityVector(0.99),
        embeddingModel: 'iti-bedrock/us.cohere.embed-v4:0/1536/document-v1',
      },
    ])

    const result = await buildService(queryVectorProvider()).search(
      courseId,
      'query',
    )

    expect(result).toEqual({
      kind: 'evidence',
      chunks: [
        expect.objectContaining({
          content: 'Active profile chunk',
          rank: 1,
        }),
      ],
    })
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
    await chunkEmbedding.embedAndReplaceMaterialChunks(
      { id: materialId, title: 'Python Basics' },
      [
        { chunkIndex: 0, content: chunkText },
        { chunkIndex: 1, content: 'Loops repeat a block of statements.' },
      ],
    )

    const stored = await persistence.findMaterialChunks(materialId)
    expect(stored).toHaveLength(2)
    expect(
      stored.every(({ embeddingModel }) => embeddingModel === provider.model),
    ).toBe(true)
    expect(stored.every(({ embedding }) => embedding.length === 1_536)).toBe(
      true,
    )

    const service = buildService(provider)
    const sameTextResult = await service.search(courseId, chunkText)
    expect(sameTextResult.kind).toBe('evidence')
    if (sameTextResult.kind !== 'evidence') {
      return
    }
    expect(sameTextResult.chunks[0]).toEqual(
      expect.objectContaining({ rank: 1, chunkIndex: 0, content: chunkText }),
    )
    expect(sameTextResult.chunks[0].similarityScore).toBeCloseTo(1, 4)

    // Deterministic embeddings of unrelated texts are nearly orthogonal, so an
    // off-topic query must fall below the calibrated similarity floor.
    await expect(
      service.search(
        courseId,
        'How do medieval trade routes explain spice prices?',
      ),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })
  })

  function buildService(
    provider: EmbeddingProvider,
    storageOverride?: PdfStorage,
  ): MaterialsCourseEvidence {
    const configService = {
      get: (
        key:
          | 'PDF_MAX_UPLOAD_BYTES'
          | 'RETRIEVAL_TOP_K'
          | 'RETRIEVAL_MIN_SIMILARITY',
      ) => {
        if (key === 'PDF_MAX_UPLOAD_BYTES') {
          return 10 * 1024 * 1024
        }

        return key === 'RETRIEVAL_TOP_K' ? TOP_K : MIN_SIMILARITY
      },
    } as unknown as ConfigService<AppEnvironment, true>

    const storage =
      storageOverride ??
      ({
        exists: () => Promise.resolve(true),
      } as unknown as PdfStorage)

    return new MaterialsCourseEvidence(
      provider,
      courseEvidenceRepository,
      configService,
      storage,
    )
  }
})

// A stub provider that embeds every query as the reference vector the seeded
// chunks were built against, so each chunk's cosine similarity is exactly the
// value passed to similarityVector (up to float4 quantization).
function queryVectorProvider(
  model: string = TEST_EMBEDDING_MODEL,
): EmbeddingProvider {
  return {
    model,
    queryProtocol: `${model}/query-v1`,
    embedQuery: () => Promise.resolve(referenceQueryVector()),
    embedDocuments: (documents) =>
      Promise.resolve(documents.map(() => referenceQueryVector())),
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

async function getOrCreateTestUniversity(
  prisma: PrismaService,
): Promise<string> {
  const university = await prisma.university.upsert({
    where: { code: 'TEST-COURSE-EVIDENCE-UNIV' },
    update: {},
    create: {
      name: 'Test Course Evidence University',
      code: 'TEST-COURSE-EVIDENCE-UNIV',
      status: 'ACTIVE',
    },
  })
  return university.id
}

async function createOwner(prisma: PrismaService): Promise<string> {
  const universityId = await getOrCreateTestUniversity(prisma)
  const user = await prisma.user.create({
    data: {
      email: `issue82-${randomUUID()}@morshid.test`,
      displayName: 'Issue 82 uploader',
      role: 'INSTRUCTOR',
      universityId,
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
  const universityId = await getOrCreateTestUniversity(prisma)
  const course = await prisma.course.create({
    data: {
      code,
      title: `Course ${code}`,
      universityId,
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
    completed?: boolean
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
      extractedTextLength:
        options.completed !== false &&
        (options.status === 'READY' || options.status === 'WARNING')
          ? 100
          : null,
      chunkCount:
        options.completed !== false &&
        (options.status === 'READY' || options.status === 'WARNING')
          ? 1
          : null,
      deletedAt: options.deletedAt,
    },
  })

  return material.id
}
