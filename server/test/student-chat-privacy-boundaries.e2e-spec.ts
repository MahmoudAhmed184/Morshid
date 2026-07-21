import { randomUUID } from 'node:crypto'

import { HttpException, type INestApplication } from '@nestjs/common'
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
import { STUDENT_CHAT_ERROR_CODES } from '../src/modules/student-chat/student-chat.errors'
import { StudentChatService } from '../src/modules/student-chat/student-chat.service'
import {
  P0_DEMO_PASSWORD,
  P0_HIDDEN_ISOLATION_COURSE,
  seedP0DemoData,
  type P0DemoSeedResult,
} from '../src/seeds/p0-demo.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'
import { NoopMaterialProcessingScheduler } from './support/noop-material-processing-scheduler'

const STUDENT_1_EMAIL = 'student1@morshid.demo'
const STUDENT_2_EMAIL = 'student2@morshid.demo'
const UNASSIGNED_STUDENT_EMAIL = 'student3@morshid.demo'

const OWNER_PRIVATE_TITLE = 'Issue 86 owner private Python session'
const RENAMED_PRIVATE_TITLE = 'Issue 86 renamed private Python session'
const OWNER_PRIVATE_MESSAGE = 'Student secret: my loop fails after iteration 4'
const ASSISTANT_PRIVATE_MESSAGE = 'Assistant secret: inspect the loop condition'
const FOREIGN_PRIVATE_TITLE = 'Issue 86 other Student private session'
const DENIED_APPEND_CONTENT = 'Denied append secret that must not persist'

const SESSION_NOT_FOUND_ERROR = {
  code: STUDENT_CHAT_ERROR_CODES.SESSION_NOT_FOUND,
  message: 'Chat session was not found',
} as const

const MEMBERSHIP_REQUIRED_ERROR = {
  code: STUDENT_CHAT_ERROR_CODES.ACTIVE_STUDENT_MEMBERSHIP_REQUIRED,
  message: 'Active student course membership is required',
} as const

const FOREIGN_OPERATIONS = ['get', 'rename', 'delete', 'history'] as const
type ForeignOperation = (typeof FOREIGN_OPERATIONS)[number]

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
  let hiddenCourseId: string
  let student1: SeededActor
  let student2: SeededActor
  let unassignedStudent: SeededActor
  let student1Token: string
  let student2Token: string
  let unassignedStudentToken: string

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue86')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    pythonCourseId = seed.courses.pythonProgramming.id
    hiddenCourseId = seed.courses.hiddenIsolation.id
    student1 = requireSeededActor(STUDENT_1_EMAIL)
    student2 = requireSeededActor(STUDENT_2_EMAIL)
    unassignedStudent = requireSeededActor(UNASSIGNED_STUDENT_EMAIL)

    await prisma.courseMembership.update({
      where: {
        courseId_userId: {
          courseId: pythonCourseId,
          userId: unassignedStudent.id,
        },
      },
      data: { removedAt: new Date() },
    })

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
    student2Token = await signInAs(STUDENT_2_EMAIL)
    unassignedStudentToken = await signInAs(UNASSIGNED_STUDENT_EMAIL)
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

  async function createSession(
    token: string,
    title: string,
  ): Promise<ChatSessionResponseDto['session']> {
    const response = await request(app.getHttpServer())
      .post(sessionPath())
      .set('Authorization', `Bearer ${token}`)
      .send({ title })
      .expect(201)

    return (response.body as ChatSessionResponseDto).session
  }

  function expectSafeErrorBody(
    body: unknown,
    expected: Readonly<{ code: string; message: string }>,
    secrets: readonly string[],
  ): void {
    expect(body).toEqual(expected)
    expect(Object.keys(body as Record<string, unknown>).sort()).toEqual([
      'code',
      'message',
    ])

    const serialized = JSON.stringify(body)
    for (const secret of secrets) {
      expect(serialized).not.toContain(secret)
    }
  }

  function expectAuditRecordsContentFree(records: readonly unknown[]): void {
    const serialized = JSON.stringify(records)

    for (const secret of [
      OWNER_PRIVATE_TITLE,
      RENAMED_PRIVATE_TITLE,
      OWNER_PRIVATE_MESSAGE,
      ASSISTANT_PRIVATE_MESSAGE,
      FOREIGN_PRIVATE_TITLE,
      DENIED_APPEND_CONTENT,
      P0_HIDDEN_ISOLATION_COURSE.title,
      'issue-86-provider-secret',
      'issue-86-model-secret',
    ]) {
      expect(serialized).not.toContain(secret)
    }
    expect(serialized).not.toContain('inputTokens')
    expect(serialized).not.toContain('outputTokens')
  }

  async function readExactChatState() {
    const [sessions, messages, sessionCount, messageCount] = await Promise.all([
      prisma.chatSession.findMany({ orderBy: { id: 'asc' } }),
      prisma.message.findMany({
        orderBy: [{ sessionId: 'asc' }, { sequence: 'asc' }],
      }),
      prisma.chatSession.count(),
      prisma.message.count(),
    ])

    return { sessions, messages, sessionCount, messageCount }
  }

  async function attemptForeignOperation(
    operation: ForeignOperation,
    sessionId: string,
  ) {
    const authorization = `Bearer ${student2Token}`
    const path = `${sessionPath()}/${sessionId}`

    switch (operation) {
      case 'get':
        return request(app.getHttpServer())
          .get(path)
          .set('Authorization', authorization)
          .expect(404)
      case 'rename':
        return request(app.getHttpServer())
          .patch(path)
          .set('Authorization', authorization)
          .send({ title: 'Attempted foreign rename' })
          .expect(404)
      case 'delete':
        return request(app.getHttpServer())
          .delete(path)
          .set('Authorization', authorization)
          .expect(404)
      case 'history':
        return request(app.getHttpServer())
          .get(`${path}/messages`)
          .set('Authorization', authorization)
          .expect(404)
    }
  }

  async function expectTrustedAppendDenied(
    append: Promise<unknown>,
    status: number,
    expected: Readonly<{ code: string; message: string }>,
    secrets: readonly string[],
  ): Promise<void> {
    try {
      await append
      throw new Error('Expected the trusted append to be denied')
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException)
      const exception = error as HttpException
      expect(exception.getStatus()).toBe(status)
      expectSafeErrorBody(exception.getResponse(), expected, secrets)
    }
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
    expectAuditRecordsContentFree(deletionAudits)
  })

  it('keeps each Student list limited to sessions they own', async () => {
    const student1Session = await createSession(
      student1Token,
      OWNER_PRIVATE_TITLE,
    )
    const student2Session = await createSession(
      student2Token,
      FOREIGN_PRIVATE_TITLE,
    )

    const student1List = await request(app.getHttpServer())
      .get(sessionPath())
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(200)
    const student2List = await request(app.getHttpServer())
      .get(sessionPath())
      .set('Authorization', `Bearer ${student2Token}`)
      .expect(200)

    expect(student1List.body).toEqual({
      sessions: [student1Session],
      nextCursor: null,
    })
    expect(student2List.body).toEqual({
      sessions: [student2Session],
      nextCursor: null,
    })
    expect(JSON.stringify(student1List.body)).not.toContain(student2Session.id)
    expect(JSON.stringify(student1List.body)).not.toContain(
      FOREIGN_PRIVATE_TITLE,
    )
    expect(JSON.stringify(student2List.body)).not.toContain(student1Session.id)
    expect(JSON.stringify(student2List.body)).not.toContain(OWNER_PRIVATE_TITLE)
  })

  it.each(FOREIGN_OPERATIONS)(
    'conceals a foreign %s as the same 404 returned for a guessed UUID',
    async (operation) => {
      const ownerSession = await createSession(
        student1Token,
        OWNER_PRIVATE_TITLE,
      )
      await chatService.appendStudentMessage({
        courseId: pythonCourseId,
        sessionId: ownerSession.id,
        studentId: student1.id,
        content: OWNER_PRIVATE_MESSAGE,
      })
      await prisma.auditLog.deleteMany()
      const before = await readExactChatState()
      const guessedSessionId = randomUUID()

      const foreignResponse = await attemptForeignOperation(
        operation,
        ownerSession.id,
      )
      const guessedResponse = await attemptForeignOperation(
        operation,
        guessedSessionId,
      )

      const secrets = [
        ownerSession.id,
        guessedSessionId,
        OWNER_PRIVATE_TITLE,
        OWNER_PRIVATE_MESSAGE,
        student1.id,
        student1.email,
      ]
      expectSafeErrorBody(
        foreignResponse.body,
        SESSION_NOT_FOUND_ERROR,
        secrets,
      )
      expectSafeErrorBody(
        guessedResponse.body,
        SESSION_NOT_FOUND_ERROR,
        secrets,
      )
      await expect(readExactChatState()).resolves.toEqual(before)

      const denials = await prisma.auditLog.findMany({
        where: {
          actorUserId: student2.id,
          action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED,
        },
        orderBy: { createdAt: 'asc' },
      })
      expect(denials).toHaveLength(2)
      expect(denials.map((denial) => denial.targetId)).toEqual([
        ownerSession.id,
        guessedSessionId,
      ])
      expect(denials.map((denial) => denial.metadata)).toEqual([
        { reason: 'DELETED_OR_UNOWNED' },
        { reason: 'DELETED_OR_UNOWNED' },
      ])
      expectAuditRecordsContentFree(denials)
    },
  )

  it('denies unassigned and hidden-course HTTP requests without creating sessions', async () => {
    const chatStateBefore = await readExactChatState()
    const attempts = [
      () =>
        request(app.getHttpServer())
          .post(sessionPath())
          .set('Authorization', `Bearer ${unassignedStudentToken}`)
          .send({ title: DENIED_APPEND_CONTENT }),
      () =>
        request(app.getHttpServer())
          .get(sessionPath())
          .set('Authorization', `Bearer ${unassignedStudentToken}`),
      () =>
        request(app.getHttpServer())
          .post(sessionPath(hiddenCourseId))
          .set('Authorization', `Bearer ${student1Token}`)
          .send({ title: DENIED_APPEND_CONTENT }),
      () =>
        request(app.getHttpServer())
          .get(sessionPath(hiddenCourseId))
          .set('Authorization', `Bearer ${student1Token}`),
    ]

    for (const attempt of attempts) {
      const response = await attempt().expect(403)
      expectSafeErrorBody(response.body, MEMBERSHIP_REQUIRED_ERROR, [
        DENIED_APPEND_CONTENT,
        P0_HIDDEN_ISOLATION_COURSE.title,
        hiddenCourseId,
        student1.id,
        student1.email,
        unassignedStudent.id,
        unassignedStudent.email,
      ])
    }

    await expect(readExactChatState()).resolves.toEqual(chatStateBefore)

    const chatDenials = await prisma.auditLog.findMany({
      where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED },
      orderBy: { createdAt: 'asc' },
    })
    const courseBoundaryDenials = await prisma.auditLog.findMany({
      where: { action: AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED },
      orderBy: { createdAt: 'asc' },
    })
    expect(chatDenials).toHaveLength(4)
    expect(chatDenials.map((denial) => denial.metadata)).toEqual([
      { reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED' },
      { reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED' },
      { reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED' },
      { reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED' },
    ])
    expect(chatDenials.map((denial) => denial.actorUserId)).toEqual([
      unassignedStudent.id,
      unassignedStudent.id,
      student1.id,
      student1.id,
    ])
    expect(chatDenials.map((denial) => denial.courseId)).toEqual([
      pythonCourseId,
      pythonCourseId,
      hiddenCourseId,
      hiddenCourseId,
    ])
    expect(courseBoundaryDenials).toHaveLength(4)
    expect(courseBoundaryDenials.map((denial) => denial.targetId)).toEqual([
      pythonCourseId,
      pythonCourseId,
      hiddenCourseId,
      hiddenCourseId,
    ])
    expect(courseBoundaryDenials.map((denial) => denial.actorUserId)).toEqual([
      unassignedStudent.id,
      unassignedStudent.id,
      student1.id,
      student1.id,
    ])
    expect(
      courseBoundaryDenials.map(
        (denial) => (denial.metadata as { operation: string }).operation,
      ),
    ).toEqual([
      expect.stringMatching(/^POST .*chat-sessions$/),
      expect.stringMatching(/^GET .*chat-sessions$/),
      expect.stringMatching(/^POST .*chat-sessions$/),
      expect.stringMatching(/^GET .*chat-sessions$/),
    ])
    expectAuditRecordsContentFree([...chatDenials, ...courseBoundaryDenials])
  })

  it('rejects foreign, wrong-course, and unassigned trusted appends without changing chat rows', async () => {
    const ownerSession = await createSession(student1Token, OWNER_PRIVATE_TITLE)
    await prisma.auditLog.deleteMany()
    const unchanged = await readExactChatState()

    await expectTrustedAppendDenied(
      chatService.appendStudentMessage({
        courseId: pythonCourseId,
        sessionId: ownerSession.id,
        studentId: student2.id,
        content: DENIED_APPEND_CONTENT,
      }),
      404,
      SESSION_NOT_FOUND_ERROR,
      [
        ownerSession.id,
        OWNER_PRIVATE_TITLE,
        DENIED_APPEND_CONTENT,
        student1.id,
      ],
    )
    await expect(readExactChatState()).resolves.toEqual(unchanged)

    await expectTrustedAppendDenied(
      chatService.appendPendingAssistantMessage({
        courseId: hiddenCourseId,
        sessionId: ownerSession.id,
        studentId: student1.id,
        content: DENIED_APPEND_CONTENT,
      }),
      403,
      MEMBERSHIP_REQUIRED_ERROR,
      [
        ownerSession.id,
        OWNER_PRIVATE_TITLE,
        DENIED_APPEND_CONTENT,
        P0_HIDDEN_ISOLATION_COURSE.title,
      ],
    )
    await expect(readExactChatState()).resolves.toEqual(unchanged)

    await expectTrustedAppendDenied(
      chatService.appendStudentMessage({
        courseId: pythonCourseId,
        sessionId: ownerSession.id,
        studentId: unassignedStudent.id,
        content: DENIED_APPEND_CONTENT,
      }),
      403,
      MEMBERSHIP_REQUIRED_ERROR,
      [
        ownerSession.id,
        OWNER_PRIVATE_TITLE,
        DENIED_APPEND_CONTENT,
        student1.id,
      ],
    )
    await expect(readExactChatState()).resolves.toEqual(unchanged)

    const denials = await prisma.auditLog.findMany({
      where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED },
      orderBy: { createdAt: 'asc' },
    })
    expect(denials).toHaveLength(3)
    expect(denials.map((denial) => denial.metadata)).toEqual([
      { reason: 'DELETED_OR_UNOWNED' },
      { reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED' },
      { reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED' },
    ])
    expect(denials.map((denial) => denial.targetId)).toEqual([
      ownerSession.id,
      null,
      null,
    ])
    expect(denials.map((denial) => denial.actorUserId)).toEqual([
      student2.id,
      student1.id,
      unassignedStudent.id,
    ])
    expect(denials.map((denial) => denial.courseId)).toEqual([
      pythonCourseId,
      hiddenCourseId,
      pythonCourseId,
    ])
    expectAuditRecordsContentFree(denials)
  })
})
