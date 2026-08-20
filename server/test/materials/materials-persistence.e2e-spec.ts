import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import type { IdentitySessionResponse } from '../../src/modules/identity/identity.types'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../../src/modules/audit/audit.public'
import {
  DurableMaterialProcessingScheduler,
  MaterialProcessingScheduler,
} from '../../src/modules/materials/processing/material-processing.scheduler'
import { MATERIALS_ERROR_CODES } from '../../src/modules/materials/catalog/materials.errors'
import { MaterialsRepository } from '../../src/modules/materials/catalog/materials.repository'
import { CourseEvidenceRepository } from '../../src/modules/materials/evidence/course-evidence.repository'
import { MaterialChunkRepository } from '../../src/modules/materials/processing/material-chunk.repository'
import { MaterialProcessingService } from '../../src/modules/materials/processing/material-processing.service'
import { LocalPdfStorageAdapter } from '../../src/platform/document-storage/local-pdf-storage.adapter'
import { PDF_STORAGE } from '../../src/platform/document-storage/pdf-storage'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { EMBEDDING_PROVIDER_TOKEN } from '../../src/platform/ai/embedding/embedding-provider'
import { RedisService } from '../../src/platform/cache/redis.service'
import {
  P0_DEMO_PASSWORD,
  seedP0DemoData,
  type P0DemoSeedResult,
} from '../../src/seeds/p0-demo.seed'
import { cleanTextPdf } from '../fixtures/pdf-fixtures'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

const validPdf = cleanTextPdf('Real persistence upload')

describe('Materials persistence and local storage (e2e)', () => {
  let app: INestApplication<App>
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let storageRoot = ''
  let seed: P0DemoSeedResult
  let previousStoragePath: string | undefined
  let storage: LocalPdfStorageAdapter
  let materialsRepository: MaterialsRepository
  let materialChunkRepository: MaterialChunkRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue77')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    storageRoot = await mkdtemp(join(tmpdir(), 'morshid-material-upload-'))
    previousStoragePath = process.env.PDF_STORAGE_PATH
    process.env.PDF_STORAGE_PATH = storageRoot

    storage = new LocalPdfStorageAdapter(storageRoot)
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn().mockResolvedValue('PONG') })
      .overrideProvider(PDF_STORAGE)
      .useValue(storage)
      .overrideProvider(EMBEDDING_PROVIDER_TOKEN)
      .useValue({
        model: 'materials-e2e-test-embedding',
        queryProtocol: 'materials-e2e-test-embedding',
        embedQuery: () =>
          Promise.resolve(Array.from({ length: 1536 }, () => 0.1)),
        embedDocuments: (docs: readonly string[]) =>
          Promise.resolve(
            docs.map(() => Array.from({ length: 1536 }, () => 0.1)),
          ),
      })
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
    materialsRepository = app.get(MaterialsRepository)
    materialChunkRepository = app.get(MaterialChunkRepository)
  })

  afterAll(async () => {
    await app.close()
    await database?.dispose()

    if (storageRoot.length > 0) {
      await rm(storageRoot, { recursive: true, force: true })
    }

    if (previousStoragePath === undefined) {
      delete process.env.PDF_STORAGE_PATH
    } else {
      process.env.PDF_STORAGE_PATH = previousStoragePath
    }
  })

  async function signInAs(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    return (response.body as IdentitySessionResponse).accessToken
  }

  function uploadPdf(input: {
    token: string
    courseId?: string
    title: string
    filename?: string
  }) {
    return request(app.getHttpServer())
      .post(
        `/api/v1/courses/${input.courseId ?? seed.courses.pythonProgramming.id}/materials`,
      )
      .set('Authorization', `Bearer ${input.token}`)
      .field('title', input.title)
      .attach('file', validPdf, {
        filename: input.filename ?? 'python.pdf',
        contentType: 'application/pdf',
      })
  }

  it('persists a contained upload and processes it in the running app', async () => {
    const token = await signInAs('instructor@morshid.demo')

    const response = await uploadPdf({
      token,
      title: 'Real isolated upload',
      filename: '../../private/python.pdf',
    }).expect(201)
    const materialId = (response.body as { material: { id: string } }).material
      .id
    const material = await prisma.material.findUniqueOrThrow({
      where: { id: materialId },
    })

    expect(material).toMatchObject({
      courseId: seed.courses.pythonProgramming.id,
      title: 'Real isolated upload',
      originalFilename: 'python.pdf',
    })
    expect(response.body).toMatchObject({ material: { status: 'PROCESSING' } })
    expect(material.storagePath).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i,
    )
    await expect(
      readFile(join(storageRoot, material.storagePath)),
    ).resolves.toEqual(validPdf)
    await waitForMaterialStatus(materialId, 'READY')
    await expect(
      prisma.materialProcessingCommand.findUnique({ where: { materialId } }),
    ).resolves.toBeNull()

    const scheduler = app.get(MaterialProcessingScheduler)
    await scheduler.scheduleMaterialProcessing(materialId)
    await waitForCommandCount(materialId, 0)
  }, 30_000)

  it('rejects an unknown course without creating a row or file', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const filesBefore = await readdir(storageRoot)
    const materialsBefore = await prisma.material.count()

    await uploadPdf({
      token,
      courseId: '00000000-0000-4000-8000-000000000999',
      title: 'Unknown course upload',
    })
      .expect(404)
      .expect({
        code: MATERIALS_ERROR_CODES.COURSE_NOT_FOUND,
        message: 'Course was not found',
      })

    await expect(prisma.material.count()).resolves.toBe(materialsBefore)
    await expect(readdir(storageRoot)).resolves.toEqual(filesBefore)
  })

  it('removes the real row and file when durable scheduling fails', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const filesBefore = await readdir(storageRoot)
    const scheduler = app.get(MaterialProcessingScheduler)
    jest
      .spyOn(scheduler, 'scheduleMaterialProcessing')
      .mockRejectedValueOnce(new Error('simulated durable scheduling failure'))

    await uploadPdf({ token, title: 'Compensated real upload' }).expect(500)

    await expect(
      prisma.material.findFirst({
        where: { title: 'Compensated real upload' },
      }),
    ).resolves.toBeNull()
    await expect(readdir(storageRoot)).resolves.toEqual(filesBefore)
  })

  it('drains an unclaimed durable command after scheduler restart', async () => {
    const runningScheduler: DurableMaterialProcessingScheduler = app.get(
      MaterialProcessingScheduler,
    )
    await runningScheduler.onModuleDestroy()
    const uploader = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@morshid.demo' },
    })
    const storagePath = await storage.create(validPdf)
    const material = await prisma.material.create({
      data: {
        courseId: seed.courses.pythonProgramming.id,
        uploadedById: uploader.id,
        title: 'Restart recovery upload',
        originalFilename: 'restart.pdf',
        storagePath,
        status: 'PROCESSING',
      },
    })
    await prisma.materialProcessingCommand.create({
      data: { materialId: material.id },
    })
    const restartedScheduler = new DurableMaterialProcessingScheduler(
      prisma,
      app.get(MaterialProcessingService),
    )

    restartedScheduler.onModuleInit()
    try {
      await waitForMaterialStatus(material.id, 'READY')
      await expect(
        prisma.materialProcessingCommand.findUnique({
          where: { materialId: material.id },
        }),
      ).resolves.toBeNull()
    } finally {
      await restartedScheduler.onModuleDestroy()
    }
  }, 30_000)

  it('quarantines and physically cleans a material while preserving historical provenance', async () => {
    const instructorToken = await signInAs('instructor@morshid.demo')
    const uploader = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@morshid.demo' },
    })
    const student = await prisma.user.findUniqueOrThrow({
      where: { email: 'student1@morshid.demo' },
    })
    const storagePath = await storage.create(validPdf)
    const material = await prisma.material.create({
      data: {
        courseId: seed.courses.pythonProgramming.id,
        uploadedById: uploader.id,
        title: 'Material to delete',
        originalFilename: 'delete-me.pdf',
        storagePath,
        status: 'READY',
        extractedTextLength: 24,
        chunkCount: 1,
      },
    })
    await prisma.materialProcessingCommand.create({
      data: { materialId: material.id },
    })
    const vector = `[${new Array<number>(1_536).fill(0.1).join(',')}]`
    const [chunk] = await prisma.$queryRaw<readonly { id: string }[]>`
      INSERT INTO material_chunks (
        material_id, chunk_index, content, embedding, embedding_model
      ) VALUES (
        ${material.id}::uuid, 0, 'historical source text',
        ${vector}::vector(1536), 'materials-e2e-test-embedding'
      )
      RETURNING id
    `
    const session = await prisma.chatSession.create({
      data: {
        courseId: seed.courses.pythonProgramming.id,
        studentId: student.id,
        title: 'Preserved history',
      },
    })
    const message = await prisma.message.create({
      data: {
        sessionId: session.id,
        sequence: 1,
        role: 'ASSISTANT',
        content: 'Historical answer',
        status: 'COMPLETED',
      },
    })
    const retrieval = await prisma.messageRetrieval.create({
      data: { messageId: message.id, chunkId: chunk.id, rank: 1 },
    })
    const citation = await prisma.messageCitation.create({
      data: {
        messageId: message.id,
        materialId: material.id,
        citationOrder: 1,
      },
    })
    const activeStoragePath = await storage.create(validPdf)
    const activeMaterial = await prisma.material.create({
      data: {
        courseId: seed.courses.pythonProgramming.id,
        uploadedById: uploader.id,
        title: 'Active sibling material',
        originalFilename: 'active.pdf',
        storagePath: activeStoragePath,
        status: 'READY',
        extractedTextLength: 22,
        chunkCount: 1,
      },
    })
    await prisma.$executeRaw`
      INSERT INTO material_chunks (
        material_id, chunk_index, content, embedding, embedding_model
      ) VALUES (
        ${activeMaterial.id}::uuid, 0, 'active sibling source text',
        ${vector}::vector(1536), 'materials-e2e-test-embedding'
      )
    `

    await request(app.getHttpServer())
      .delete(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${material.id}`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(204)

    await expect(storage.exists(storagePath)).resolves.toBe(false)
    const deletedMaterial = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
    })
    expect(deletedMaterial.deletedAt).toBeInstanceOf(Date)
    expect(deletedMaterial.processingAttemptId).toBeNull()
    await expect(
      prisma.materialProcessingCommand.count({
        where: { materialId: material.id },
      }),
    ).resolves.toBe(0)
    await expect(
      prisma.materialChunk.count({ where: { materialId: material.id } }),
    ).resolves.toBe(0)
    await expect(
      prisma.messageRetrieval.findUniqueOrThrow({
        where: { id: retrieval.id },
      }),
    ).resolves.toMatchObject({ chunkId: null })
    await expect(
      prisma.messageCitation.findUnique({ where: { id: citation.id } }),
    ).resolves.not.toBeNull()
    await expect(
      prisma.message.findUnique({ where: { id: message.id } }),
    ).resolves.toMatchObject({ content: 'Historical answer' })
    await expect(
      prisma.chatSession.findUnique({ where: { id: session.id } }),
    ).resolves.not.toBeNull()
    await expect(
      prisma.auditLog.findFirst({
        where: { action: 'material.deleted', targetId: material.id },
      }),
    ).resolves.toMatchObject({
      actorUserId: uploader.id,
      courseId: seed.courses.pythonProgramming.id,
    })
    const retrieved = await app
      .get(CourseEvidenceRepository)
      .findTopChunksForCourse({
        courseId: seed.courses.pythonProgramming.id,
        queryEmbedding: new Array<number>(1_536).fill(0.1),
        embeddingModel: 'materials-e2e-test-embedding',
        topK: 50,
        minSimilarity: 0,
        offset: 0,
      })
    expect(retrieved.map(({ materialId }) => materialId)).toContain(
      activeMaterial.id,
    )
    expect(retrieved.map(({ materialId }) => materialId)).not.toContain(
      material.id,
    )

    await request(app.getHttpServer())
      .get(`/api/v1/courses/${seed.courses.pythonProgramming.id}/materials`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(JSON.stringify(body)).not.toContain(material.id)
      })
    await request(app.getHttpServer())
      .get(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${material.id}`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(404)
    await request(app.getHttpServer())
      .get(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${material.id}/status`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(404)

    const studentToken = await signInAs('student1@morshid.demo')
    await request(app.getHttpServer())
      .get(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/chat-sessions/${session.id}/messages`,
      )
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { messages: unknown[] }
        expect(body.messages).toEqual([
          expect.objectContaining({
            id: message.id,
            content: 'Historical answer',
            citations: [
              expect.objectContaining({
                materialId: material.id,
                sourceAvailable: false,
                sourceStatus: 'DELETED',
                evidence: [],
              }),
            ],
          }),
        ])
      })

    // Repeated DELETE is idempotent and retries the already-missing PDF.
    await request(app.getHttpServer())
      .delete(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${material.id}`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(204)
  }, 30_000)

  it('keeps a material quarantined when PDF cleanup fails and retries idempotently', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const uploader = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@morshid.demo' },
    })
    const storagePath = await storage.create(validPdf)
    const material = await prisma.material.create({
      data: {
        courseId: seed.courses.pythonProgramming.id,
        uploadedById: uploader.id,
        title: 'Retry PDF cleanup',
        originalFilename: 'retry.pdf',
        storagePath,
        status: 'READY',
        extractedTextLength: 10,
        chunkCount: 0,
      },
    })
    const deleteSpy = jest
      .spyOn(storage, 'delete')
      .mockRejectedValueOnce(new Error('simulated storage failure'))

    await request(app.getHttpServer())
      .delete(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${material.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(503)
      .expect({
        code: MATERIALS_ERROR_CODES.STORAGE_CLEANUP_FAILED,
        message:
          'The material is unavailable, but its stored PDF could not be removed. Retry deletion.',
      })

    const quarantinedMaterial = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
    })
    expect(quarantinedMaterial.deletedAt).toBeInstanceOf(Date)
    await expect(storage.exists(storagePath)).resolves.toBe(true)

    deleteSpy.mockRestore()
    await request(app.getHttpServer())
      .delete(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${material.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(204)
    await expect(storage.exists(storagePath)).resolves.toBe(false)
    await expect(
      prisma.auditLog.count({
        where: { action: 'material.deleted', targetId: material.id },
      }),
    ).resolves.toBe(1)
  })

  it('serializes concurrent delete requests without duplicate audit events', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const uploader = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@morshid.demo' },
    })
    const storagePath = await storage.create(validPdf)
    const material = await prisma.material.create({
      data: {
        courseId: seed.courses.pythonProgramming.id,
        uploadedById: uploader.id,
        title: 'Concurrent deletion',
        originalFilename: 'concurrent.pdf',
        storagePath,
        status: 'READY',
        extractedTextLength: 1,
        chunkCount: 0,
      },
    })
    const path = `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${material.id}`

    await Promise.all([
      request(app.getHttpServer())
        .delete(path)
        .set('Authorization', `Bearer ${token}`)
        .expect(204),
      request(app.getHttpServer())
        .delete(path)
        .set('Authorization', `Bearer ${token}`)
        .expect(204),
    ])

    await expect(storage.exists(storagePath)).resolves.toBe(false)
    await expect(
      prisma.auditLog.count({
        where: { action: 'material.deleted', targetId: material.id },
      }),
    ).resolves.toBe(1)
  })

  it('orders DELETE before a queued processing claim without deadlock or recreation', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const uploader = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@morshid.demo' },
    })
    const storagePath = await storage.create(validPdf)
    const material = await prisma.material.create({
      data: {
        courseId: seed.courses.pythonProgramming.id,
        uploadedById: uploader.id,
        title: 'Claim race',
        originalFilename: 'claim-race.pdf',
        storagePath,
        status: 'PROCESSING',
      },
    })
    await prisma.materialProcessingCommand.create({
      data: { materialId: material.id },
    })
    const blocker = blockMaterialRow(prisma, material.id)
    await blocker.locked
    const deletion = Promise.resolve(
      request(app.getHttpServer())
        .delete(
          `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${material.id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(204),
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
    const claim = materialsRepository.claimMaterialProcessing(
      material.id,
      '00000000-0000-4000-8000-000000000801',
    )
    blocker.release()

    await expect(
      Promise.all([deletion, claim, blocker.done]),
    ).resolves.toBeDefined()
    await expectDeletedWithoutDerivedRows(prisma, material.id)
  })

  it('orders DELETE before queued processing finalization without deadlock or recreation', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const uploader = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@morshid.demo' },
    })
    const processingAttemptId = '00000000-0000-4000-8000-000000000802'
    const storagePath = await storage.create(validPdf)
    const material = await prisma.material.create({
      data: {
        courseId: seed.courses.pythonProgramming.id,
        uploadedById: uploader.id,
        title: 'Finalization race',
        originalFilename: 'finalization-race.pdf',
        storagePath,
        status: 'PROCESSING',
        processingAttemptId,
      },
    })
    await prisma.materialProcessingCommand.create({
      data: {
        materialId: material.id,
        processingAttemptId,
        leaseExpiresAt: new Date(Date.now() + 60_000),
      },
    })
    const blocker = blockMaterialRow(prisma, material.id)
    await blocker.locked
    const deletion = Promise.resolve(
      request(app.getHttpServer())
        .delete(
          `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${material.id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(204),
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
    const finalization = materialsRepository.completeMaterialProcessing(
      material.id,
      processingAttemptId,
      [
        {
          chunkIndex: 0,
          content: 'Must not survive deletion',
          embedding: new Array<number>(1_536).fill(0.1),
          embeddingModel: 'materials-e2e-test-embedding',
        },
      ],
      {
        status: 'READY',
        extractedTextLength: 25,
        chunkCount: 1,
        errorMessage: null,
        auditEvent: {
          actorUserId: uploader.id,
          action: AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_READY,
          target: { type: AUDIT_TARGET_TYPES.MATERIAL, id: material.id },
          courseId: material.courseId,
          metadata: { materialId: material.id, status: 'READY' },
        },
      },
    )
    blocker.release()

    const [, finalized] = await Promise.all([
      deletion,
      finalization,
      blocker.done,
    ])
    expect(finalized).toBe(false)
    await expectDeletedWithoutDerivedRows(prisma, material.id)
  })

  it('orders DELETE before queued embedding replacement without deadlock or recreation', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const uploader = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@morshid.demo' },
    })
    const storagePath = await storage.create(validPdf)
    const material = await prisma.material.create({
      data: {
        courseId: seed.courses.pythonProgramming.id,
        uploadedById: uploader.id,
        title: 'Embedding race',
        originalFilename: 'embedding-race.pdf',
        storagePath,
        status: 'READY',
        extractedTextLength: 25,
        chunkCount: 1,
      },
    })
    const blocker = blockMaterialRow(prisma, material.id)
    await blocker.locked
    const deletion = Promise.resolve(
      request(app.getHttpServer())
        .delete(
          `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${material.id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(204),
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
    const replacement = materialChunkRepository.replaceMaterialChunks(
      material.id,
      [
        {
          chunkIndex: 0,
          content: 'Must not survive deletion',
          embedding: new Array<number>(1_536).fill(0.1),
          embeddingModel: 'materials-e2e-test-embedding',
        },
      ],
    )
    blocker.release()

    await expect(
      Promise.all([deletion, replacement, blocker.done]),
    ).resolves.toBeDefined()
    await expectDeletedWithoutDerivedRows(prisma, material.id)
  })

  it('enforces delete role, membership, course-boundary, not-found, and UUID contracts', async () => {
    const [studentToken, instructorToken, adminToken] = await Promise.all([
      signInAs('student1@morshid.demo'),
      signInAs('instructor@morshid.demo'),
      signInAs('admin@morshid.demo'),
    ])
    const uploader = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@morshid.demo' },
    })
    const createMaterial = (courseId: string, title: string) =>
      prisma.material.create({
        data: {
          courseId,
          uploadedById: uploader.id,
          title,
          originalFilename: `${title}.pdf`,
          storagePath: '00000000-0000-4000-8000-000000000999.pdf',
          status: 'READY',
          extractedTextLength: 1,
          chunkCount: 0,
        },
      })
    const protectedMaterial = await createMaterial(
      seed.courses.pythonProgramming.id,
      'Student cannot delete',
    )
    await request(app.getHttpServer())
      .delete(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${protectedMaterial.id}`,
      )
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403)
    await request(app.getHttpServer())
      .delete(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${protectedMaterial.id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403)

    const hiddenMaterial = await createMaterial(
      seed.courses.hiddenIsolation.id,
      'Unassigned instructor cannot delete',
    )
    await request(app.getHttpServer())
      .delete(
        `/api/v1/courses/${seed.courses.hiddenIsolation.id}/materials/${hiddenMaterial.id}`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(403)
    await request(app.getHttpServer())
      .delete(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${hiddenMaterial.id}`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(404)

    const membership = await prisma.courseMembership.findUniqueOrThrow({
      where: {
        courseId_userId: {
          courseId: seed.courses.pythonProgramming.id,
          userId: uploader.id,
        },
      },
    })
    await prisma.courseMembership.update({
      where: { id: membership.id },
      data: { removedAt: new Date() },
    })
    try {
      await request(app.getHttpServer())
        .delete(
          `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/${protectedMaterial.id}`,
        )
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(403)
    } finally {
      await prisma.courseMembership.update({
        where: { id: membership.id },
        data: { removedAt: membership.removedAt },
      })
    }

    await request(app.getHttpServer())
      .delete(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/00000000-0000-4000-8000-000000000998`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(404)
    await request(app.getHttpServer())
      .delete(
        `/api/v1/courses/${seed.courses.pythonProgramming.id}/materials/not-a-uuid`,
      )
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(400)
  })

  async function waitForMaterialStatus(
    materialId: string,
    status: 'READY',
  ): Promise<void> {
    await waitFor(async () => {
      const material = await prisma.material.findUnique({
        where: { id: materialId },
        select: { status: true, errorMessage: true },
      })
      if (material?.status === 'FAILED') {
        throw new Error(
          `Material processing failed: ${material.errorMessage ?? 'unknown error'}`,
        )
      }
      return material?.status === status
    })
  }

  async function waitForCommandCount(
    materialId: string,
    count: number,
  ): Promise<void> {
    await waitFor(async () => {
      const actual = await prisma.materialProcessingCommand.count({
        where: { materialId },
      })
      return actual === count
    })
  }
})

async function waitFor(predicate: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 30_000
  while (!(await predicate())) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for material processing')
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
  }
}

function blockMaterialRow(prisma: PrismaService, materialId: string) {
  let announceLocked: () => void = () => undefined
  let releaseLock: () => void = () => undefined
  const locked = new Promise<void>((resolve) => {
    announceLocked = resolve
  })
  const released = new Promise<void>((resolve) => {
    releaseLock = resolve
  })
  const done = prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id
      FROM materials
      WHERE id = ${materialId}::uuid
      FOR NO KEY UPDATE
    `
    announceLocked()
    await released
  })

  return { locked, release: releaseLock, done }
}

async function expectDeletedWithoutDerivedRows(
  prisma: PrismaService,
  materialId: string,
): Promise<void> {
  const [material, commandCount, chunkCount] = await Promise.all([
    prisma.material.findUniqueOrThrow({ where: { id: materialId } }),
    prisma.materialProcessingCommand.count({ where: { materialId } }),
    prisma.materialChunk.count({ where: { materialId } }),
  ])
  expect(material.deletedAt).toBeInstanceOf(Date)
  expect(material.processingAttemptId).toBeNull()
  expect(commandCount).toBe(0)
  expect(chunkCount).toBe(0)
}
