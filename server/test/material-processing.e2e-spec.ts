import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { AUDIT_EVENT_ACTIONS } from '../src/modules/audit/audit.constants'
import {
  AuditService,
  type AuditDatabase,
  type RecordAuditEventInput,
} from '../src/modules/audit/audit.service'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import { DeterministicEmbeddingProvider } from '../src/modules/embedding/deterministic-embedding.provider'
import {
  EMBEDDING_PROVIDER_TOKEN,
  type EmbeddingProvider,
} from '../src/modules/embedding/embedding-provider'
import { ValidatedEmbeddingProvider } from '../src/modules/embedding/validated-embedding.provider'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import {
  MATERIAL_PROCESSING_FAILURES,
  MATERIAL_PROCESSING_SAFE_MESSAGES,
  MATERIAL_PROCESSING_WARNING_MESSAGES,
  MaterialProcessingService,
  type MaterialProcessingFailure,
} from '../src/modules/materials/material-processing.service'
import { MaterialsRepository } from '../src/modules/materials/materials.repository'
import {
  PDF_TEXT_EXTRACTOR,
  PdfJsDocumentLoader,
  PdfJsTextExtractor,
  type PdfTextExtractionResult,
  type PdfTextExtractor,
} from '../src/modules/materials/pdf-text-extractor'
import { LocalPdfStorageAdapter } from '../src/modules/pdf-storage/local-pdf-storage.adapter'
import {
  PDF_STORAGE,
  type PdfStorage,
} from '../src/modules/pdf-storage/pdf-storage'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { MaterialChunkEmbeddingService } from '../src/modules/rag-persistence/material-chunk-embedding.service'
import { RagPersistenceRepository } from '../src/modules/rag-persistence/rag-persistence.repository'
import { RedisService } from '../src/modules/redis/redis.service'
import { RetrievalService } from '../src/modules/retrieval/retrieval.service'
import { P0_DEMO_PASSWORD, seedP0DemoData } from '../src/seeds/p0-demo.seed'
import {
  TASK_80_SENTINEL,
  cleanTextPdf,
  corruptPdfWithPdfFilename,
  emptyPdf,
  imageOnlyPdf,
  partiallyEmptyTextPdf,
} from './fixtures/pdf-fixtures'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

const SECRET_SENTINEL = 'sk-test-secret-must-never-leak'
const FAILURE_SENTINEL = `provider/parser/storage saw ${TASK_80_SENTINEL} ${SECRET_SENTINEL}`

const TERMINAL_PROCESSING_ACTIONS = new Set<string>([
  AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_READY,
  AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_WARNING,
  AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_FAILED,
])

class FaultInjectingAuditService extends AuditService {
  private remainingTerminalFailures = 0

  failNextTerminalEvents(count: number): void {
    this.remainingTerminalFailures = count
  }

  reset(): void {
    this.remainingTerminalFailures = 0
  }

  override recordEvent(input: RecordAuditEventInput, database?: AuditDatabase) {
    if (
      TERMINAL_PROCESSING_ACTIONS.has(input.action) &&
      this.remainingTerminalFailures > 0
    ) {
      this.remainingTerminalFailures -= 1
      return Promise.reject(new Error(`audit failed ${FAILURE_SENTINEL}`))
    }

    return super.recordEvent(input, database)
  }
}

class CapturingProcessingScheduler extends MaterialProcessingScheduler {
  readonly scheduledMaterialIds: string[] = []

  scheduleMaterialProcessing(materialId: string): Promise<void> {
    this.scheduledMaterialIds.push(materialId)
    return Promise.resolve()
  }

  reset(): void {
    this.scheduledMaterialIds.length = 0
  }
}

class IsolatedFaultInjectingStorage implements PdfStorage {
  private readonly paths = new Set<string>()
  private nextReadFailure: Error | undefined

  constructor(private readonly delegate: LocalPdfStorageAdapter) {}

  async create(contents: Buffer): Promise<string> {
    const storagePath = await this.delegate.create(contents)
    this.paths.add(storagePath)
    return storagePath
  }

  read(storagePath: string): Promise<Buffer> {
    if (this.nextReadFailure !== undefined) {
      const failure = this.nextReadFailure
      this.nextReadFailure = undefined
      return Promise.reject(failure)
    }
    return this.delegate.read(storagePath)
  }

  exists(storagePath: string): Promise<boolean> {
    return this.delegate.exists(storagePath)
  }

  async delete(storagePath: string): Promise<void> {
    await this.delegate.delete(storagePath)
    this.paths.delete(storagePath)
  }

  failNextRead(error: Error): void {
    this.nextReadFailure = error
  }

  async clear(): Promise<void> {
    await Promise.all([...this.paths].map((path) => this.delegate.delete(path)))
    this.paths.clear()
    this.nextReadFailure = undefined
  }
}

class FaultInjectingExtractor implements PdfTextExtractor {
  private nextFailure: Error | undefined

  constructor(private readonly delegate: PdfTextExtractor) {}

  extract(contents: Buffer): Promise<PdfTextExtractionResult> {
    if (this.nextFailure !== undefined) {
      const failure = this.nextFailure
      this.nextFailure = undefined
      return Promise.reject(failure)
    }
    return this.delegate.extract(contents)
  }

  failNext(error: Error): void {
    this.nextFailure = error
  }

  reset(): void {
    this.nextFailure = undefined
  }
}

class FaultInjectingEmbeddingProvider implements EmbeddingProvider {
  readonly model: string
  callCount = 0
  private nextFailure: Error | undefined

  constructor(private readonly delegate: EmbeddingProvider) {
    this.model = delegate.model
  }

  embedBatch(
    texts: readonly string[],
  ): Promise<readonly (readonly number[])[]> {
    this.callCount += 1
    if (this.nextFailure !== undefined) {
      const failure = this.nextFailure
      this.nextFailure = undefined
      return Promise.reject(failure)
    }
    return this.delegate.embedBatch(texts)
  }

  failNext(error: Error): void {
    this.nextFailure = error
  }

  reset(): void {
    this.callCount = 0
    this.nextFailure = undefined
  }
}

describe('Material processing truthfulness (e2e)', () => {
  let database: DisposableDatabase | undefined
  let storageRoot: string | undefined
  let prisma: PrismaService
  let app: INestApplication<App>
  let processingService: MaterialProcessingService
  let materialsRepository: MaterialsRepository
  let retrievalService: RetrievalService
  let chunkEmbeddingService: MaterialChunkEmbeddingService
  let persistence: RagPersistenceRepository
  let storage: IsolatedFaultInjectingStorage
  let extractor: FaultInjectingExtractor
  let provider: FaultInjectingEmbeddingProvider
  let auditService: FaultInjectingAuditService
  let scheduler: CapturingProcessingScheduler
  let accessToken: string
  let courseId: string

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue80')
    prisma = database.prisma
    const seed = await seedP0DemoData(prisma)
    courseId = seed.courses.pythonProgramming.id

    storageRoot = await mkdtemp(join(tmpdir(), 'morshid-issue80-'))
    storage = new IsolatedFaultInjectingStorage(
      new LocalPdfStorageAdapter(storageRoot),
    )
    extractor = new FaultInjectingExtractor(
      new PdfJsTextExtractor(new PdfJsDocumentLoader()),
    )
    provider = new FaultInjectingEmbeddingProvider(
      new ValidatedEmbeddingProvider(new DeterministicEmbeddingProvider()),
    )
    scheduler = new CapturingProcessingScheduler()
    auditService = new FaultInjectingAuditService(prisma)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ ping: () => Promise.resolve('PONG') })
      .overrideProvider(AuditService)
      .useValue(auditService)
      .overrideProvider(PDF_STORAGE)
      .useValue(storage)
      .overrideProvider(PDF_TEXT_EXTRACTOR)
      .useValue(extractor)
      .overrideProvider(EMBEDDING_PROVIDER_TOKEN)
      .useValue(provider)
      .overrideProvider(MaterialProcessingScheduler)
      .useValue(scheduler)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()

    processingService = moduleFixture.get(MaterialProcessingService)
    materialsRepository = moduleFixture.get(MaterialsRepository)
    retrievalService = moduleFixture.get(RetrievalService)
    chunkEmbeddingService = moduleFixture.get(MaterialChunkEmbeddingService)
    persistence = moduleFixture.get(RagPersistenceRepository)

    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({
        email: 'instructor@morshid.demo',
        password: P0_DEMO_PASSWORD,
      })
      .expect(200)
    accessToken = (signIn.body as AuthSessionResponse).accessToken
  })

  beforeEach(async () => {
    await prisma.auditLog.deleteMany()
    await prisma.material.deleteMany()
    await storage.clear()
    extractor.reset()
    provider.reset()
    auditService.reset()
    scheduler.reset()
  })

  afterAll(async () => {
    await app.close()
    await database?.dispose()
    if (storageRoot !== undefined) {
      await rm(storageRoot, { recursive: true, force: true })
    }
  })

  it('processes a clean fixture to an eligible, truthful READY source', async () => {
    const text = `Variables bind names to values. ${TASK_80_SENTINEL}`
    const materialId = await upload(cleanTextPdf(text), 'Clean source')

    await processingService.processMaterial(materialId)

    const material = await expectStatus(materialId, {
      status: 'READY',
      errorMessage: null,
    })
    const chunks = await persistence.findMaterialChunks(materialId)
    expect(chunks).toHaveLength(material.chunkCount ?? 0)
    expect(chunks.length).toBeGreaterThan(0)
    await expect(
      retrievalService.retrieveCourseEvidence(courseId, chunks[0].content),
    ).resolves.toMatchObject({
      kind: 'evidence',
      chunks: [expect.objectContaining({ materialId })],
    })
    await expectSafeTerminalAudit(materialId, 'material.processing_ready')
  })

  it('persists and exposes a usable WARNING source with safe details', async () => {
    const materialId = await upload(
      partiallyEmptyTextPdf(),
      'Partially extracted source',
    )

    await processingService.processMaterial(materialId)

    const material = await expectStatus(materialId, {
      status: 'WARNING',
      errorMessage: MATERIAL_PROCESSING_WARNING_MESSAGES.PARTIAL_PAGE_TEXT,
    })
    expect(material.extractedTextLength).toBeGreaterThan(0)
    const chunks = await persistence.findMaterialChunks(materialId)
    expect(chunks).toHaveLength(material.chunkCount ?? 0)
    await expect(
      retrievalService.retrieveCourseEvidence(courseId, chunks[0].content),
    ).resolves.toMatchObject({
      kind: 'evidence',
      chunks: [expect.objectContaining({ materialId })],
    })
    const audit = await expectSafeTerminalAudit(
      materialId,
      AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_WARNING,
    )
    expect(audit.metadata).toMatchObject({
      status: 'WARNING',
      warningCodes: ['PARTIAL_PAGE_TEXT'],
      chunkCount: material.chunkCount,
      extractedTextLength: material.extractedTextLength,
    })
  })

  it('persists repeatable chunks, indices, models, and vectors for the same input', async () => {
    const fixture = cleanTextPdf(
      `${'Repeatable Python material. '.repeat(120)}${TASK_80_SENTINEL}`,
    )
    const firstMaterialId = await upload(fixture, 'Repeatable source one')
    const secondMaterialId = await upload(fixture, 'Repeatable source two')

    await processingService.processMaterial(firstMaterialId)
    await processingService.processMaterial(secondMaterialId)

    const firstChunks = await persistence.findMaterialChunks(firstMaterialId)
    const secondChunks = await persistence.findMaterialChunks(secondMaterialId)
    expect(firstChunks.length).toBeGreaterThan(1)
    expect(
      firstChunks.map(({ chunkIndex, content, embedding, embeddingModel }) => ({
        chunkIndex,
        content,
        embedding,
        embeddingModel,
      })),
    ).toEqual(
      secondChunks.map(
        ({ chunkIndex, content, embedding, embeddingModel }) => ({
          chunkIndex,
          content,
          embedding,
          embeddingModel,
        }),
      ),
    )
  })

  it('keeps terminal state retryable when its required audit cannot persist', async () => {
    const materialId = await upload(cleanTextPdf(), 'Audit retry source')
    auditService.failNextTerminalEvents(2)

    await processingService.processMaterial(materialId)

    const pendingMaterial = await prisma.material.findUniqueOrThrow({
      where: { id: materialId },
    })
    expect(pendingMaterial).toMatchObject({
      status: 'PROCESSING',
      chunkCount: null,
      errorMessage: null,
    })
    expect(typeof pendingMaterial.processingAttemptId).toBe('string')
    await expect(persistence.findMaterialChunks(materialId)).resolves.toEqual(
      [],
    )
    await expect(
      prisma.auditLog.count({
        where: {
          targetId: materialId,
          action: { in: [...TERMINAL_PROCESSING_ACTIONS] },
        },
      }),
    ).resolves.toBe(0)
    await prisma.materialProcessingCommand.update({
      where: { materialId },
      data: { leaseExpiresAt: new Date(0) },
    })

    await processingService.processMaterial(materialId)

    await expectStatus(materialId, { status: 'READY', errorMessage: null })
    await expectSafeTerminalAudit(
      materialId,
      AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_READY,
    )
  })

  it.each([
    ['empty', emptyPdf()],
    ['image-only', imageOnlyPdf()],
  ])(
    'fails the %s fixture without leaving eligible chunks',
    async (_name, fixture) => {
      const materialId = await upload(fixture, 'No text source')

      await processingService.processMaterial(materialId)

      await expectFailedAndExcluded(
        materialId,
        MATERIAL_PROCESSING_FAILURES.NO_EXTRACTABLE_TEXT,
      )
    },
  )

  it('fails a corrupt PDF through the production parser with safe surfaces', async () => {
    const materialId = await upload(
      corruptPdfWithPdfFilename(),
      'Corrupt source',
    )

    await processingService.processMaterial(materialId)

    await expectFailedAndExcluded(
      materialId,
      MATERIAL_PROCESSING_FAILURES.PDF_EXTRACTION_FAILED,
    )
  })

  it.each([
    {
      name: 'parser',
      reason: MATERIAL_PROCESSING_FAILURES.PDF_EXTRACTION_FAILED,
      configure: () => {
        extractor.failNext(new Error(FAILURE_SENTINEL))
      },
    },
    {
      name: 'embedding',
      reason: MATERIAL_PROCESSING_FAILURES.EMBEDDING_FAILED,
      configure: () => {
        provider.failNext(new Error(FAILURE_SENTINEL))
      },
    },
    {
      name: 'storage',
      reason: MATERIAL_PROCESSING_FAILURES.STORAGE_READ_FAILED,
      configure: () => {
        storage.failNextRead(new Error(FAILURE_SENTINEL))
      },
    },
  ])(
    'removes persisted partial chunks after a $name failure',
    async ({ reason, configure }) => {
      const materialId = await upload(cleanTextPdf(), 'Partial source')
      await chunkEmbeddingService.embedAndReplaceMaterialChunks(materialId, [
        { chunkIndex: 0, content: 'stale partial chunk' },
      ])
      expect(await persistence.findMaterialChunks(materialId)).toHaveLength(1)
      provider.reset()
      configure()

      await processingService.processMaterial(materialId)

      const failedMaterial = await expectFailedAndExcluded(materialId, reason)
      if (reason === MATERIAL_PROCESSING_FAILURES.EMBEDDING_FAILED) {
        expect(failedMaterial.extractedTextLength).toBeGreaterThan(0)
      } else {
        expect(failedMaterial.extractedTextLength).toBeNull()
      }
    },
  )

  it('classifies a missing backing file and excludes its stale chunks', async () => {
    const materialId = await upload(cleanTextPdf(), 'Missing source')
    const material = await prisma.material.findUniqueOrThrow({
      where: { id: materialId },
    })
    await chunkEmbeddingService.embedAndReplaceMaterialChunks(materialId, [
      { chunkIndex: 0, content: 'stale missing chunk' },
    ])
    await storage.delete(material.storagePath)

    await processingService.processMaterial(materialId)

    await expectFailedAndExcluded(
      materialId,
      MATERIAL_PROCESSING_FAILURES.BACKING_FILE_MISSING,
    )
  })

  it('allows only one concurrent attempt to finalize chunks and audit', async () => {
    const materialId = await upload(cleanTextPdf(), 'Concurrent source')

    await Promise.all([
      processingService.processMaterial(materialId),
      processingService.processMaterial(materialId),
    ])

    const material = await expectStatus(materialId, {
      status: 'READY',
      errorMessage: null,
    })
    expect(await persistence.findMaterialChunks(materialId)).toHaveLength(
      material.chunkCount ?? 0,
    )
    expect(provider.callCount).toBe(1)
    const terminalAudits = await prisma.auditLog.findMany({
      where: {
        targetId: materialId,
        action: {
          in: [
            AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_READY,
            AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_WARNING,
            AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_FAILED,
          ],
        },
      },
    })
    expect(terminalAudits).toHaveLength(1)
    expect(terminalAudits[0].action).toBe(
      AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_READY,
    )
  })

  it('reclaims an expired lease while stale attempts lose terminal writes', async () => {
    const materialId = await upload(cleanTextPdf(), 'Expired lease source')
    const staleAttemptId = '00000000-0000-4000-8000-000000000081'
    const activeAttemptId = '00000000-0000-4000-8000-000000000082'

    await expect(
      materialsRepository.claimMaterialProcessing(materialId, staleAttemptId),
    ).resolves.toMatchObject({ id: materialId })
    await prisma.materialProcessingCommand.update({
      where: { materialId },
      data: { leaseExpiresAt: new Date(0) },
    })
    await expect(
      materialsRepository.claimMaterialProcessing(materialId, activeAttemptId),
    ).resolves.toMatchObject({ id: materialId })

    await expect(
      materialsRepository.failMaterialProcessing(
        materialId,
        staleAttemptId,
        failureTransitionInput(materialId),
      ),
    ).resolves.toBe(false)
    await expect(
      materialsRepository.failMaterialProcessing(
        materialId,
        activeAttemptId,
        failureTransitionInput(materialId),
      ),
    ).resolves.toBe(true)
    await expect(
      prisma.materialProcessingCommand.findUnique({ where: { materialId } }),
    ).resolves.toBeNull()
    await expectStatus(materialId, {
      status: 'FAILED',
      errorMessage: MATERIAL_PROCESSING_SAFE_MESSAGES.STORAGE_READ_FAILED,
    })
  })

  async function upload(contents: Buffer, title: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/materials`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('title', title)
      .attach('file', contents, {
        filename: 'fixture.pdf',
        contentType: 'application/pdf',
      })
      .expect(201)
    const materialId = (response.body as { material: { id: string } }).material
      .id
    expect(scheduler.scheduledMaterialIds).toContain(materialId)
    await prisma.materialProcessingCommand.create({ data: { materialId } })
    return materialId
  }

  async function expectStatus(
    materialId: string,
    expected: {
      status: 'READY' | 'WARNING' | 'FAILED'
      errorMessage: string | null
    },
  ) {
    const persisted = await prisma.material.findUniqueOrThrow({
      where: { id: materialId },
    })
    expect(persisted).toMatchObject({
      ...expected,
      processingAttemptId: null,
    })

    const response = await request(app.getHttpServer())
      .get(`/api/v1/courses/${courseId}/materials/${materialId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
    expect(response.body).toMatchObject(expected)
    expect(response.body).not.toHaveProperty('processingAttemptId')
    expect(response.body).not.toHaveProperty('storagePath')
    expect(JSON.stringify(response.body)).not.toContain(TASK_80_SENTINEL)
    expect(JSON.stringify(response.body)).not.toContain(FAILURE_SENTINEL)
    expect(JSON.stringify(response.body)).not.toContain(SECRET_SENTINEL)
    return persisted
  }

  async function expectFailedAndExcluded(
    materialId: string,
    reason: MaterialProcessingFailure,
  ) {
    const material = await expectStatus(materialId, {
      status: 'FAILED',
      errorMessage: MATERIAL_PROCESSING_SAFE_MESSAGES[reason],
    })
    expect(material.chunkCount).toBe(0)
    await expect(persistence.findMaterialChunks(materialId)).resolves.toEqual(
      [],
    )
    await expect(
      retrievalService.retrieveCourseEvidence(courseId, 'stale partial chunk'),
    ).resolves.toEqual({ kind: 'insufficient_evidence' })
    await expectSafeTerminalAudit(
      materialId,
      AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_FAILED,
      reason,
    )
    return material
  }

  async function expectSafeTerminalAudit(
    materialId: string,
    action: string,
    reason?: MaterialProcessingFailure,
  ) {
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { targetId: materialId, action },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.metadata).toMatchObject({
      materialId,
      ...(reason === undefined ? {} : { reasonCode: reason }),
    })
    const serialized = JSON.stringify(audit)
    expect(serialized).not.toContain(TASK_80_SENTINEL)
    expect(serialized).not.toContain(FAILURE_SENTINEL)
    expect(serialized).not.toContain(SECRET_SENTINEL)
    expect(serialized).not.toContain('stack')
    return audit
  }

  function failureTransitionInput(materialId: string) {
    const reasonCode = MATERIAL_PROCESSING_FAILURES.STORAGE_READ_FAILED
    return {
      reasonCode,
      extractedTextLength: null,
      errorMessage: MATERIAL_PROCESSING_SAFE_MESSAGES[reasonCode],
      auditEvent: {
        actorUserId: null,
        action: AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_FAILED,
        target: { type: 'material' as const, id: materialId },
        courseId,
        metadata: { materialId, status: 'FAILED', reasonCode },
      },
    }
  }
})
