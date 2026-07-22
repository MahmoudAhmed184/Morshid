import { randomUUID } from 'node:crypto'

import { HttpException, type INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { CourseMembershipRole } from '../src/generated/prisma/client'
import {
  AUTH_ERROR_CODES,
  type AuthSessionResponse,
} from '../src/modules/auth/auth.dto'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../src/modules/audit/audit.constants'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import type {
  ChatMessageDto,
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
const INSTRUCTOR_EMAIL = 'instructor@morshid.demo'

const OWNER_PRIVATE_TITLE = 'Issue 86 owner private Python session'
const RENAMED_PRIVATE_TITLE = 'Issue 86 renamed private Python session'
const OWNER_PRIVATE_MESSAGE = 'Student secret: my loop fails after iteration 4'
const ASSISTANT_PRIVATE_MESSAGE = 'Assistant secret: inspect the loop condition'
const FOREIGN_PRIVATE_TITLE = 'Issue 86 other Student private session'
const SPOOFED_OWNER_TITLE = 'Issue 86 spoofed owner session'
const DENIED_SESSION_TITLE = 'Denied session title that must not persist'
const DENIED_RENAME_TITLE = 'Attempted private-session rename'
const DENIED_STUDENT_MESSAGE = 'Denied Student message that must not persist'
const DENIED_PENDING_MESSAGE = 'Denied pending answer that must not persist'
const DENIED_COMPLETION_MESSAGE =
  'Denied completed answer that must not persist'
const DENIED_FAILURE_MESSAGE = 'Denied failure detail that must not persist'
const DENIED_PROVIDER = 'issue-86-denied-provider-secret'
const DENIED_MODEL = 'issue-86-denied-model-secret'
const DENIED_PROMPT_VERSION = 'issue-86-denied-prompt-secret'

const AUDIT_FORBIDDEN_VALUES = [
  OWNER_PRIVATE_TITLE,
  RENAMED_PRIVATE_TITLE,
  OWNER_PRIVATE_MESSAGE,
  ASSISTANT_PRIVATE_MESSAGE,
  FOREIGN_PRIVATE_TITLE,
  SPOOFED_OWNER_TITLE,
  DENIED_SESSION_TITLE,
  DENIED_RENAME_TITLE,
  DENIED_STUDENT_MESSAGE,
  DENIED_PENDING_MESSAGE,
  DENIED_COMPLETION_MESSAGE,
  DENIED_FAILURE_MESSAGE,
  P0_HIDDEN_ISOLATION_COURSE.title,
  'issue-86-provider-secret',
  'issue-86-model-secret',
  DENIED_PROVIDER,
  DENIED_MODEL,
  DENIED_PROMPT_VERSION,
] as const

const SESSION_NOT_FOUND_ERROR = {
  code: STUDENT_CHAT_ERROR_CODES.SESSION_NOT_FOUND,
  message: 'Chat session was not found',
} as const

const MEMBERSHIP_REQUIRED_ERROR = {
  code: STUDENT_CHAT_ERROR_CODES.ACTIVE_STUDENT_MEMBERSHIP_REQUIRED,
  message: 'Active student course membership is required',
} as const

const INSUFFICIENT_ROLE_ERROR = {
  code: AUTH_ERROR_CODES.INSUFFICIENT_ROLE,
  message: 'Insufficient role',
} as const

const HTTP_OPERATIONS = [
  'create',
  'list',
  'get',
  'rename',
  'delete',
  'history',
] as const
type HttpOperation = (typeof HTTP_OPERATIONS)[number]

const SESSION_OPERATIONS = ['get', 'rename', 'delete', 'history'] as const
const UNASSIGNED_OPERATIONS = HTTP_OPERATIONS
const INSTRUCTOR_OPERATIONS = HTTP_OPERATIONS
const CROSS_COURSE_HTTP_OPERATIONS = SESSION_OPERATIONS
const DELETED_HTTP_OPERATIONS = ['get', 'rename', 'history'] as const

const TRUSTED_WRITE_OPERATIONS = [
  'append-student',
  'append-pending',
  'complete-assistant',
  'fail-assistant',
  'block-assistant',
] as const
type TrustedWriteOperation = (typeof TRUSTED_WRITE_OPERATIONS)[number]

const HTTP_METHODS: Readonly<Record<HttpOperation, string>> = {
  create: 'POST',
  list: 'GET',
  get: 'GET',
  rename: 'PATCH',
  delete: 'DELETE',
  history: 'GET',
}

interface SeededActor {
  id: string
  email: string
}

describe('Student chat ownership and privacy boundaries (e2e)', () => {
  let app: INestApplication<App> | undefined
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let chatService: StudentChatService
  let seed: P0DemoSeedResult
  let pythonCourseId: string
  let hiddenCourseId: string
  let student1: SeededActor
  let student2: SeededActor
  let unassignedStudent: SeededActor
  let instructor: SeededActor
  let student1Token: string
  let student2Token: string
  let unassignedStudentToken: string
  let instructorToken: string

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue86')
    prisma = database.prisma
    seed = await seedP0DemoData(prisma)
    pythonCourseId = seed.courses.pythonProgramming.id
    hiddenCourseId = seed.courses.hiddenIsolation.id
    student1 = requireSeededActor(STUDENT_1_EMAIL)
    student2 = requireSeededActor(STUDENT_2_EMAIL)
    unassignedStudent = requireSeededActor(UNASSIGNED_STUDENT_EMAIL)
    instructor = requireSeededActor(INSTRUCTOR_EMAIL)

    await prisma.courseMembership.create({
      data: {
        courseId: hiddenCourseId,
        userId: student1.id,
        role: CourseMembershipRole.STUDENT,
      },
    })

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
    instructorToken = await signInAs(INSTRUCTOR_EMAIL)
  })

  beforeEach(async () => {
    await prisma.auditLog.deleteMany()
    await prisma.message.deleteMany()
    await prisma.chatSession.deleteMany()
  })

  afterAll(async () => {
    try {
      await app?.close()
    } finally {
      await database?.dispose()
    }
  })

  function requireApp(): INestApplication<App> {
    if (app === undefined) {
      throw new Error('Expected the test application to be initialized')
    }

    return app
  }

  function requireSeededActor(email: string): SeededActor {
    const actor = seed.users.find((user) => user.email === email)

    if (actor === undefined) {
      throw new Error(`Expected the P0 seed to contain ${email}`)
    }

    return actor
  }

  async function signInAs(email: string): Promise<string> {
    const response = await request(requireApp().getHttpServer())
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
    const response = await request(requireApp().getHttpServer())
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

    for (const secret of AUDIT_FORBIDDEN_VALUES) {
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

  async function createOwnerChatFixture(
    options: Readonly<{ withPendingAssistant?: boolean }> = {},
  ) {
    const session = await createSession(student1Token, OWNER_PRIVATE_TITLE)
    const studentMessage = await chatService.appendStudentMessage({
      courseId: pythonCourseId,
      sessionId: session.id,
      studentId: student1.id,
      content: OWNER_PRIVATE_MESSAGE,
    })
    const pendingAssistant =
      options.withPendingAssistant === true
        ? await chatService.appendPendingAssistantMessage({
            courseId: pythonCourseId,
            sessionId: session.id,
            studentId: student1.id,
            responseToMessageId: studentMessage.id,
          })
        : undefined

    await prisma.auditLog.deleteMany()

    return {
      session,
      studentMessage,
      pendingAssistant,
      unchanged: await readExactChatState(),
    }
  }

  async function createDeletedOwnerChatFixture() {
    const fixture = await createOwnerChatFixture({ withPendingAssistant: true })

    await request(requireApp().getHttpServer())
      .delete(`${sessionPath()}/${fixture.session.id}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(204)

    return { ...fixture, unchanged: await readExactChatState() }
  }

  function ownerPrivateValues(
    fixture: Awaited<ReturnType<typeof createOwnerChatFixture>>,
    ...additional: string[]
  ): string[] {
    return [
      fixture.session.id,
      OWNER_PRIVATE_TITLE,
      OWNER_PRIVATE_MESSAGE,
      student1.id,
      student1.email,
      ...additional,
    ]
  }

  async function attemptHttpOperation(
    operation: HttpOperation,
    input: Readonly<{
      token: string
      courseId: string
      sessionId: string
      expectedStatus: number
    }>,
  ) {
    const authorization = `Bearer ${input.token}`
    const collectionPath = sessionPath(input.courseId)
    const resourcePath = `${collectionPath}/${input.sessionId}`

    switch (operation) {
      case 'create':
        return request(requireApp().getHttpServer())
          .post(collectionPath)
          .set('Authorization', authorization)
          .send({ title: DENIED_SESSION_TITLE })
          .expect(input.expectedStatus)
      case 'list':
        return request(requireApp().getHttpServer())
          .get(collectionPath)
          .set('Authorization', authorization)
          .expect(input.expectedStatus)
      case 'get':
        return request(requireApp().getHttpServer())
          .get(resourcePath)
          .set('Authorization', authorization)
          .expect(input.expectedStatus)
      case 'rename':
        return request(requireApp().getHttpServer())
          .patch(resourcePath)
          .set('Authorization', authorization)
          .send({ title: DENIED_RENAME_TITLE })
          .expect(input.expectedStatus)
      case 'delete':
        return request(requireApp().getHttpServer())
          .delete(resourcePath)
          .set('Authorization', authorization)
          .expect(input.expectedStatus)
      case 'history':
        return request(requireApp().getHttpServer())
          .get(`${resourcePath}/messages`)
          .set('Authorization', authorization)
          .expect(input.expectedStatus)
    }
  }

  function attemptTrustedWrite(
    operation: TrustedWriteOperation,
    input: Readonly<{
      courseId: string
      studentId: string
      fixture: Awaited<ReturnType<typeof createOwnerChatFixture>>
    }>,
  ): Promise<ChatMessageDto> {
    const { courseId, studentId, fixture } = input
    const pendingAssistant = fixture.pendingAssistant

    if (pendingAssistant === undefined) {
      throw new Error('Expected a pending assistant message in the fixture')
    }

    switch (operation) {
      case 'append-student':
        return chatService.appendStudentMessage({
          courseId,
          sessionId: fixture.session.id,
          studentId,
          content: DENIED_STUDENT_MESSAGE,
        })
      case 'append-pending':
        return chatService.appendPendingAssistantMessage({
          courseId,
          sessionId: fixture.session.id,
          studentId,
          responseToMessageId: fixture.studentMessage.id,
          content: DENIED_PENDING_MESSAGE,
        })
      case 'complete-assistant':
        return chatService.completeAssistantMessage({
          courseId,
          sessionId: fixture.session.id,
          studentId,
          messageId: pendingAssistant.id,
          content: DENIED_COMPLETION_MESSAGE,
          provider: DENIED_PROVIDER,
          model: DENIED_MODEL,
          promptVersion: DENIED_PROMPT_VERSION,
          inputTokens: 101,
          outputTokens: 202,
        })
      case 'fail-assistant':
        return chatService.failAssistantMessage({
          courseId,
          sessionId: fixture.session.id,
          studentId,
          messageId: pendingAssistant.id,
          errorCode: 'ISSUE_86_DENIED_FAILURE',
          safeErrorMessage: DENIED_FAILURE_MESSAGE,
        })
      case 'block-assistant':
        return chatService.blockAssistantMessage({
          courseId,
          sessionId: fixture.session.id,
          studentId,
          messageId: pendingAssistant.id,
          errorCode: 'ISSUE_86_DENIED_BLOCK',
        })
    }
  }

  async function expectTrustedWriteDenied(
    write: Promise<unknown>,
    status: number,
    expected: Readonly<{ code: string; message: string }>,
    secrets: readonly string[],
  ): Promise<void> {
    try {
      await write
      throw new Error('Expected the trusted write to be denied')
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException)
      const exception = error as HttpException
      expect(exception.getStatus()).toBe(status)
      expectSafeErrorBody(exception.getResponse(), expected, secrets)
    }
  }

  it('lets an owner complete the private session lifecycle and read ordered history', async () => {
    const createResponse = await request(requireApp().getHttpServer())
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

    const listResponse = await request(requireApp().getHttpServer())
      .get(sessionPath())
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(200)
    expect((listResponse.body as ChatSessionListResponseDto).sessions).toEqual([
      created,
    ])

    await request(requireApp().getHttpServer())
      .get(`${sessionPath()}/${created.id}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(200)
      .expect({ session: created })

    const renameResponse = await request(requireApp().getHttpServer())
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

    const historyResponse = await request(requireApp().getHttpServer())
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

    await request(requireApp().getHttpServer())
      .delete(`${sessionPath()}/${created.id}`)
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(204)

    const listAfterDelete = await request(requireApp().getHttpServer())
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

  it('rejects client-supplied ownership and course fields without creating a session', async () => {
    const unchanged = await readExactChatState()

    const response = await request(requireApp().getHttpServer())
      .post(sessionPath())
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        title: SPOOFED_OWNER_TITLE,
        studentId: student2.id,
        courseId: hiddenCourseId,
      })
      .expect(400)

    expect(response.body).toMatchObject({
      code: STUDENT_CHAT_ERROR_CODES.INVALID_REQUEST,
      message: 'Invalid student chat request',
    })
    const validationErrors = (response.body as { errors?: unknown }).errors
    expect(Array.isArray(validationErrors)).toBe(true)
    expect(validationErrors as unknown[]).not.toHaveLength(0)
    const serialized = JSON.stringify(response.body)
    for (const secret of [
      SPOOFED_OWNER_TITLE,
      student2.id,
      student2.email,
      hiddenCourseId,
      P0_HIDDEN_ISOLATION_COURSE.title,
    ]) {
      expect(serialized).not.toContain(secret)
    }
    await expect(readExactChatState()).resolves.toEqual(unchanged)

    const auditRecords = await prisma.auditLog.findMany()
    expect(auditRecords).toHaveLength(0)
    expectAuditRecordsContentFree(auditRecords)
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

    const student1List = await request(requireApp().getHttpServer())
      .get(sessionPath())
      .set('Authorization', `Bearer ${student1Token}`)
      .expect(200)
    const student2List = await request(requireApp().getHttpServer())
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

  it.each(SESSION_OPERATIONS)(
    'conceals a foreign %s as the same 404 returned for a guessed UUID',
    async (operation) => {
      const fixture = await createOwnerChatFixture()
      const guessedSessionId = randomUUID()

      const foreignResponse = await attemptHttpOperation(operation, {
        token: student2Token,
        courseId: pythonCourseId,
        sessionId: fixture.session.id,
        expectedStatus: 404,
      })
      const guessedResponse = await attemptHttpOperation(operation, {
        token: student2Token,
        courseId: pythonCourseId,
        sessionId: guessedSessionId,
        expectedStatus: 404,
      })

      const secrets = ownerPrivateValues(
        fixture,
        guessedSessionId,
        DENIED_RENAME_TITLE,
      )
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
      await expect(readExactChatState()).resolves.toEqual(fixture.unchanged)

      const denials = await prisma.auditLog.findMany({
        where: {
          actorUserId: student2.id,
          action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED,
        },
        orderBy: { createdAt: 'asc' },
      })
      expect(denials).toHaveLength(2)
      expect(denials.map((denial) => denial.targetId)).toEqual([
        fixture.session.id,
        guessedSessionId,
      ])
      expect(denials.map((denial) => denial.metadata)).toEqual([
        { reason: 'DELETED_OR_UNOWNED' },
        { reason: 'DELETED_OR_UNOWNED' },
      ])
      expectAuditRecordsContentFree(denials)
    },
  )

  it.each(CROSS_COURSE_HTTP_OPERATIONS)(
    'conceals a Python session from enrolled cross-course HTTP %s',
    async (operation) => {
      const fixture = await createOwnerChatFixture()

      const response = await attemptHttpOperation(operation, {
        token: student1Token,
        courseId: hiddenCourseId,
        sessionId: fixture.session.id,
        expectedStatus: 404,
      })

      expectSafeErrorBody(
        response.body,
        SESSION_NOT_FOUND_ERROR,
        ownerPrivateValues(
          fixture,
          DENIED_RENAME_TITLE,
          P0_HIDDEN_ISOLATION_COURSE.title,
        ),
      )
      await expect(readExactChatState()).resolves.toEqual(fixture.unchanged)

      const denials = await prisma.auditLog.findMany({
        where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED },
      })
      expect(denials).toHaveLength(1)
      expect(denials[0]).toMatchObject({
        actorUserId: student1.id,
        targetId: fixture.session.id,
        courseId: hiddenCourseId,
        metadata: { reason: 'DELETED_OR_UNOWNED' },
      })
      expectAuditRecordsContentFree(denials)
    },
  )

  it.each(TRUSTED_WRITE_OPERATIONS)(
    'denies enrolled cross-course trusted %s without changing chat rows',
    async (operation) => {
      const fixture = await createOwnerChatFixture({
        withPendingAssistant: true,
      })

      await expectTrustedWriteDenied(
        attemptTrustedWrite(operation, {
          courseId: hiddenCourseId,
          studentId: student1.id,
          fixture,
        }),
        404,
        SESSION_NOT_FOUND_ERROR,
        ownerPrivateValues(
          fixture,
          P0_HIDDEN_ISOLATION_COURSE.title,
          DENIED_STUDENT_MESSAGE,
          DENIED_PENDING_MESSAGE,
          DENIED_COMPLETION_MESSAGE,
          DENIED_FAILURE_MESSAGE,
        ),
      )
      await expect(readExactChatState()).resolves.toEqual(fixture.unchanged)

      const denials = await prisma.auditLog.findMany({
        where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED },
      })
      expect(denials).toHaveLength(1)
      expect(denials[0]).toMatchObject({
        actorUserId: student1.id,
        targetId: fixture.session.id,
        courseId: hiddenCourseId,
        metadata: { reason: 'DELETED_OR_UNOWNED' },
      })
      expectAuditRecordsContentFree(denials)
    },
  )

  it.each(UNASSIGNED_OPERATIONS)(
    'denies unassigned Student HTTP %s without changing chat rows',
    async (operation) => {
      const fixture = await createOwnerChatFixture()

      const response = await attemptHttpOperation(operation, {
        token: unassignedStudentToken,
        courseId: pythonCourseId,
        sessionId: fixture.session.id,
        expectedStatus: 403,
      })

      expectSafeErrorBody(
        response.body,
        MEMBERSHIP_REQUIRED_ERROR,
        ownerPrivateValues(
          fixture,
          DENIED_SESSION_TITLE,
          DENIED_RENAME_TITLE,
          unassignedStudent.id,
          unassignedStudent.email,
        ),
      )
      await expect(readExactChatState()).resolves.toEqual(fixture.unchanged)

      const chatDenials = await prisma.auditLog.findMany({
        where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED },
      })
      const courseBoundaryDenials = await prisma.auditLog.findMany({
        where: { action: AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED },
      })
      expect(chatDenials).toHaveLength(1)
      expect(chatDenials[0]).toMatchObject({
        actorUserId: unassignedStudent.id,
        targetId: null,
        courseId: pythonCourseId,
        metadata: { reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED' },
      })
      expect(courseBoundaryDenials).toHaveLength(1)
      expect(courseBoundaryDenials[0]).toMatchObject({
        actorUserId: unassignedStudent.id,
        targetId: pythonCourseId,
        courseId: pythonCourseId,
      })
      const boundaryMetadata = courseBoundaryDenials[0]?.metadata as {
        operation?: unknown
      }
      expect(typeof boundaryMetadata.operation).toBe('string')
      expect(
        new RegExp(`^${HTTP_METHODS[operation]} .*chat-sessions`).test(
          boundaryMetadata.operation as string,
        ),
      ).toBe(true)
      expectAuditRecordsContentFree([...chatDenials, ...courseBoundaryDenials])
    },
  )

  it('rejects foreign and unassigned trusted Student appends without changing chat rows', async () => {
    const fixture = await createOwnerChatFixture()

    await expectTrustedWriteDenied(
      chatService.appendStudentMessage({
        courseId: pythonCourseId,
        sessionId: fixture.session.id,
        studentId: student2.id,
        content: DENIED_STUDENT_MESSAGE,
      }),
      404,
      SESSION_NOT_FOUND_ERROR,
      ownerPrivateValues(fixture, DENIED_STUDENT_MESSAGE),
    )
    await expect(readExactChatState()).resolves.toEqual(fixture.unchanged)

    await expectTrustedWriteDenied(
      chatService.appendStudentMessage({
        courseId: pythonCourseId,
        sessionId: fixture.session.id,
        studentId: unassignedStudent.id,
        content: DENIED_STUDENT_MESSAGE,
      }),
      403,
      MEMBERSHIP_REQUIRED_ERROR,
      ownerPrivateValues(
        fixture,
        DENIED_STUDENT_MESSAGE,
        unassignedStudent.id,
        unassignedStudent.email,
      ),
    )
    await expect(readExactChatState()).resolves.toEqual(fixture.unchanged)

    const denials = await prisma.auditLog.findMany({
      where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED },
      orderBy: { createdAt: 'asc' },
    })
    expect(denials).toHaveLength(2)
    expect(denials.map((denial) => denial.metadata)).toEqual([
      { reason: 'DELETED_OR_UNOWNED' },
      { reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED' },
    ])
    expect(denials.map((denial) => denial.targetId)).toEqual([
      fixture.session.id,
      null,
    ])
    expect(denials.map((denial) => denial.actorUserId)).toEqual([
      student2.id,
      unassignedStudent.id,
    ])
    expect(denials.map((denial) => denial.courseId)).toEqual([
      pythonCourseId,
      pythonCourseId,
    ])
    expectAuditRecordsContentFree(denials)
  })

  it.each(INSTRUCTOR_OPERATIONS)(
    'denies Instructor %s with one global RBAC audit and no chat exception',
    async (operation) => {
      const fixture = await createOwnerChatFixture()

      const response = await attemptHttpOperation(operation, {
        token: instructorToken,
        courseId: pythonCourseId,
        sessionId: fixture.session.id,
        expectedStatus: 403,
      })

      expectSafeErrorBody(
        response.body,
        INSUFFICIENT_ROLE_ERROR,
        ownerPrivateValues(
          fixture,
          DENIED_SESSION_TITLE,
          DENIED_RENAME_TITLE,
          pythonCourseId,
        ),
      )
      await expect(readExactChatState()).resolves.toEqual(fixture.unchanged)

      const rbacDenials = await prisma.auditLog.findMany({
        where: { action: AUDIT_EVENT_ACTIONS.ACCESS_RBAC_DENIED },
      })
      const chatDenials = await prisma.auditLog.findMany({
        where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED },
      })
      const courseBoundaryDenials = await prisma.auditLog.findMany({
        where: { action: AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED },
      })

      expect(rbacDenials).toHaveLength(1)
      expect(rbacDenials[0]).toMatchObject({
        actorUserId: instructor.id,
        action: AUDIT_EVENT_ACTIONS.ACCESS_RBAC_DENIED,
        targetType: AUDIT_TARGET_TYPES.SYSTEM,
        targetId: null,
        courseId: null,
        metadata: {
          requiredRoles: ['STUDENT'],
          actorRole: 'INSTRUCTOR',
          method: HTTP_METHODS[operation],
          unverifiedCourseId: pythonCourseId,
        },
      })
      expect(chatDenials).toHaveLength(0)
      expect(courseBoundaryDenials).toHaveLength(0)
      expectAuditRecordsContentFree(rbacDenials)
    },
  )

  it.each(DELETED_HTTP_OPERATIONS)(
    'conceals a deleted session from owner HTTP %s',
    async (operation) => {
      const fixture = await createDeletedOwnerChatFixture()

      expect(fixture.unchanged.sessions).toHaveLength(1)
      expect(fixture.unchanged.sessions[0]?.deletedAt).toBeInstanceOf(Date)
      expect(fixture.unchanged.messages).toHaveLength(2)

      const response = await attemptHttpOperation(operation, {
        token: student1Token,
        courseId: pythonCourseId,
        sessionId: fixture.session.id,
        expectedStatus: 404,
      })
      expectSafeErrorBody(
        response.body,
        SESSION_NOT_FOUND_ERROR,
        ownerPrivateValues(fixture, DENIED_RENAME_TITLE),
      )
      await expect(readExactChatState()).resolves.toEqual(fixture.unchanged)

      const deletionAudits = await prisma.auditLog.findMany({
        where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_DELETED },
      })
      const accessDenials = await prisma.auditLog.findMany({
        where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED },
      })
      expect(deletionAudits).toHaveLength(1)
      expect(deletionAudits[0]).toMatchObject({
        actorUserId: student1.id,
        targetType: AUDIT_TARGET_TYPES.CHAT_SESSION,
        targetId: fixture.session.id,
        courseId: pythonCourseId,
        metadata: {},
      })
      expect(accessDenials).toHaveLength(1)
      expect(accessDenials[0]).toMatchObject({
        actorUserId: student1.id,
        targetId: fixture.session.id,
        courseId: pythonCourseId,
        metadata: { reason: 'DELETED_OR_UNOWNED' },
      })
      expectAuditRecordsContentFree([...deletionAudits, ...accessDenials])
    },
  )

  it.each(TRUSTED_WRITE_OPERATIONS)(
    'denies post-delete trusted %s without changing the pending history',
    async (operation) => {
      const fixture = await createDeletedOwnerChatFixture()

      await expectTrustedWriteDenied(
        attemptTrustedWrite(operation, {
          courseId: pythonCourseId,
          studentId: student1.id,
          fixture,
        }),
        404,
        SESSION_NOT_FOUND_ERROR,
        ownerPrivateValues(
          fixture,
          DENIED_STUDENT_MESSAGE,
          DENIED_PENDING_MESSAGE,
          DENIED_COMPLETION_MESSAGE,
          DENIED_FAILURE_MESSAGE,
        ),
      )
      await expect(readExactChatState()).resolves.toEqual(fixture.unchanged)

      const deletionAudits = await prisma.auditLog.findMany({
        where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_DELETED },
      })
      const accessDenials = await prisma.auditLog.findMany({
        where: { action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED },
      })
      expect(deletionAudits).toHaveLength(1)
      expect(accessDenials).toHaveLength(1)
      expect(accessDenials[0]).toMatchObject({
        actorUserId: student1.id,
        targetId: fixture.session.id,
        courseId: pythonCourseId,
        metadata: { reason: 'DELETED_OR_UNOWNED' },
      })
      expectAuditRecordsContentFree([...deletionAudits, ...accessDenials])
    },
  )
})
