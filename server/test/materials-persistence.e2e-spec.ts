import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import { MATERIALS_ERROR_CODES } from '../src/modules/materials/materials.errors'
import { LocalPdfStorageAdapter } from '../src/modules/pdf-storage/local-pdf-storage.adapter'
import { PDF_STORAGE } from '../src/modules/pdf-storage/pdf-storage'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import {
  P0_DEMO_PASSWORD,
  seedP0DemoData,
  type P0DemoSeedResult,
} from '../src/seeds/p0-demo.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

const validPdf = Buffer.from('%PDF-1.7\nreal persistence upload')

describe('Materials persistence and local storage (e2e)', () => {
  let app: INestApplication<App>
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let storageRoot = ''
  let seed: P0DemoSeedResult
  let previousStoragePath: string | undefined

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue77')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    storageRoot = await mkdtemp(join(tmpdir(), 'morshid-material-upload-'))
    previousStoragePath = process.env.PDF_STORAGE_PATH
    process.env.PDF_STORAGE_PATH = storageRoot

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn().mockResolvedValue('PONG') })
      .overrideProvider(PDF_STORAGE)
      .useValue(new LocalPdfStorageAdapter(storageRoot))
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
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

    return (response.body as AuthSessionResponse).accessToken
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

  it('persists a contained file, material row, and durable idempotent command', async () => {
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
      status: 'PROCESSING',
    })
    expect(material.storagePath).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i,
    )
    await expect(
      readFile(join(storageRoot, material.storagePath)),
    ).resolves.toEqual(validPdf)
    await expect(
      prisma.materialProcessingCommand.findUnique({
        where: { materialId },
      }),
    ).resolves.toMatchObject({ materialId })

    const scheduler = app.get(MaterialProcessingScheduler)
    await scheduler.scheduleMaterialProcessing(materialId)
    await expect(
      prisma.materialProcessingCommand.count({ where: { materialId } }),
    ).resolves.toBe(1)
  })

  it('rejects an unknown course without creating a row or file', async () => {
    const token = await signInAs('admin@morshid.demo')
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
})
