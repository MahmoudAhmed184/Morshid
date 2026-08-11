import type { Material } from '../../src/generated/prisma/client'
import { DeterministicEmbeddingProvider } from '../../src/platform/ai/embedding/deterministic-embedding.provider'
import {
  EMBEDDING_DIMENSIONS,
  type Embedding,
  type EmbeddingDocument,
  type EmbeddingProvider,
} from '../../src/platform/ai/embedding/embedding-provider'
import type { PdfStorage } from '../../src/platform/document-storage/pdf-storage'
import type { PrismaService } from '../../src/platform/database/prisma.service'
import type { MaterialChunkRepository } from '../../src/modules/materials/material-chunk.repository'
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
  visibleEvidenceChunk: 'GATE_2_AUTHORIZED_PYTHON_COLLECTIONS A Python list st',
  visibleContent: [
    'GATE_2_AUTHORIZED_PYTHON_COLLECTIONS',
    'A Python list stores an ordered collection addressed by numeric index.',
    'A Python dictionary maps unique keys to values.',
    'Use a list for ordered items and a dictionary for named lookups.',
  ].join(' '),
} as const

export const GATE_2_VISIBLE_SIMILARITY = 0.82
export const GATE_2_HIDDEN_SIMILARITY = 0.99
export const GATE_2_BELOW_THRESHOLD_SIMILARITY = -GATE_2_VISIBLE_SIMILARITY
export const GATE_2_RETRIEVAL_MIN_SIMILARITY = 0.62
export const GATE_2_RETRIEVAL_TOP_K = 5

const QUERY_VECTOR = unitSimilarityVector(1)
const VISIBLE_VECTOR = unitSimilarityVector(GATE_2_VISIBLE_SIMILARITY)
const HIDDEN_VECTOR = unitSimilarityVector(GATE_2_HIDDEN_SIMILARITY)
const UNSUPPORTED_VECTOR = unitSimilarityVector(-1)

// Retrieval filters on the active document profile, so every adversarial row
// below is stored under this same profile. A row in a foreign profile would be
// excluded by the profile filter instead of by the boundary or threshold each
// adversary is meant to exercise, which would silently weaken the fixture.
export const GATE_2_EMBEDDING_MODEL = 'gate-2-deterministic-embedding-v1'

export class Gate2DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly model = GATE_2_EMBEDDING_MODEL
  readonly queryProtocol = GATE_2_EMBEDDING_MODEL
  private readonly fallback = new DeterministicEmbeddingProvider()

  // Symmetric like the deterministic provider it falls back to: the gate's
  // similarity assertions only hold because a query and its matching chunk land
  // in the same vector space.
  embedQuery(query: string): Promise<Embedding> {
    return this.embedText(query)
  }

  embedDocuments(
    documents: readonly EmbeddingDocument[],
  ): Promise<readonly Embedding[]> {
    return Promise.all(
      documents.map((document) => this.embedText(document.text)),
    )
  }

  private embedText(text: string): Promise<Embedding> {
    const normalized = text.trim()

    if (
      normalized === GATE_2_FIXTURE.question ||
      normalized.includes(`Current student message: ${GATE_2_FIXTURE.question}`)
    ) {
      return Promise.resolve([...QUERY_VECTOR])
    }
    if (normalized === GATE_2_FIXTURE.unsupportedQuestion) {
      return Promise.resolve([...UNSUPPORTED_VECTOR])
    }
    if (normalized.includes(GATE_2_FIXTURE.visibleSentinel)) {
      return Promise.resolve([...VISIBLE_VECTOR])
    }

    return this.fallback
      .embedDocuments([{ text: normalized }])
      .then(([embedding]) => [...embedding])
  }
}

export function gate2PermissionSafePdf(): Buffer {
  return cleanTextPdf(GATE_2_FIXTURE.visibleContent)
}

export interface Gate2HiddenAdversary {
  chunkId: string
  content: string
  material: Material
}

export interface Gate2MaterialFixtureContext {
  courseId: string
  persistence: MaterialChunkRepository
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
    embeddingModel: GATE_2_EMBEDDING_MODEL,
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
    embeddingModel: GATE_2_EMBEDDING_MODEL,
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
