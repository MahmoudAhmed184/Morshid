import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { AUDIT_EVENT_ACTIONS } from '../src/modules/audit/audit.constants'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import { AUTH_ERROR_CODES } from '../src/modules/auth/auth.dto'
import { DEFAULT_PDF_MAX_UPLOAD_BYTES } from '../src/modules/config/env.schema'
import {
  EMBEDDING_PROVIDER_TOKEN,
  type EmbeddingProvider,
} from '../src/modules/embedding/embedding-provider'
import type { Material } from '../src/generated/prisma/client'
import { MATERIALS_ERROR_CODES } from '../src/modules/materials/materials.errors'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import {
  PDF_STORAGE,
  type PdfStorage,
} from '../src/modules/pdf-storage/pdf-storage'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RagPersistenceRepository } from '../src/modules/rag-persistence/rag-persistence.repository'
import { RedisService } from '../src/modules/redis/redis.service'
import { P0_DEMO_COURSE, P0_DEMO_PASSWORD } from '../src/seeds/p0-demo.seed'
import {
  TASK_80_SENTINEL,
  cleanTextPdf,
  invalidPdfSignature,
  oversizedPdf,
} from './fixtures/pdf-fixtures'
import { AuthTestStore } from './support/auth-test-store'

const validPdf = cleanTextPdf('minimal upload test pdf')
const userAgent = 'Morshid materials e2e'
const generatedStoragePath = '00000000-0000-4000-8000-000000000701.pdf'

class FakePdfStorage implements PdfStorage {
  readonly files = new Map<string, Buffer>()

  readonly create = jest.fn((contents: Buffer) => {
    this.files.set(generatedStoragePath, Buffer.from(contents))

    return Promise.resolve(generatedStoragePath)
  })

  readonly read = jest.fn((storagePath: string) => {
    const file = this.files.get(storagePath)

    if (file === undefined) {
      throw new Error(`Missing test storage path ${storagePath}`)
    }

    return Promise.resolve(file)
  })

  readonly exists = jest.fn((storagePath: string) =>
    Promise.resolve(this.files.has(storagePath)),
  )

  readonly delete = jest.fn((storagePath: string) => {
    this.files.delete(storagePath)

    return Promise.resolve()
  })
}

class FakeMaterialProcessingScheduler extends MaterialProcessingScheduler {
  readonly scheduledMaterialIds: string[] = []
  failNextSchedule = false

  readonly scheduleMaterialProcessing = jest.fn((materialId: string) => {
    if (this.failNextSchedule) {
      this.failNextSchedule = false
      return Promise.reject(new Error('simulated scheduling failure'))
    }

    this.scheduledMaterialIds.push(materialId)

    return Promise.resolve()
  })
}

describe('Materials upload (e2e)', () => {
  let app: INestApplication<App>
  let store: AuthTestStore
  let storage: FakePdfStorage
  let scheduler: FakeMaterialProcessingScheduler
  let embedBatch: jest.Mock
  let replaceMaterialChunks: jest.Mock

  const redisService = {
    ping: jest.fn().mockResolvedValue('PONG'),
  }

  beforeEach(async () => {
    store = new AuthTestStore()
    storage = new FakePdfStorage()
    scheduler = new FakeMaterialProcessingScheduler()
    embedBatch = jest.fn().mockResolvedValue([])
    replaceMaterialChunks = jest.fn().mockResolvedValue(undefined)
    jest.clearAllMocks()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(store.prisma)
      .overrideProvider(RedisService)
      .useValue(redisService)
      .overrideProvider(PDF_STORAGE)
      .useValue(storage)
      .overrideProvider(MaterialProcessingScheduler)
      .useValue(scheduler)
      .overrideProvider(EMBEDDING_PROVIDER_TOKEN)
      .useValue({
        model: 'authorization-side-effect-spy',
        embedBatch,
      } satisfies EmbeddingProvider)
      .overrideProvider(RagPersistenceRepository)
      .useValue({ replaceMaterialChunks })
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  async function signInAs(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .set('User-Agent', userAgent)
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    return (response.body as AuthSessionResponse).accessToken
  }

  function uploadWithoutFile(input: { token: string; title: string }) {
    return request(app.getHttpServer())
      .post(`/api/v1/courses/${pythonCourseId()}/materials`)
      .set('User-Agent', userAgent)
      .set('Authorization', `Bearer ${input.token}`)
      .field('title', input.title)
  }

  it('returns the effective PDF upload constraints to Instructors', async () => {
    const token = await signInAs('instructor@morshid.demo')

    await request(app.getHttpServer())
      .get('/api/v1/materials/upload-configuration')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({
        maxUploadBytes: DEFAULT_PDF_MAX_UPLOAD_BYTES,
        acceptedMimeType: 'application/pdf',
        acceptedFileExtension: '.pdf',
      })
  })

  it('does not expose the Instructor upload configuration to students', async () => {
    const token = await signInAs('student1@morshid.demo')

    await request(app.getHttpServer())
      .get('/api/v1/materials/upload-configuration')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
  })

  function pythonCourseId(): string {
    const course = [...store.courses.values()].find(
      (candidate) => candidate.code === P0_DEMO_COURSE.code,
    )

    if (course === undefined) {
      throw new Error('Missing Python course fixture')
    }

    return course.id
  }

  function addMaterial(input: Partial<Material> & Pick<Material, 'id'>) {
    const existing = [...store.materials.values()][0]

    store.materials.set(input.id, {
      ...existing,
      ...input,
    })
  }

  function listMaterials(input: { token: string; courseId?: string }) {
    return request(app.getHttpServer())
      .get(`/api/v1/courses/${input.courseId ?? pythonCourseId()}/materials`)
      .set('User-Agent', userAgent)
      .set('Authorization', `Bearer ${input.token}`)
  }

  function getMaterial(input: {
    token: string
    courseId?: string
    materialId: string
  }) {
    return request(app.getHttpServer())
      .get(
        `/api/v1/courses/${input.courseId ?? pythonCourseId()}/materials/${input.materialId}`,
      )
      .set('User-Agent', userAgent)
      .set('Authorization', `Bearer ${input.token}`)
  }

  function getMaterialStatus(input: {
    token: string
    courseId?: string
    materialId: string
  }) {
    return request(app.getHttpServer())
      .get(
        `/api/v1/courses/${input.courseId ?? pythonCourseId()}/materials/${input.materialId}/status`,
      )
      .set('User-Agent', userAgent)
      .set('Authorization', `Bearer ${input.token}`)
  }

  function uploadPdf(input: {
    token: string
    courseId?: string
    title?: string
    filename?: string
    contentType?: string
    buffer?: Buffer
  }) {
    const multipart = request(app.getHttpServer())
      .post(`/api/v1/courses/${input.courseId ?? pythonCourseId()}/materials`)
      .set('User-Agent', userAgent)
      .set('Authorization', `Bearer ${input.token}`)

    if (input.title !== undefined) {
      multipart.field('title', input.title)
    }

    return multipart.attach('file', input.buffer ?? validPdf, {
      filename: input.filename ?? 'python.pdf',
      contentType: input.contentType ?? 'application/pdf',
    })
  }

  it('allows an assigned instructor to upload one clean PDF', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const materialCountBefore = store.materials.size

    const response = await uploadPdf({
      token,
      title: '  Python basics upload  ',
    }).expect(201)

    const body = response.body as {
      material: Record<string, unknown>
    }
    expect(body.material).toMatchObject({
      courseId: pythonCourseId(),
      title: 'Python basics upload',
      originalFilename: 'python.pdf',
      status: 'PROCESSING',
      extractedTextLength: null,
      chunkCount: null,
      errorMessage: null,
    })
    expect(body.material).not.toHaveProperty('storagePath')
    expect(body.material).not.toHaveProperty('sha256Hash')
    expect(body.material).not.toHaveProperty('uploadedBy')
    expect(store.materials.size).toBe(materialCountBefore + 1)
    expect(storage.create).toHaveBeenCalledWith(validPdf)
    expect(scheduler.scheduledMaterialIds).toEqual([body.material.id])

    const storedMaterial = store.materials.get(body.material.id as string)
    expect(storedMaterial).toMatchObject({
      storagePath: generatedStoragePath,
      status: 'PROCESSING',
    })
    expect(storedMaterial?.sha256Hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('allows an admin to upload a clean PDF', async () => {
    const token = await signInAs('admin@morshid.demo')

    const response = await uploadPdf({
      token,
      title: 'Admin upload',
    }).expect(201)

    expect(response.body).toMatchObject({
      material: {
        courseId: pythonCourseId(),
        title: 'Admin upload',
        status: 'PROCESSING',
      },
    })
  })

  it('denies student uploads through the global role guard before storage', async () => {
    const token = await signInAs('student1@morshid.demo')
    const materialCountBefore = store.materials.size

    await uploadPdf({ token, title: 'Student upload' }).expect(403).expect({
      code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
      message: 'Insufficient role',
    })

    expect(storage.create).not.toHaveBeenCalled()
    expect(store.materials.size).toBe(materialCountBefore)
    expect(scheduler.scheduleMaterialProcessing).not.toHaveBeenCalled()
    expect(embedBatch).not.toHaveBeenCalled()
    expect(replaceMaterialChunks).not.toHaveBeenCalled()
    const deniedAudit = [...store.auditLogs.values()].find(
      (event) => event.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_DENIED,
    )
    expect(deniedAudit).toMatchObject({
      targetType: 'material',
      targetId: null,
      courseId: null,
      metadata: {
        reason: 'INSUFFICIENT_ROLE',
        actorRole: 'STUDENT',
        unverifiedCourseId: pythonCourseId(),
      },
    })
    expect(JSON.stringify(deniedAudit?.metadata)).not.toContain('%PDF-')
  })

  it('denies an instructor who is not actively assigned to the course', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const hiddenCourseId = '00000000-0000-4000-8000-000000000102'
    const materialCountBefore = store.materials.size

    await uploadPdf({
      token,
      courseId: hiddenCourseId,
      title: 'Hidden upload',
    })
      .expect(403)
      .expect({
        code: MATERIALS_ERROR_CODES.COURSE_MANAGEMENT_REQUIRED,
        message: 'Active instructor course membership is required',
      })

    expect(storage.create).not.toHaveBeenCalled()
    expect(store.materials.size).toBe(materialCountBefore)
    expect(scheduler.scheduleMaterialProcessing).not.toHaveBeenCalled()
    expect(embedBatch).not.toHaveBeenCalled()
    expect(replaceMaterialChunks).not.toHaveBeenCalled()
    const deniedAudit = [...store.auditLogs.values()].find(
      (event) => event.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_DENIED,
    )
    expect(deniedAudit).toMatchObject({
      targetType: 'material',
      courseId: null,
      metadata: {
        reason: 'COURSE_MANAGEMENT_REQUIRED',
        unverifiedCourseId: hiddenCourseId,
      },
    })
    expect(JSON.stringify(deniedAudit?.metadata)).not.toContain('%PDF-')
  })

  it('audits an invalid course UUID before multipart parsing or persistence', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const materialCountBefore = store.materials.size
    const invalidCourseId = 'not-a-course-uuid'

    await uploadPdf({
      token,
      courseId: invalidCourseId,
      title: 'Invalid course identifier',
    })
      .expect(400)
      .expect({
        message: 'Validation failed (uuid v 4 is expected)',
        error: 'Bad Request',
        statusCode: 400,
      })

    expect(storage.create).not.toHaveBeenCalled()
    expect(store.materials.size).toBe(materialCountBefore)
    const failedAudits = [...store.auditLogs.values()].filter(
      (event) => event.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_FAILED,
    )
    expect(failedAudits).toHaveLength(1)
    expect(failedAudits[0]).toMatchObject({
      targetType: 'material',
      targetId: null,
      courseId: null,
      metadata: {
        reason: 'INVALID_COURSE_ID',
        unverifiedCourseId: invalidCourseId,
      },
    })
    expect(JSON.stringify(failedAudits[0]?.metadata)).not.toContain('%PDF-')
  })

  it.each([
    {
      title: 'wrong MIME',
      input: { contentType: 'text/plain' },
      expectedCode: MATERIALS_ERROR_CODES.INVALID_REQUEST,
    },
    {
      title: 'wrong extension',
      input: { filename: 'python.txt' },
      expectedCode: MATERIALS_ERROR_CODES.INVALID_REQUEST,
    },
    {
      title: 'bad signature',
      input: { buffer: invalidPdfSignature() },
      expectedCode: MATERIALS_ERROR_CODES.INVALID_REQUEST,
    },
    {
      title: 'empty title',
      input: { title: '   ' },
      expectedCode: MATERIALS_ERROR_CODES.INVALID_REQUEST,
    },
  ])('rejects invalid uploads: $title', async ({ input, expectedCode }) => {
    const token = await signInAs('instructor@morshid.demo')
    const materialCountBefore = store.materials.size

    await uploadPdf({
      token,
      title: 'Python upload',
      ...input,
    })
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({ code: expectedCode })
      })

    expect(storage.create).not.toHaveBeenCalled()
    expect(store.materials.size).toBe(materialCountBefore)
  })

  it('rejects a missing file before storage', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const materialCountBefore = store.materials.size

    await uploadWithoutFile({ token, title: 'Missing file' })
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({
          code: MATERIALS_ERROR_CODES.INVALID_REQUEST,
        })
      })

    expect(storage.create).not.toHaveBeenCalled()
    expect(store.materials.size).toBe(materialCountBefore)
  })

  it('rejects a title longer than the documented storage boundary', async () => {
    const token = await signInAs('instructor@morshid.demo')

    await uploadPdf({ token, title: 'a'.repeat(181) })
      .expect(400)
      .expect({
        code: MATERIALS_ERROR_CODES.INVALID_REQUEST,
        message: 'Invalid materials request',
        errors: [
          {
            field: 'title',
            message: 'Title must be at most 180 characters',
          },
        ],
      })

    expect(storage.create).not.toHaveBeenCalled()
  })

  it('records safe failed-upload audit metadata for invalid PDFs', async () => {
    const token = await signInAs('instructor@morshid.demo')

    await uploadPdf({
      token,
      title: 'Invalid audited upload',
      buffer: invalidPdfSignature(),
    }).expect(400)

    const failedAudit = [...store.auditLogs.values()].find(
      (event) => event.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_FAILED,
    )
    expect(failedAudit).toMatchObject({
      targetType: 'material',
      courseId: pythonCourseId(),
      metadata: {
        originalFilename: 'python.pdf',
        fileSize: invalidPdfSignature().byteLength,
        mimetype: 'application/pdf',
        reason: 'VALIDATION_FAILED',
      },
    })
    expect(JSON.stringify(failedAudit?.metadata)).not.toContain(
      TASK_80_SENTINEL,
    )
    expect(JSON.stringify(failedAudit?.metadata)).not.toContain('stack')
  })

  it('rejects oversize PDFs before storage', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const materialCountBefore = store.materials.size

    await uploadPdf({
      token,
      title: 'Oversize upload',
      buffer: oversizedPdf(DEFAULT_PDF_MAX_UPLOAD_BYTES + 1),
    })
      .expect(413)
      .expect({
        code: MATERIALS_ERROR_CODES.PDF_TOO_LARGE,
        message: 'PDF upload exceeds the configured size limit',
      })

    expect(storage.create).not.toHaveBeenCalled()
    expect(store.materials.size).toBe(materialCountBefore)
    const failedAudit = [...store.auditLogs.values()].find(
      (event) => event.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_FAILED,
    )
    expect(failedAudit).toMatchObject({
      courseId: null,
      metadata: {
        reason: 'PDF_TOO_LARGE',
        unverifiedCourseId: pythonCourseId(),
      },
    })
    expect(JSON.stringify(failedAudit?.metadata)).not.toContain('%PDF-')
  })

  it('translates and audits an unexpected multipart file field safely', async () => {
    const token = await signInAs('instructor@morshid.demo')

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${pythonCourseId()}/materials`)
      .set('User-Agent', userAgent)
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Unexpected field')
      .attach('document', validPdf, {
        filename: 'private.pdf',
        contentType: 'application/pdf',
      })
      .expect(400)
      .expect({
        code: MATERIALS_ERROR_CODES.INVALID_REQUEST,
        message: 'Invalid materials request',
        errors: [
          {
            field: 'file',
            message: 'Multipart PDF upload is malformed',
          },
        ],
      })

    const failedAudit = [...store.auditLogs.values()].find(
      (event) => event.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_FAILED,
    )
    expect(failedAudit).toMatchObject({
      metadata: {
        reason: 'MALFORMED_MULTIPART',
        unverifiedCourseId: pythonCourseId(),
      },
    })
    expect(JSON.stringify(failedAudit?.metadata)).not.toContain('private.pdf')
    expect(JSON.stringify(failedAudit?.metadata)).not.toContain('%PDF-')
  })

  it('audits malformed multipart bodies without echoing body content', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const privateBodyMarker = 'private-multipart-body-marker'

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${pythonCourseId()}/materials`)
      .set('User-Agent', userAgent)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'multipart/form-data; boundary=broken-boundary')
      .send(`--broken-boundary\r\n${privateBodyMarker}`)
      .expect(400)
      .expect({
        code: MATERIALS_ERROR_CODES.INVALID_REQUEST,
        message: 'Invalid materials request',
        errors: [
          {
            field: 'file',
            message: 'Multipart PDF upload is malformed',
          },
        ],
      })

    const failedAudit = [...store.auditLogs.values()].find(
      (event) => event.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_FAILED,
    )
    expect(failedAudit).toMatchObject({
      metadata: {
        reason: 'MALFORMED_MULTIPART',
        unverifiedCourseId: pythonCourseId(),
      },
    })
    expect(JSON.stringify(failedAudit?.metadata)).not.toContain(
      privateBodyMarker,
    )
  })

  it('uses generated storage keys for path-like filenames', async () => {
    const token = await signInAs('instructor@morshid.demo')

    const response = await uploadPdf({
      token,
      title: 'Safe upload',
      filename: '../nested\\python.pdf',
    }).expect(201)
    const body = response.body as { material: { id: string } }

    const material = store.materials.get(body.material.id)
    expect(material?.originalFilename).toBe('python.pdf')
    expect(material?.storagePath).toBe(generatedStoragePath)
  })

  it('deletes the stored file when material persistence fails', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const materialCountBefore = store.materials.size
    const materialDelegate = store.prisma.material as unknown as {
      create: jest.Mock
    }
    materialDelegate.create.mockRejectedValueOnce(
      new Error('simulated DB failure'),
    )

    await uploadPdf({ token, title: 'Persistence failure' }).expect(500)

    expect(storage.create).toHaveBeenCalledTimes(1)
    expect(storage.delete).toHaveBeenCalledWith(generatedStoragePath)
    expect(storage.files.size).toBe(0)
    expect(store.materials.size).toBe(materialCountBefore)
  })

  it('deletes the material and file when scheduling fails', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const materialCountBefore = store.materials.size
    scheduler.failNextSchedule = true

    await uploadPdf({ token, title: 'Scheduling failure' }).expect(500)

    expect(storage.delete).toHaveBeenCalledWith(generatedStoragePath)
    expect(storage.files.size).toBe(0)
    expect(store.materials.size).toBe(materialCountBefore)
  })

  it('quarantines the material and audits when file cleanup fails', async () => {
    const token = await signInAs('instructor@morshid.demo')
    scheduler.failNextSchedule = true
    storage.delete.mockRejectedValueOnce(
      new Error('simulated storage cleanup failure'),
    )

    await uploadPdf({ token, title: 'File cleanup failure' }).expect(500)

    const failedMaterial = [...store.materials.values()].find(
      (material) => material.title === 'File cleanup failure',
    )
    expect(failedMaterial).toMatchObject({
      status: 'FAILED',
      errorMessage: 'Upload cleanup required',
    })
    expect(failedMaterial?.deletedAt).toBeInstanceOf(Date)
    expect(storage.delete).toHaveBeenCalledWith(generatedStoragePath)
    if (failedMaterial === undefined) {
      throw new Error('Missing quarantined material')
    }
    await getMaterial({
      token,
      materialId: failedMaterial.id,
    }).expect(404)
    const failedAudit = [...store.auditLogs.values()].find(
      (event) => event.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_FAILED,
    )
    expect(failedAudit?.metadata).toMatchObject({
      reason: 'UPLOAD_CLEANUP_FAILED',
    })
  })

  it('still deletes the file and audits when material cleanup fails', async () => {
    const token = await signInAs('instructor@morshid.demo')
    scheduler.failNextSchedule = true
    const materialDelegate = store.prisma.material as unknown as {
      delete: jest.Mock
    }
    materialDelegate.delete.mockRejectedValueOnce(
      new Error('simulated material cleanup failure'),
    )

    await uploadPdf({ token, title: 'Row cleanup failure' }).expect(500)

    expect(storage.delete).toHaveBeenCalledWith(generatedStoragePath)
    expect(storage.files.size).toBe(0)
    const failedMaterial = [...store.materials.values()].find(
      (material) => material.title === 'Row cleanup failure',
    )
    expect(failedMaterial).toMatchObject({
      status: 'FAILED',
      errorMessage: 'Upload cleanup required',
    })
    expect(failedMaterial?.deletedAt).toBeInstanceOf(Date)
    const failedAudit = [...store.auditLogs.values()].find(
      (event) => event.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_FAILED,
    )
    expect(failedAudit?.metadata).toMatchObject({
      reason: 'UPLOAD_CLEANUP_FAILED',
    })
  })

  it('retains the row and path when quarantine and file cleanup both fail', async () => {
    const token = await signInAs('instructor@morshid.demo')
    scheduler.failNextSchedule = true
    storage.delete.mockRejectedValueOnce(
      new Error('simulated storage cleanup failure'),
    )
    const materialDelegate = store.prisma.material as unknown as {
      update: jest.Mock
      delete: jest.Mock
    }
    materialDelegate.update
      .mockRejectedValueOnce(new Error('simulated quarantine failure'))
      .mockRejectedValueOnce(new Error('simulated retry quarantine failure'))

    await uploadPdf({ token, title: 'Combined cleanup failure' }).expect(500)

    expect(materialDelegate.update).toHaveBeenCalledTimes(2)
    expect(materialDelegate.delete).not.toHaveBeenCalled()
    expect(storage.delete).toHaveBeenCalledWith(generatedStoragePath)
    expect(storage.files.get(generatedStoragePath)).toEqual(validPdf)
    const retainedMaterial = [...store.materials.values()].find(
      (material) => material.title === 'Combined cleanup failure',
    )
    expect(retainedMaterial).toMatchObject({
      storagePath: generatedStoragePath,
      status: 'PROCESSING',
      deletedAt: null,
    })
    const failedAudit = [...store.auditLogs.values()].find(
      (event) => event.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_FAILED,
    )
    expect(failedAudit?.metadata).toMatchObject({
      reason: 'UPLOAD_CLEANUP_FAILED',
    })
    expect(JSON.stringify(failedAudit?.metadata)).not.toContain(
      generatedStoragePath,
    )
  })

  it('records safe upload audit events', async () => {
    const token = await signInAs('instructor@morshid.demo')

    await uploadPdf({ token, title: 'Audited upload' }).expect(201)

    const uploadAudit = [...store.auditLogs.values()].find(
      (event) => event.action === AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_SUCCEEDED,
    )
    expect(uploadAudit).toMatchObject({
      targetType: 'material',
      courseId: pythonCourseId(),
      metadata: {
        originalFilename: 'python.pdf',
        fileSize: validPdf.byteLength,
        mimetype: 'application/pdf',
        reason: 'UPLOAD_ACCEPTED',
      },
    })
    expect(JSON.stringify(uploadAudit?.metadata)).not.toContain('%PDF-')
  })

  it('lists only non-deleted materials for the requested course newest first', async () => {
    const token = await signInAs('instructor@morshid.demo')
    addMaterial({
      id: '00000000-0000-4000-8000-000000000711',
      courseId: pythonCourseId(),
      title: 'Deleted Python material',
      deletedAt: new Date('2026-07-07T00:00:00.000Z'),
      createdAt: new Date('2026-07-08T00:00:00.000Z'),
    })
    addMaterial({
      id: '00000000-0000-4000-8000-000000000712',
      courseId: pythonCourseId(),
      title: 'Newest Python material',
      deletedAt: null,
      createdAt: new Date('2026-07-09T00:00:00.000Z'),
    })
    addMaterial({
      id: '00000000-0000-4000-8000-000000000713',
      courseId: '00000000-0000-4000-8000-000000000102',
      title: 'Hidden course material',
      deletedAt: null,
      createdAt: new Date('2026-07-10T00:00:00.000Z'),
    })

    const response = await listMaterials({ token }).expect(200)

    expect(response.body).toMatchObject({
      materials: [
        {
          id: '00000000-0000-4000-8000-000000000712',
          title: 'Newest Python material',
        },
        {
          id: '00000000-0000-4000-8000-000000000401',
          title: 'Python Basics',
        },
      ],
    })
    expect(JSON.stringify(response.body)).not.toContain('storagePath')
    expect(JSON.stringify(response.body)).not.toContain(
      'Hidden course material',
    )
    expect(JSON.stringify(response.body)).not.toContain(
      'Deleted Python material',
    )
  })

  it('denies list access to instructors outside the course', async () => {
    const token = await signInAs('instructor@morshid.demo')

    await listMaterials({
      token,
      courseId: '00000000-0000-4000-8000-000000000102',
    })
      .expect(403)
      .expect({
        code: MATERIALS_ERROR_CODES.COURSE_MANAGEMENT_REQUIRED,
        message: 'Active instructor course membership is required',
      })
  })

  it('returns safe detail for a course material', async () => {
    const token = await signInAs('instructor@morshid.demo')

    const response = await getMaterial({
      token,
      materialId: '00000000-0000-4000-8000-000000000401',
    }).expect(200)

    expect(response.body).toMatchObject({
      material: {
        id: '00000000-0000-4000-8000-000000000401',
        courseId: pythonCourseId(),
        title: 'Python Basics',
        status: 'READY',
      },
    })
    expect(JSON.stringify(response.body)).not.toContain('storagePath')
    expect(JSON.stringify(response.body)).not.toContain('sha256Hash')
    expect(JSON.stringify(response.body)).not.toContain('uploadedBy')
  })

  it('does not return a material from another course through the detail route', async () => {
    const token = await signInAs('admin@morshid.demo')
    addMaterial({
      id: '00000000-0000-4000-8000-000000000721',
      courseId: '00000000-0000-4000-8000-000000000102',
      title: 'Hidden material',
      deletedAt: null,
    })

    await getMaterial({
      token,
      courseId: pythonCourseId(),
      materialId: '00000000-0000-4000-8000-000000000721',
    })
      .expect(404)
      .expect({
        code: MATERIALS_ERROR_CODES.MATERIAL_NOT_FOUND,
        message: 'Material was not found',
      })
  })

  it('does not return a deleted material through the detail route', async () => {
    const token = await signInAs('admin@morshid.demo')
    addMaterial({
      id: '00000000-0000-4000-8000-000000000722',
      courseId: pythonCourseId(),
      title: 'Deleted material',
      deletedAt: new Date('2026-07-08T00:00:00.000Z'),
    })

    await getMaterial({
      token,
      materialId: '00000000-0000-4000-8000-000000000722',
    }).expect(404)
  })

  it('returns only safe processing status fields', async () => {
    const token = await signInAs('instructor@morshid.demo')

    const response = await getMaterialStatus({
      token,
      materialId: '00000000-0000-4000-8000-000000000401',
    }).expect(200)
    const body = response.body as Record<string, unknown>

    expect(Object.keys(body).sort()).toEqual([
      'chunkCount',
      'errorMessage',
      'extractedTextLength',
      'id',
      'status',
      'updatedAt',
    ])
    expect(body).toMatchObject({
      id: '00000000-0000-4000-8000-000000000401',
      status: 'READY',
      extractedTextLength: 1000,
      chunkCount: 10,
      errorMessage: null,
    })
  })

  it('does not return a material from another course through the status route', async () => {
    const token = await signInAs('admin@morshid.demo')
    addMaterial({
      id: '00000000-0000-4000-8000-000000000731',
      courseId: '00000000-0000-4000-8000-000000000102',
      title: 'Hidden status material',
      deletedAt: null,
    })

    await getMaterialStatus({
      token,
      courseId: pythonCourseId(),
      materialId: '00000000-0000-4000-8000-000000000731',
    }).expect(404)
  })
})
