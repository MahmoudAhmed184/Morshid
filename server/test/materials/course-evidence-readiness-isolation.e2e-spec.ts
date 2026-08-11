import type { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../../src/platform/config/env.schema'
import type { EmbeddingProvider } from '../../src/platform/ai/embedding/embedding-provider'
import type { PdfStorage } from '../../src/platform/document-storage/pdf-storage'
import type { PrismaService } from '../../src/platform/database/prisma.service'
import { PrismaCourseEvidenceRepository } from '../../src/modules/materials/course-evidence.repository'
import {
  MaterialsCourseEvidence,
  type CourseEvidenceResult,
  type CourseEvidenceChunk,
} from '../../src/modules/materials/course-evidence'
import {
  COURSE_EVIDENCE_TASK_83,
  COURSE_EVIDENCE_TASK_83_EMBEDDING_MODEL,
  retrievalTask83QueryEmbedding,
  seedCourseEvidenceTask83Fixture,
} from '../fixtures/course-evidence-task-83.fixture'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

const DEFAULT_TOP_K = 3
const DEFAULT_MIN_SIMILARITY = 0.62
const EXACT_THRESHOLD = 0.8

describe('Course evidence readiness and cross-course isolation (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let courseEvidenceRepository: PrismaCourseEvidenceRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue83')
    prisma = database.prisma
    courseEvidenceRepository = new PrismaCourseEvidenceRepository(prisma)
    await seedCourseEvidenceTask83Fixture(prisma)
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('returns relevant active Python chunks in relevance order and limits them by top-k', async () => {
    const result = await buildService().search(
      COURSE_EVIDENCE_TASK_83.pythonCourseId,
      'synthetic Python course-evidence question',
    )
    const chunks = requireEvidence(result)

    expect(chunks.map(({ chunkId }) => chunkId)).toEqual([
      COURSE_EVIDENCE_TASK_83.chunkIds.pythonRelevant,
      COURSE_EVIDENCE_TASK_83.chunkIds.pythonIdentical,
      COURSE_EVIDENCE_TASK_83.chunkIds.warningUsable,
    ])
    expect(chunks.map(({ rank }) => rank)).toEqual([1, 2, 3])
    expect(chunks).toHaveLength(DEFAULT_TOP_K)
    expect(chunks[0].materialId).toBe(COURSE_EVIDENCE_TASK_83.materialIds.ready)
    expect(chunks[0].content).toContain(
      COURSE_EVIDENCE_TASK_83.sentinels.python,
    )
    expect(chunks.map(({ similarityScore }) => similarityScore)).toEqual([
      expect.closeTo(0.95, 5),
      expect.closeTo(0.9, 5),
      expect.closeTo(0.85, 5),
    ])
    expect(
      chunks.some(
        ({ chunkId }) =>
          chunkId === COURSE_EVIDENCE_TASK_83.chunkIds.topKOverflow,
      ),
    ).toBe(false)
  })

  it('includes a score exactly equal to the threshold and excludes a score below it', async () => {
    const result = await buildService({
      topK: 10,
      minSimilarity: EXACT_THRESHOLD,
    }).search(
      COURSE_EVIDENCE_TASK_83.pythonCourseId,
      'synthetic course-evidence threshold question',
    )
    const chunks = requireEvidence(result)

    expect(chunks.map(({ chunkId }) => chunkId)).toEqual([
      COURSE_EVIDENCE_TASK_83.chunkIds.pythonRelevant,
      COURSE_EVIDENCE_TASK_83.chunkIds.pythonIdentical,
      COURSE_EVIDENCE_TASK_83.chunkIds.warningUsable,
      COURSE_EVIDENCE_TASK_83.chunkIds.topKOverflow,
      COURSE_EVIDENCE_TASK_83.chunkIds.exactThreshold,
    ])
    expect(
      chunks.find(
        ({ chunkId }) =>
          chunkId === COURSE_EVIDENCE_TASK_83.chunkIds.exactThreshold,
      )?.similarityScore,
    ).toBe(EXACT_THRESHOLD)
    expect(
      chunks.some(
        ({ chunkId }) =>
          chunkId === COURSE_EVIDENCE_TASK_83.chunkIds.belowThreshold,
      ),
    ).toBe(false)
  })

  it('returns insufficient evidence when no active-course chunk qualifies', async () => {
    await expect(
      buildService({ minSimilarity: 0.96 }).search(
        COURSE_EVIDENCE_TASK_83.pythonCourseId,
        'synthetic unsupported question',
      ),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })
  })

  it('includes only usable READY and contract-allowed WARNING materials', async () => {
    const statusAdversaries = await prisma.material.findMany({
      where: {
        id: {
          in: [
            COURSE_EVIDENCE_TASK_83.materialIds.processing,
            COURSE_EVIDENCE_TASK_83.materialIds.failed,
            COURSE_EVIDENCE_TASK_83.materialIds.incomplete,
          ],
        },
      },
      select: {
        id: true,
        status: true,
        extractedTextLength: true,
        chunkCount: true,
      },
      orderBy: { id: 'asc' },
    })

    expect(statusAdversaries).toEqual([
      {
        id: COURSE_EVIDENCE_TASK_83.materialIds.processing,
        status: 'PROCESSING',
        extractedTextLength: 1_000,
        chunkCount: 1,
      },
      {
        id: COURSE_EVIDENCE_TASK_83.materialIds.failed,
        status: 'FAILED',
        extractedTextLength: 1_000,
        chunkCount: 1,
      },
      {
        id: COURSE_EVIDENCE_TASK_83.materialIds.incomplete,
        status: 'READY',
        extractedTextLength: null,
        chunkCount: null,
      },
    ])

    const result = await buildService({ topK: 50 }).search(
      COURSE_EVIDENCE_TASK_83.pythonCourseId,
      'synthetic material readiness question',
    )
    const chunks = requireEvidence(result)

    expect(chunks.map(({ chunkId }) => chunkId)).toEqual([
      COURSE_EVIDENCE_TASK_83.chunkIds.pythonRelevant,
      COURSE_EVIDENCE_TASK_83.chunkIds.pythonIdentical,
      COURSE_EVIDENCE_TASK_83.chunkIds.warningUsable,
      COURSE_EVIDENCE_TASK_83.chunkIds.topKOverflow,
      COURSE_EVIDENCE_TASK_83.chunkIds.exactThreshold,
      COURSE_EVIDENCE_TASK_83.chunkIds.belowThreshold,
    ])
    expect(new Set(chunks.map(({ materialId }) => materialId))).toEqual(
      new Set([
        COURSE_EVIDENCE_TASK_83.materialIds.ready,
        COURSE_EVIDENCE_TASK_83.materialIds.warning,
      ]),
    )
    expect(chunks.map(({ chunkId }) => chunkId)).not.toEqual(
      expect.arrayContaining([
        COURSE_EVIDENCE_TASK_83.chunkIds.processing,
        COURSE_EVIDENCE_TASK_83.chunkIds.failed,
        COURSE_EVIDENCE_TASK_83.chunkIds.deleted,
        COURSE_EVIDENCE_TASK_83.chunkIds.incomplete,
        COURSE_EVIDENCE_TASK_83.chunkIds.missing,
        COURSE_EVIDENCE_TASK_83.chunkIds.unavailable,
      ]),
    )
  })

  it('returns zero hidden-course rows at the production retrieval service boundary', async () => {
    const result = await buildService({ topK: 50 }).search(
      COURSE_EVIDENCE_TASK_83.pythonCourseId,
      'synthetic course-isolation question',
    )
    const chunks = requireEvidence(result)

    const hiddenRows = chunks.filter(
      ({ chunkId, materialId, content }) =>
        materialId === COURSE_EVIDENCE_TASK_83.materialIds.hidden ||
        chunkId === COURSE_EVIDENCE_TASK_83.chunkIds.hiddenStronger ||
        chunkId === COURSE_EVIDENCE_TASK_83.chunkIds.hiddenIdentical ||
        content.includes(COURSE_EVIDENCE_TASK_83.sentinels.hidden),
    )

    expect(hiddenRows).toHaveLength(0)
    const identicalRows = chunks.filter(
      ({ content }) => content === COURSE_EVIDENCE_TASK_83.sentinels.identical,
    )
    expect(identicalRows).toEqual([
      expect.objectContaining({
        chunkId: COURSE_EVIDENCE_TASK_83.chunkIds.pythonIdentical,
        materialId: COURSE_EVIDENCE_TASK_83.materialIds.ready,
      }),
    ])
  })

  it('blocks the whole course when the active profile covers none of its materials', async () => {
    await expect(
      buildService({
        embeddingModel: 'gemini/gemini-embedding-2/1536/document-v1',
      }).search(
        COURSE_EVIDENCE_TASK_83.pythonCourseId,
        'synthetic profile-mismatch question',
      ),
    ).resolves.toEqual({
      kind: 'embedding_profile_not_ready',
      expectedModel: 'gemini/gemini-embedding-2/1536/document-v1',
      incompleteMaterialIds: [
        COURSE_EVIDENCE_TASK_83.materialIds.ready,
        COURSE_EVIDENCE_TASK_83.materialIds.warning,
        COURSE_EVIDENCE_TASK_83.materialIds.missing,
        COURSE_EVIDENCE_TASK_83.materialIds.unavailable,
      ],
    })
  })

  function buildService(
    overrides: {
      topK?: number
      minSimilarity?: number
      embeddingModel?: string
    } = {},
  ): MaterialsCourseEvidence {
    const topK = overrides.topK ?? DEFAULT_TOP_K
    const minSimilarity = overrides.minSimilarity ?? DEFAULT_MIN_SIMILARITY
    const embeddingProvider = {
      model:
        overrides.embeddingModel ?? COURSE_EVIDENCE_TASK_83_EMBEDDING_MODEL,
      queryProtocol: 'task-83-query-vector',
      embedQuery: () => Promise.resolve(retrievalTask83QueryEmbedding()),
      embedDocuments: (documents) =>
        Promise.resolve(documents.map(() => retrievalTask83QueryEmbedding())),
    } satisfies EmbeddingProvider
    const configService = {
      get: (key: 'RETRIEVAL_TOP_K' | 'RETRIEVAL_MIN_SIMILARITY') =>
        key === 'RETRIEVAL_TOP_K' ? topK : minSimilarity,
    } as unknown as ConfigService<AppEnvironment, true>
    const pdfStorage = {
      exists: (storagePath: string) => {
        if (storagePath === COURSE_EVIDENCE_TASK_83.storagePaths.unavailable) {
          return Promise.reject(new Error('synthetic storage unavailable'))
        }
        return Promise.resolve(
          storagePath !== COURSE_EVIDENCE_TASK_83.storagePaths.missing,
        )
      },
    } as unknown as PdfStorage

    return new MaterialsCourseEvidence(
      embeddingProvider,
      courseEvidenceRepository,
      configService,
      pdfStorage,
    )
  }
})

function requireEvidence(result: CourseEvidenceResult): CourseEvidenceChunk[] {
  expect(result.kind).toBe('evidence')
  if (result.kind !== 'evidence') {
    throw new Error('Expected Task 83 fixture to produce retrieval evidence')
  }
  return result.chunks
}
