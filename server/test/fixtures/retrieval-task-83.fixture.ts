import { Prisma, type MaterialStatus } from '../../src/generated/prisma/client'
import type { PrismaService } from '../../src/modules/prisma/prisma.service'

const EMBEDDING_DIMENSIONS = 1_536
const EMBEDDING_MODEL = 'task-83-deterministic-vector'

export const RETRIEVAL_TASK_83 = {
  ownerId: '83000000-0000-4000-8000-000000000001',
  pythonCourseId: '83000000-0000-4000-8000-000000000002',
  hiddenCourseId: '83000000-0000-4000-8000-000000000003',
  courseCodes: {
    python: 'PYTHON-PROG-P0',
    hidden: 'HIDDEN-ISOLATION',
  },
  sentinels: {
    python: 'PYTHON_VISIBLE_SENTINEL_83',
    hidden: 'HIDDEN_ISOLATION_SENTINEL_83',
    identical: 'IDENTICAL_CROSS_COURSE_TEXT_83',
  },
  storagePaths: {
    ready: '83000000-0000-4000-8000-000000000010.pdf',
    warning: '83000000-0000-4000-8000-000000000011.pdf',
    processing: '83000000-0000-4000-8000-000000000012.pdf',
    failed: '83000000-0000-4000-8000-000000000013.pdf',
    deleted: '83000000-0000-4000-8000-000000000014.pdf',
    incomplete: '83000000-0000-4000-8000-000000000015.pdf',
    missing: '83000000-0000-4000-8000-000000000016.pdf',
    unavailable: '83000000-0000-4000-8000-000000000017.pdf',
    hidden: '83000000-0000-4000-8000-000000000018.pdf',
  },
  materialIds: {
    ready: '83000000-0000-4000-8000-000000000020',
    warning: '83000000-0000-4000-8000-000000000021',
    processing: '83000000-0000-4000-8000-000000000022',
    failed: '83000000-0000-4000-8000-000000000023',
    deleted: '83000000-0000-4000-8000-000000000024',
    incomplete: '83000000-0000-4000-8000-000000000025',
    missing: '83000000-0000-4000-8000-000000000026',
    unavailable: '83000000-0000-4000-8000-000000000027',
    hidden: '83000000-0000-4000-8000-000000000028',
  },
  chunkIds: {
    pythonRelevant: '83000000-0000-4000-8000-000000000030',
    pythonIdentical: '83000000-0000-4000-8000-000000000031',
    warningUsable: '83000000-0000-4000-8000-000000000032',
    topKOverflow: '83000000-0000-4000-8000-000000000033',
    exactThreshold: '83000000-0000-4000-8000-000000000034',
    belowThreshold: '83000000-0000-4000-8000-000000000035',
    processing: '83000000-0000-4000-8000-000000000036',
    failed: '83000000-0000-4000-8000-000000000037',
    deleted: '83000000-0000-4000-8000-000000000038',
    incomplete: '83000000-0000-4000-8000-000000000039',
    missing: '83000000-0000-4000-8000-000000000040',
    unavailable: '83000000-0000-4000-8000-000000000041',
    hiddenStronger: '83000000-0000-4000-8000-000000000042',
    hiddenIdentical: '83000000-0000-4000-8000-000000000043',
  },
} as const

interface FixtureMaterial {
  id: string
  courseId: string
  title: string
  storagePath: string
  status: MaterialStatus
  hasCompletionMetadata: boolean
  deleted: boolean
}

interface FixtureChunk {
  id: string
  materialId: string
  chunkIndex: number
  content: string
  embedding: readonly number[]
}

export async function seedRetrievalTask83Fixture(
  prisma: PrismaService,
): Promise<void> {
  const fixture = RETRIEVAL_TASK_83

  await prisma.user.create({
    data: {
      id: fixture.ownerId,
      email: 'task-83-instructor@morshid.test',
      displayName: 'Task 83 synthetic instructor',
      role: 'INSTRUCTOR',
      passwordHash: 'synthetic-test-password-hash',
    },
  })
  await prisma.course.createMany({
    data: [
      {
        id: fixture.pythonCourseId,
        code: fixture.courseCodes.python,
        title: 'Synthetic Python course for Task 83',
        createdById: fixture.ownerId,
      },
      {
        id: fixture.hiddenCourseId,
        code: fixture.courseCodes.hidden,
        title: 'Synthetic hidden isolation course for Task 83',
        createdById: fixture.ownerId,
      },
    ],
  })

  const materials = buildMaterials()
  for (const material of materials) {
    await prisma.material.create({
      data: {
        id: material.id,
        courseId: material.courseId,
        uploadedById: fixture.ownerId,
        title: material.title,
        originalFilename: `${material.id}.pdf`,
        storagePath: material.storagePath,
        status: material.status,
        extractedTextLength: material.hasCompletionMetadata ? 1_000 : null,
        chunkCount: material.hasCompletionMetadata
          ? chunkCount(material.id)
          : null,
        deletedAt: material.deleted ? new Date('2026-07-19T00:00:00Z') : null,
      },
    })
  }

  for (const chunk of buildChunks()) {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO material_chunks (
        id,
        material_id,
        chunk_index,
        content,
        embedding,
        embedding_model
      )
      VALUES (
        ${chunk.id}::uuid,
        ${chunk.materialId}::uuid,
        ${chunk.chunkIndex},
        ${chunk.content},
        ${serializeEmbedding(chunk.embedding)}::vector(1536),
        ${EMBEDDING_MODEL}
      )
    `)
  }
}

export function retrievalTask83QueryEmbedding(): number[] {
  const embedding = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
  embedding[0] = 1
  return embedding
}

function buildMaterials(): FixtureMaterial[] {
  const fixture = RETRIEVAL_TASK_83
  const pythonCourseId = fixture.pythonCourseId

  return [
    material('ready', pythonCourseId, 'READY', true),
    material('warning', pythonCourseId, 'WARNING', true),
    // These unavailable statuses deliberately look complete otherwise. Their
    // high-scoring chunks can only be excluded by the production status
    // predicate, making the fixture sensitive to that predicate in isolation.
    material('processing', pythonCourseId, 'PROCESSING', true),
    material('failed', pythonCourseId, 'FAILED', true),
    material('deleted', pythonCourseId, 'READY', true, true),
    material('incomplete', pythonCourseId, 'READY', false),
    material('missing', pythonCourseId, 'READY', true),
    material('unavailable', pythonCourseId, 'WARNING', true),
    material('hidden', fixture.hiddenCourseId, 'READY', true),
  ]
}

function material(
  key: keyof typeof RETRIEVAL_TASK_83.materialIds,
  courseId: string,
  status: MaterialStatus,
  hasCompletionMetadata: boolean,
  deleted = false,
): FixtureMaterial {
  const fixture = RETRIEVAL_TASK_83
  return {
    id: fixture.materialIds[key],
    courseId,
    title: `Task 83 ${key} material`,
    storagePath: fixture.storagePaths[key],
    status,
    hasCompletionMetadata,
    deleted,
  }
}

function buildChunks(): FixtureChunk[] {
  const fixture = RETRIEVAL_TASK_83
  const ids = fixture.chunkIds
  const materials = fixture.materialIds

  return [
    chunk(
      ids.pythonRelevant,
      materials.ready,
      0,
      `${fixture.sentinels.python} relevant Python evidence`,
      similarityVector(0.95),
    ),
    chunk(
      ids.pythonIdentical,
      materials.ready,
      1,
      fixture.sentinels.identical,
      similarityVector(0.9),
    ),
    chunk(
      ids.warningUsable,
      materials.warning,
      0,
      'Usable warned Python evidence for Task 83',
      similarityVector(0.85),
    ),
    chunk(
      ids.topKOverflow,
      materials.ready,
      2,
      'Relevant Python evidence outside the configured top-k',
      similarityVector(0.82),
    ),
    chunk(
      ids.exactThreshold,
      materials.ready,
      3,
      'Python evidence exactly at the configured boundary',
      exactFourFifthsVector(),
    ),
    chunk(
      ids.belowThreshold,
      materials.ready,
      4,
      'Python evidence immediately below the configured boundary',
      similarityVector(0.79),
    ),
    chunk(
      ids.processing,
      materials.processing,
      0,
      'Processing material must remain unavailable',
      similarityVector(0.999),
    ),
    chunk(
      ids.failed,
      materials.failed,
      0,
      'Failed material must remain unavailable',
      similarityVector(0.998),
    ),
    chunk(
      ids.deleted,
      materials.deleted,
      0,
      'Deleted material must remain unavailable',
      similarityVector(0.997),
    ),
    chunk(
      ids.incomplete,
      materials.incomplete,
      0,
      'Incomplete material must remain unavailable',
      similarityVector(0.996),
    ),
    chunk(
      ids.missing,
      materials.missing,
      0,
      'Missing-file material must remain unavailable',
      similarityVector(0.72),
    ),
    chunk(
      ids.unavailable,
      materials.unavailable,
      0,
      'Unavailable-storage material must remain unavailable',
      similarityVector(0.71),
    ),
    chunk(
      ids.hiddenStronger,
      materials.hidden,
      0,
      `${fixture.sentinels.hidden} deliberately stronger hidden evidence`,
      similarityVector(0.9999),
    ),
    chunk(
      ids.hiddenIdentical,
      materials.hidden,
      1,
      fixture.sentinels.identical,
      similarityVector(0.9998),
    ),
  ]
}

function chunk(
  id: string,
  materialId: string,
  chunkIndex: number,
  content: string,
  embedding: readonly number[],
): FixtureChunk {
  return { id, materialId, chunkIndex, content, embedding }
}

function chunkCount(materialId: string): number {
  return buildChunks().filter((chunk) => chunk.materialId === materialId).length
}

function similarityVector(similarity: number): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
  vector[0] = similarity
  vector[1] = Math.sqrt(1 - similarity * similarity)
  return vector
}

// [4, 3] is an exact 3-4-5 triangle in pgvector float4 storage, so its cosine
// similarity to [1, 0] is exactly the configured 0.8 threshold.
function exactFourFifthsVector(): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
  vector[0] = 4
  vector[1] = 3
  return vector
}

function serializeEmbedding(embedding: readonly number[]): string {
  return `[${embedding.join(',')}]`
}
