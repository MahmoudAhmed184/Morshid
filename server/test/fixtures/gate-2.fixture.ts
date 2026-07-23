import type { Material } from '../../src/generated/prisma/client'
import { DeterministicEmbeddingProvider } from '../../src/modules/embedding/deterministic-embedding.provider'
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
} from '../../src/modules/embedding/embedding-provider'
import type { PdfStorage } from '../../src/modules/pdf-storage/pdf-storage'
import type { PrismaService } from '../../src/modules/prisma/prisma.service'
import type { RagPersistenceRepository } from '../../src/modules/rag-persistence/rag-persistence.repository'
import { cleanTextPdf } from './pdf-fixtures'

export const GATE_2_FIXTURE = {
  sourceTitle: 'Gate 2 Python Collections',
  sourceFilename: 'gate-2-python-collections.pdf',
  question:
    'What is the difference between a Python list and a dictionary, and when would I use each?',
  unsupportedQuestion:
    'How do I calculate orbital transfer windows for a mission to Neptune?',
  visibleSentinel: 'GATE_2_AUTHORIZED_PYTHON_COLLECTIONS',
  hiddenSentinel: 'GATE_2_HIDDEN_ISOLATION_MUST_NEVER_LEAK',
} as const

export const GATE_2_VISIBLE_SIMILARITY = 0.82
export const GATE_2_HIDDEN_SIMILARITY = 0.99
export const GATE_2_BELOW_THRESHOLD_SIMILARITY = -GATE_2_VISIBLE_SIMILARITY
export const GATE_2_RETRIEVAL_MIN_SIMILARITY = 0.7
export const GATE_2_RETRIEVAL_TOP_K = 5

const QUERY_VECTOR = unitSimilarityVector(1)
const VISIBLE_VECTOR = unitSimilarityVector(GATE_2_VISIBLE_SIMILARITY)
const HIDDEN_VECTOR = unitSimilarityVector(GATE_2_HIDDEN_SIMILARITY)
const UNSUPPORTED_VECTOR = unitSimilarityVector(-1)

export class Gate2DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'gate-2-deterministic-embedding-v1'
  private readonly fallback = new DeterministicEmbeddingProvider()

  embedBatch(
    texts: readonly string[],
  ): Promise<readonly (readonly number[])[]> {
    return Promise.all(texts.map((text) => this.embedText(text)))
  }

  private embedText(text: string): Promise<readonly number[]> {
    const normalized = text.trim()

    if (normalized === GATE_2_FIXTURE.question) {
      return Promise.resolve([...QUERY_VECTOR])
    }
    if (normalized === GATE_2_FIXTURE.unsupportedQuestion) {
      return Promise.resolve([...UNSUPPORTED_VECTOR])
    }
    if (normalized.includes(GATE_2_FIXTURE.visibleSentinel)) {
      return Promise.resolve([...VISIBLE_VECTOR])
    }

    return this.fallback
      .embedBatch([normalized])
      .then(([embedding]) => [...embedding])
  }
}

export function gate2PermissionSafePdf(): Buffer {
  return cleanTextPdf(
    [
      GATE_2_FIXTURE.visibleSentinel,
      'A Python list stores an ordered collection addressed by numeric index.',
      'A Python dictionary maps unique keys to values.',
      'Use a list for ordered items and a dictionary for named lookups.',
    ].join(' '),
  )
}

export interface Gate2HiddenAdversary {
  chunkId: string
  content: string
  material: Material
}

export interface Gate2MaterialFixtureContext {
  courseId: string
  persistence: RagPersistenceRepository
  prisma: PrismaService
  storage: PdfStorage
  uploadedById: string
}

export async function injectGate2HiddenAdversary(
  input: Gate2MaterialFixtureContext,
): Promise<Gate2HiddenAdversary> {
  const content = [
    GATE_2_FIXTURE.hiddenSentinel,
    'This deliberately stronger vector belongs only to HIDDEN-ISOLATION.',
  ].join(' ')
  return injectGate2Material({
    ...input,
    content,
    title: 'Gate 2 hidden adversarial source',
    filename: 'gate-2-hidden-isolation.pdf',
    embedding: HIDDEN_VECTOR,
    embeddingModel: 'gate-2-adversarial-vector-v1',
  })
}

export function injectGate2BelowThresholdEvidence(
  input: Gate2MaterialFixtureContext,
): Promise<Gate2HiddenAdversary> {
  const content = [
    GATE_2_FIXTURE.visibleSentinel,
    'This eligible Python row is deliberately below the unsupported query threshold.',
  ].join(' ')
  return injectGate2Material({
    ...input,
    content,
    title: 'Gate 2 below-threshold Python evidence',
    filename: 'gate-2-below-threshold.pdf',
    embedding: VISIBLE_VECTOR,
    embeddingModel: 'gate-2-below-threshold-vector-v1',
  })
}

async function injectGate2Material(
  input: Gate2MaterialFixtureContext & {
    content: string
    title: string
    filename: string
    embedding: readonly number[]
    embeddingModel: string
  },
): Promise<Gate2HiddenAdversary> {
  const storagePath = await input.storage.create(cleanTextPdf(input.content))
  const material = await input.prisma.material.create({
    data: {
      courseId: input.courseId,
      uploadedById: input.uploadedById,
      title: input.title,
      originalFilename: input.filename,
      storagePath,
      status: 'READY',
      extractedTextLength: input.content.length,
      chunkCount: 1,
    },
  })

  await input.persistence.insertMaterialChunks(material.id, [
    {
      chunkIndex: 0,
      content: input.content,
      embedding: input.embedding,
      embeddingModel: input.embeddingModel,
    },
  ])
  const chunks = await input.persistence.findMaterialChunks(material.id)

  if (chunks.length !== 1) {
    throw new Error(
      `Gate 2 fixture expected one persisted chunk, received ${String(chunks.length)}`,
    )
  }

  const chunk = chunks[0]
  return { chunkId: chunk.id, content: input.content, material }
}

function unitSimilarityVector(similarity: number): readonly number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
  vector[0] = similarity
  vector[1] = Math.sqrt(1 - similarity * similarity)
  return Object.freeze(vector)
}
