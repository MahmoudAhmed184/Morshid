import type { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../src/modules/config/env.schema'
import type { EmbeddingProvider } from '../src/modules/embedding/embedding-provider'
import type { PdfStorage } from '../src/modules/pdf-storage/pdf-storage'
import type { PrismaService } from '../src/modules/prisma/prisma.service'
import { PrismaCourseRetrievalRepository } from '../src/modules/retrieval/course-retrieval.repository'
import {
  RetrievalService,
  type CourseRetrievalResult,
  type RetrievedChunk,
} from '../src/modules/retrieval/retrieval.service'
import {
  RETRIEVAL_TASK_83,
  retrievalTask83QueryEmbedding,
  seedRetrievalTask83Fixture,
} from './fixtures/retrieval-task-83.fixture'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

const DEFAULT_TOP_K = 3
const DEFAULT_MIN_SIMILARITY = 0.7
const EXACT_THRESHOLD = 0.8

describe('Retrieval threshold readiness and cross-course isolation (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let retrievalRepository: PrismaCourseRetrievalRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue83')
    prisma = database.prisma
    retrievalRepository = new PrismaCourseRetrievalRepository(prisma)
    await seedRetrievalTask83Fixture(prisma)
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('returns relevant active Python chunks in relevance order and limits them by top-k', async () => {
    const result = await buildService().retrieveCourseEvidence(
      RETRIEVAL_TASK_83.pythonCourseId,
      'synthetic Python retrieval question',
    )
    const chunks = requireEvidence(result)

    expect(chunks.map(({ chunkId }) => chunkId)).toEqual([
      RETRIEVAL_TASK_83.chunkIds.pythonRelevant,
      RETRIEVAL_TASK_83.chunkIds.pythonIdentical,
      RETRIEVAL_TASK_83.chunkIds.warningUsable,
    ])
    expect(chunks.map(({ rank }) => rank)).toEqual([1, 2, 3])
    expect(chunks).toHaveLength(DEFAULT_TOP_K)
    expect(chunks[0].materialId).toBe(RETRIEVAL_TASK_83.materialIds.ready)
    expect(chunks[0].content).toContain(RETRIEVAL_TASK_83.sentinels.python)
    expect(chunks.map(({ similarityScore }) => similarityScore)).toEqual([
      expect.closeTo(0.95, 5),
      expect.closeTo(0.9, 5),
      expect.closeTo(0.85, 5),
    ])
    expect(
      chunks.some(
        ({ chunkId }) => chunkId === RETRIEVAL_TASK_83.chunkIds.topKOverflow,
      ),
    ).toBe(false)
  })

  it('includes a score exactly equal to the threshold and excludes a score below it', async () => {
    const result = await buildService({
      topK: 10,
      minSimilarity: EXACT_THRESHOLD,
    }).retrieveCourseEvidence(
      RETRIEVAL_TASK_83.pythonCourseId,
      'synthetic threshold question',
    )
    const chunks = requireEvidence(result)

    expect(chunks.map(({ chunkId }) => chunkId)).toEqual([
      RETRIEVAL_TASK_83.chunkIds.pythonRelevant,
      RETRIEVAL_TASK_83.chunkIds.pythonIdentical,
      RETRIEVAL_TASK_83.chunkIds.warningUsable,
      RETRIEVAL_TASK_83.chunkIds.topKOverflow,
      RETRIEVAL_TASK_83.chunkIds.exactThreshold,
    ])
    expect(
      chunks.find(
        ({ chunkId }) => chunkId === RETRIEVAL_TASK_83.chunkIds.exactThreshold,
      )?.similarityScore,
    ).toBe(EXACT_THRESHOLD)
    expect(
      chunks.some(
        ({ chunkId }) => chunkId === RETRIEVAL_TASK_83.chunkIds.belowThreshold,
      ),
    ).toBe(false)
  })

  it('returns insufficient evidence when no active-course chunk qualifies', async () => {
    await expect(
      buildService({ minSimilarity: 0.96 }).retrieveCourseEvidence(
        RETRIEVAL_TASK_83.pythonCourseId,
        'synthetic unsupported question',
      ),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })
  })

  it('includes only usable READY and contract-allowed WARNING materials', async () => {
    const result = await buildService({ topK: 50 }).retrieveCourseEvidence(
      RETRIEVAL_TASK_83.pythonCourseId,
      'synthetic material readiness question',
    )
    const chunks = requireEvidence(result)

    expect(chunks.map(({ chunkId }) => chunkId)).toEqual([
      RETRIEVAL_TASK_83.chunkIds.pythonRelevant,
      RETRIEVAL_TASK_83.chunkIds.pythonIdentical,
      RETRIEVAL_TASK_83.chunkIds.warningUsable,
      RETRIEVAL_TASK_83.chunkIds.topKOverflow,
      RETRIEVAL_TASK_83.chunkIds.exactThreshold,
      RETRIEVAL_TASK_83.chunkIds.belowThreshold,
    ])
    expect(new Set(chunks.map(({ materialId }) => materialId))).toEqual(
      new Set([
        RETRIEVAL_TASK_83.materialIds.ready,
        RETRIEVAL_TASK_83.materialIds.warning,
      ]),
    )
    expect(chunks.map(({ chunkId }) => chunkId)).not.toEqual(
      expect.arrayContaining([
        RETRIEVAL_TASK_83.chunkIds.processing,
        RETRIEVAL_TASK_83.chunkIds.failed,
        RETRIEVAL_TASK_83.chunkIds.deleted,
        RETRIEVAL_TASK_83.chunkIds.incomplete,
        RETRIEVAL_TASK_83.chunkIds.missing,
        RETRIEVAL_TASK_83.chunkIds.unavailable,
      ]),
    )
  })

  it('never returns stronger or identical-text chunks from HIDDEN-ISOLATION', async () => {
    const result = await buildService({ topK: 50 }).retrieveCourseEvidence(
      RETRIEVAL_TASK_83.pythonCourseId,
      'synthetic course-isolation question',
    )
    const chunks = requireEvidence(result)

    expect(chunks.map(({ chunkId }) => chunkId)).not.toEqual(
      expect.arrayContaining([
        RETRIEVAL_TASK_83.chunkIds.hiddenStronger,
        RETRIEVAL_TASK_83.chunkIds.hiddenIdentical,
      ]),
    )
    expect(chunks.map(({ materialId }) => materialId)).not.toContain(
      RETRIEVAL_TASK_83.materialIds.hidden,
    )
    const identicalRows = chunks.filter(
      ({ content }) => content === RETRIEVAL_TASK_83.sentinels.identical,
    )
    expect(identicalRows).toEqual([
      expect.objectContaining({
        chunkId: RETRIEVAL_TASK_83.chunkIds.pythonIdentical,
        materialId: RETRIEVAL_TASK_83.materialIds.ready,
      }),
    ])
  })

  it('exposes no hidden-course chunk to completion context or citation candidates', async () => {
    const result = await buildService({ topK: 50 }).retrieveCourseEvidence(
      RETRIEVAL_TASK_83.pythonCourseId,
      'synthetic downstream-boundary question',
    )
    const chunks = requireEvidence(result)
    const completionProvider = {
      complete: jest.fn((_context: readonly RetrievedChunk[]) =>
        Promise.resolve('synthetic completion'),
      ),
    }
    const collectCitationCandidates = jest.fn(
      (_chunks: readonly RetrievedChunk[]) => undefined,
    )

    await completionProvider.complete(chunks)
    collectCitationCandidates(chunks)

    const completionContext = completionProvider.complete.mock.calls[0][0]
    const citationCandidates = collectCitationCandidates.mock.calls[0][0]
    const expectedChunkIds = [
      RETRIEVAL_TASK_83.chunkIds.pythonRelevant,
      RETRIEVAL_TASK_83.chunkIds.pythonIdentical,
      RETRIEVAL_TASK_83.chunkIds.warningUsable,
      RETRIEVAL_TASK_83.chunkIds.topKOverflow,
      RETRIEVAL_TASK_83.chunkIds.exactThreshold,
      RETRIEVAL_TASK_83.chunkIds.belowThreshold,
    ]

    expect(completionContext.map(({ chunkId }) => chunkId)).toEqual(
      expectedChunkIds,
    )
    expect(citationCandidates.map(({ chunkId }) => chunkId)).toEqual(
      expectedChunkIds,
    )
    expect(JSON.stringify(completionContext)).not.toContain(
      RETRIEVAL_TASK_83.sentinels.hidden,
    )
    expect(JSON.stringify(citationCandidates)).not.toContain(
      RETRIEVAL_TASK_83.sentinels.hidden,
    )
    expect(completionContext.map(({ materialId }) => materialId)).not.toContain(
      RETRIEVAL_TASK_83.materialIds.hidden,
    )
    expect(
      citationCandidates.map(({ materialId }) => materialId),
    ).not.toContain(RETRIEVAL_TASK_83.materialIds.hidden)
  })

  function buildService(
    overrides: { topK?: number; minSimilarity?: number } = {},
  ): RetrievalService {
    const topK = overrides.topK ?? DEFAULT_TOP_K
    const minSimilarity = overrides.minSimilarity ?? DEFAULT_MIN_SIMILARITY
    const embeddingProvider = {
      model: 'task-83-query-vector',
      embedBatch: (texts: readonly string[]) =>
        Promise.resolve(texts.map(() => retrievalTask83QueryEmbedding())),
    } satisfies EmbeddingProvider
    const configService = {
      get: (key: 'RETRIEVAL_TOP_K' | 'RETRIEVAL_MIN_SIMILARITY') =>
        key === 'RETRIEVAL_TOP_K' ? topK : minSimilarity,
    } as unknown as ConfigService<AppEnvironment, true>
    const pdfStorage = {
      exists: (storagePath: string) => {
        if (storagePath === RETRIEVAL_TASK_83.storagePaths.unavailable) {
          return Promise.reject(new Error('synthetic storage unavailable'))
        }
        return Promise.resolve(
          storagePath !== RETRIEVAL_TASK_83.storagePaths.missing,
        )
      },
    } as unknown as PdfStorage

    return new RetrievalService(
      embeddingProvider,
      retrievalRepository,
      configService,
      pdfStorage,
    )
  }
})

function requireEvidence(result: CourseRetrievalResult): RetrievedChunk[] {
  expect(result.kind).toBe('evidence')
  if (result.kind !== 'evidence') {
    throw new Error('Expected Task 83 fixture to produce retrieval evidence')
  }
  return result.chunks
}
