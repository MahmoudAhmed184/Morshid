import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import type { AuthSessionResponse } from '../src/modules/auth/auth.dto'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../src/modules/audit/audit.constants'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import type {
  ChatMessageHistoryResponseDto,
  ChatSessionListResponseDto,
  ChatSessionResponseDto,
} from '../src/modules/student-chat/student-chat.dto'
import { StudentChatService } from '../src/modules/student-chat/student-chat.service'
import {
  P0_DEMO_PASSWORD,
  seedP0DemoData,
  type P0DemoSeedResult,
} from '../src/seeds/p0-demo.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'
import { NoopMaterialProcessingScheduler } from './support/noop-material-processing-scheduler'

const STUDENT_1_EMAIL = 'student1@morshid.demo'

const OWNER_PRIVATE_TITLE = 'Issue 86 owner private Python session'
const RENAMED_PRIVATE_TITLE = 'Issue 86 renamed private Python session'
const OWNER_PRIVATE_MESSAGE = 'Student secret: my loop fails after iteration 4'
const ASSISTANT_PRIVATE_MESSAGE = 'Assistant secret: inspect the loop condition'

interface SeededActor {
  id: string
  email: string
}

describe('Student chat ownership and privacy boundaries (e2e)', () => {
  let app: INestApplication<App>
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let chatService: StudentChatService
  let seed: P0DemoSeedResult
  let pythonCourseId: string
  let student1: SeededActor
  let student1Token: string

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue86')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    pythonCourseId = seed.courses.pythonProgramming.id
    student1 = requireSeededActor(STUDENT_1_EMAIL)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn().mockResolvedValue('PONG') })
      .overrideProvider(MaterialProcessingScheduler)
      .useClass(NoopMaterialProcessingScheduler)
      .compile()

    app = moduleFixture.createNestApplication()
    configureApp(app)
    await app.init()
    chatService = moduleFixture.get(StudentChatService)

    student1Token = await signInAs(STUDENT_1_EMAIL)
  })

  beforeEach(async () => {
    await prisma.auditLog.deleteMany()
    await prisma.message.deleteMany()
    await prisma.chatSession.deleteMany()
  })

  afterAll(async () => {
    await app.close()
    await database?.dispose()
  })

  function requireSeededActor(email: string): SeededActor {
    const actor = seed.users.find((user) => user.email === email)

    if (actor === undefined) {
      throw new Error(`Expected the P0 seed to contain ${email}`)
    }

    return actor
  }

  async function signInAs(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in')
      .send({ email, password: P0_DEMO_PASSWORD })
      .expect(200)

    return (response.body as AuthSessionResponse).accessToken
  }

  function sessionPath(courseId = pythonCourseId): string {
    return `/api/v1/courses/${courseId}/chat-sessions`
  }

  it('lets an owner complete the private session lifecycle and read ordered history', async () => {
    const createResponse = await request(app.getHttpServer())
      .post(sessionPath())
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ title: OWNER_PRIVATE_TITLE })
      .expect(201)
    const created = (createResponse.body as ChatSessionResponseDto).session

    expect(created).toMatchObject({
      courseId: pythonCourseId,
      title: OWNER_PRIVATE_TITLE,
      lastMessageAt: null,
    })

    const listResponse = await request(app.getHttpServer())
      .get(sessionPath())
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(200)
    expect((listResponse.body as ChatSessionListResponseDto).sessions).toEqual([
      created,
    ])

    await request(app.getHttpServer())
      .get(`${sessionPath()}/${created.id}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(200)
      .expect({ session: created })

    const renameResponse = await request(app.getHttpServer())
      .patch(`${sessionPath()}/${created.id}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ title: RENAMED_PRIVATE_TITLE })
      .expect(200)
    expect(
      (renameResponse.body as ChatSessionResponseDto).session,
    ).toMatchObject({
      id: created.id,
      courseId: pythonCourseId,
      title: RENAMED_PRIVATE_TITLE,
    })

    const studentMessage = await chatService.appendStudentMessage({
      courseId: pythonCourseId,
      sessionId: created.id,
      studentId: student1.id,
      content: OWNER_PRIVATE_MESSAGE,
      requestKind: 'CODE_DIAGNOSIS',
    })
    const pendingAssistant = await chatService.appendPendingAssistantMessage({
      courseId: pythonCourseId,
      sessionId: created.id,
      studentId: student1.id,
      responseToMessageId: studentMessage.id,
      guidanceLabel: 'COURSE_GROUNDED',
    })
    const assistantMessage = await chatService.completeAssistantMessage({
      courseId: pythonCourseId,
      sessionId: created.id,
      studentId: student1.id,
      messageId: pendingAssistant.id,
      content: ASSISTANT_PRIVATE_MESSAGE,
      provider: 'issue-86-provider-secret',
      model: 'issue-86-model-secret',
      inputTokens: 29,
      outputTokens: 17,
    })

    const historyResponse = await request(app.getHttpServer())
      .get(`${sessionPath()}/${created.id}/messages`)
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(200)
    const history = historyResponse.body as ChatMessageHistoryResponseDto

    expect(history.messages).toEqual([studentMessage, assistantMessage])
    expect(history.messages.map((message) => message.sequence)).toEqual([1, 2])
    expect(history.nextCursor).toBeNull()
    expect(historyResponse.body).not.toHaveProperty('messages.0.authorUserId')
    expect(historyResponse.body).not.toHaveProperty('messages.1.provider')
    expect(historyResponse.body).not.toHaveProperty('messages.1.model')
    expect(historyResponse.body).not.toHaveProperty('messages.1.inputTokens')
    expect(historyResponse.body).not.toHaveProperty('messages.1.outputTokens')

    await request(app.getHttpServer())
      .delete(`${sessionPath()}/${created.id}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(204)

    const listAfterDelete = await request(app.getHttpServer())
      .get(sessionPath())
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(200)
    expect(listAfterDelete.body).toEqual({ sessions: [], nextCursor: null })

    const deletedRow = await prisma.chatSession.findUniqueOrThrow({
      where: { id: created.id },
      select: { deletedAt: true },
    })
    expect(deletedRow.deletedAt).toBeInstanceOf(Date)
    await expect(
      prisma.message.count({ where: { sessionId: created.id } }),
    ).resolves.toBe(2)

    const deletionAudits = await prisma.auditLog.findMany({
      where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_DELETED },
    })
    expect(deletionAudits).toHaveLength(1)
    expect(deletionAudits[0]).toMatchObject({
      actorUserId: student1.id,
      action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_DELETED,
      targetType: AUDIT_TARGET_TYPES.CHAT_SESSION,
      targetId: created.id,
      courseId: pythonCourseId,
      metadata: {},
    })
  })
})
