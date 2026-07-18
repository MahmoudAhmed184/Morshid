import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { AUDIT_EVENT_ACTIONS } from '../src/modules/audit/audit.constants'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import { AUTH_ERROR_CODES } from '../src/modules/auth/auth.dto'
import { MATERIALS_ERROR_CODES } from '../src/modules/materials/materials.errors'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import { PDF_STORAGE, type PdfStorage } from '../src/modules/pdf-storage/pdf-storage'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import { P0_DEMO_COURSE, P0_DEMO_PASSWORD } from '../src/seeds/p0-demo.seed'
import { AuthTestStore } from './support/auth-test-store'

const validPdf = Buffer.from('%PDF-1.7\nminimal upload test pdf')
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

  const redisService = {
    ping: jest.fn().mockResolvedValue('PONG'),
  }

  beforeEach(async () => {
    store = new AuthTestStore()
    storage = new FakePdfStorage()
    scheduler = new FakeMaterialProcessingScheduler()
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

  function pythonCourseId(): string {
    const course = [...store.courses.values()].find(
      (candidate) => candidate.code === P0_DEMO_COURSE.code,
    )

    if (course === undefined) {
      throw new Error('Missing Python course fixture')
    }

    return course.id
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

    await uploadPdf({ token, title: 'Student upload' })
      .expect(403)
      .expect({
        code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
        message: 'Insufficient role',
      })

    expect(storage.create).not.toHaveBeenCalled()
    expect(store.materials.size).toBe(materialCountBefore)
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
      input: { buffer: Buffer.from('not a pdf') },
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

  it('rejects oversize PDFs before storage', async () => {
    const token = await signInAs('instructor@morshid.demo')
    const materialCountBefore = store.materials.size

    await uploadPdf({
      token,
      title: 'Oversize upload',
      buffer: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(10_485_760)]),
    }).expect(413)

    expect(storage.create).not.toHaveBeenCalled()
    expect(store.materials.size).toBe(materialCountBefore)
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
})
