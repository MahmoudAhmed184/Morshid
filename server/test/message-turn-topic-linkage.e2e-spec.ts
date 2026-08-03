import { randomUUID } from 'node:crypto'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
} from '../src/generated/prisma/client'
import type { PrismaService } from '../src/modules/prisma/prisma.service'
import { PrismaStudentChatMessageRepository } from '../src/modules/student-chat/student-chat-message.repository'
import {
  PrismaTurnRepository,
  type TurnRepository,
} from '../src/modules/socratic-tutor/turn.repository'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

interface ChatFixture {
  courseId: string
  studentId: string
  sessionId: string
}

describe('Message turn and topic linkage persistence (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let turnRepository: TurnRepository
  let messageRepository: PrismaStudentChatMessageRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue167')
    prisma = database.prisma
    turnRepository = new PrismaTurnRepository(prisma)
    messageRepository = new PrismaStudentChatMessageRepository(prisma)
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('keeps existing student message creation working without turn or topic links', async () => {
    const fixture = await createChatFixture(prisma)

    const result = await messageRepository.appendStudentMessage({
      ...fixture,
      content: 'Legacy-compatible question',
    })

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') {
      return
    }
    expect(result.message).toMatchObject({
      content: 'Legacy-compatible question',
      turnId: null,
      topicId: null,
      requestKind: null,
      hintLevel: null,
    })
  })

  it('links a student message to its authoritative TutorTurn idempotently', async () => {
    const fixture = await createChatFixture(prisma)
    const turn = await createTurn(prisma, fixture)
    const message = await createMessage(prisma, fixture, {
      sequence: 1,
      role: 'STUDENT',
    })

    const first = await turnRepository.linkStudentMessage({
      turnId: turn.id,
      studentMessageId: message.id,
    })
    const second = await turnRepository.linkStudentMessage({
      turnId: turn.id,
      studentMessageId: message.id,
    })

    expect(first).toMatchObject({
      kind: 'ok',
      turn: {
        id: turn.id,
        sessionId: fixture.sessionId,
        studentMessageId: message.id,
      },
    })
    expect(second).toEqual(first)
    await expect(readLinkage(prisma, turn.id, message.id)).resolves.toEqual({
      turnStudentMessageId: message.id,
      turnTopicId: null,
      messageTurnId: turn.id,
      messageTopicId: null,
    })
  })

  it('rejects conflicting, assistant-role, and cross-session student linkage without mutation', async () => {
    const fixture = await createChatFixture(prisma)
    const otherFixture = await createChatFixture(prisma)
    const turn = await createTurn(prisma, fixture)
    const student = await createMessage(prisma, fixture, {
      sequence: 1,
      role: 'STUDENT',
    })
    const replacement = await createMessage(prisma, fixture, {
      sequence: 2,
      role: 'STUDENT',
    })
    const assistant = await createMessage(prisma, fixture, {
      sequence: 3,
      role: 'ASSISTANT',
    })
    const otherStudent = await createMessage(prisma, otherFixture, {
      sequence: 1,
      role: 'STUDENT',
    })

    await expect(
      turnRepository.linkStudentMessage({
        turnId: turn.id,
        studentMessageId: student.id,
      }),
    ).resolves.toMatchObject({ kind: 'ok' })
    await expect(
      turnRepository.linkStudentMessage({
        turnId: turn.id,
        studentMessageId: replacement.id,
      }),
    ).resolves.toEqual({ kind: 'linkage_conflict' })
    await expect(
      turnRepository.linkStudentMessage({
        turnId: turn.id,
        studentMessageId: assistant.id,
      }),
    ).resolves.toEqual({ kind: 'message_role_mismatch' })

    const crossSessionTurn = await createTurn(prisma, fixture)
    await expect(
      turnRepository.linkStudentMessage({
        turnId: crossSessionTurn.id,
        studentMessageId: otherStudent.id,
      }),
    ).resolves.toEqual({ kind: 'session_mismatch' })
    await expect(
      readLinkage(prisma, crossSessionTurn.id, otherStudent.id),
    ).resolves.toEqual({
      turnStudentMessageId: null,
      turnTopicId: null,
      messageTurnId: null,
      messageTopicId: null,
    })
  })

  it('attaches a resolved topic to the turn and student message idempotently', async () => {
    const fixture = await createChatFixture(prisma)
    const turn = await createTurn(prisma, fixture)
    const message = await createMessage(prisma, fixture, {
      sequence: 1,
      role: 'STUDENT',
    })
    const topic = await createTopic(prisma, fixture)

    const first = await turnRepository.attachResolvedTopic({
      turnId: turn.id,
      studentMessageId: message.id,
      topicId: topic.id,
    })
    const second = await turnRepository.attachResolvedTopic({
      turnId: turn.id,
      studentMessageId: message.id,
      topicId: topic.id,
    })

    expect(first).toMatchObject({
      kind: 'ok',
      turn: {
        id: turn.id,
        topicId: topic.id,
        studentMessageId: message.id,
      },
    })
    expect(second).toEqual(first)
    await expect(readLinkage(prisma, turn.id, message.id)).resolves.toEqual({
      turnStudentMessageId: message.id,
      turnTopicId: topic.id,
      messageTurnId: turn.id,
      messageTopicId: topic.id,
    })
  })

  it('rejects conflicting, cross-session, and cross-course topic attachment without partial mutation', async () => {
    const fixture = await createChatFixture(prisma)
    const otherFixture = await createChatFixture(prisma)
    const turn = await createTurn(prisma, fixture)
    const message = await createMessage(prisma, fixture, {
      sequence: 1,
      role: 'STUDENT',
    })
    const topic = await createTopic(prisma, fixture)
    const conflictingTopic = await createTopic(prisma, fixture)
    const crossSessionTopic = await createTopic(prisma, otherFixture)
    const crossCourseTopic = await createTopic(prisma, {
      ...fixture,
      courseId: otherFixture.courseId,
    })

    await expect(
      turnRepository.attachResolvedTopic({
        turnId: turn.id,
        studentMessageId: message.id,
        topicId: topic.id,
      }),
    ).resolves.toMatchObject({ kind: 'ok' })
    await expect(
      turnRepository.attachResolvedTopic({
        turnId: turn.id,
        studentMessageId: message.id,
        topicId: conflictingTopic.id,
      }),
    ).resolves.toEqual({ kind: 'linkage_conflict' })
    await expect(
      turnRepository.attachResolvedTopic({
        turnId: turn.id,
        studentMessageId: message.id,
        topicId: crossSessionTopic.id,
      }),
    ).resolves.toEqual({ kind: 'session_mismatch' })

    const unlinkedTurn = await createTurn(prisma, fixture)
    const unlinkedMessage = await createMessage(prisma, fixture, {
      sequence: 2,
      role: 'STUDENT',
    })
    await expect(
      turnRepository.attachResolvedTopic({
        turnId: unlinkedTurn.id,
        studentMessageId: unlinkedMessage.id,
        topicId: crossCourseTopic.id,
      }),
    ).resolves.toEqual({ kind: 'course_mismatch' })
    await expect(
      readLinkage(prisma, unlinkedTurn.id, unlinkedMessage.id),
    ).resolves.toEqual({
      turnStudentMessageId: null,
      turnTopicId: null,
      messageTurnId: null,
      messageTopicId: null,
    })
    await expect(readLinkage(prisma, turn.id, message.id)).resolves.toEqual({
      turnStudentMessageId: message.id,
      turnTopicId: topic.id,
      messageTurnId: turn.id,
      messageTopicId: topic.id,
    })
  })

  it('persists trusted requestKind and hintLevel while preserving guidanceLabel semantics', async () => {
    const fixture = await createChatFixture(prisma)
    const student = await messageRepository.appendStudentMessage({
      ...fixture,
      content: 'Diagnose my attempt',
      requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
    })
    expect(student.kind).toBe('ok')
    if (student.kind !== 'ok') {
      return
    }

    const pending = await messageRepository.appendPendingAssistantMessage({
      ...fixture,
      responseToMessageId: student.message.id,
      content: '',
    })
    expect(pending.kind).toBe('ok')
    if (pending.kind !== 'ok') {
      return
    }

    const completed = await messageRepository.completeAssistantMessage({
      ...fixture,
      messageId: pending.message.id,
      content: 'What invariant changes after each iteration?',
      provider: 'deterministic',
      model: 'deterministic-completion-v1',
      promptVersion: 'socratic-v1',
      inputTokens: 10,
      outputTokens: 12,
      guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
      hintLevel: 2,
    })

    expect(completed).toMatchObject({
      kind: 'ok',
      message: {
        hintLevel: 2,
        guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
      },
    })
    await expect(
      prisma.message.findUniqueOrThrow({
        where: { id: student.message.id },
        select: { requestKind: true, hintLevel: true, guidanceLabel: true },
      }),
    ).resolves.toEqual({
      requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
      hintLevel: null,
      guidanceLabel: null,
    })
    await expect(
      messageRepository.appendStudentMessage({
        ...fixture,
        content: 'Bad kind',
        requestKind: 'NOT_A_KIND' as MessageRequestKind,
      }),
    ).rejects.toThrow('Message requestKind must use MessageRequestKind')
    await expect(
      messageRepository.appendStudentMessage({
        ...fixture,
        content: 'Student cannot carry approved guidance',
        hintLevel: 2,
      }),
    ).rejects.toThrow(
      'Message hintLevel is only supported for approved assistant messages',
    )
    await expect(
      messageRepository.appendPendingAssistantMessage({
        ...fixture,
        content: '',
        requestKind: MessageRequestKind.CONCEPTUAL,
      }),
    ).rejects.toThrow(
      'Message requestKind is only supported for student messages',
    )
    await expect(
      messageRepository.appendPendingAssistantMessage({
        ...fixture,
        content: '',
        hintLevel: 5,
      }),
    ).rejects.toThrow('Message hintLevel must be between 1 and 4')
  })

  it('preserves provider, model, and citation records when links are added', async () => {
    const fixture = await createChatFixture(prisma)
    const turn = await createTurn(prisma, fixture)
    const topic = await createTopic(prisma, fixture)
    const student = await createMessage(prisma, fixture, {
      sequence: 1,
      role: 'STUDENT',
      content: 'Explain loops',
    })
    const assistant = await createMessage(prisma, fixture, {
      sequence: 2,
      role: 'ASSISTANT',
      responseToMessageId: student.id,
      content: 'Use the cited source.',
      provider: 'deterministic',
      model: 'deterministic-completion-v1',
      guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
    })
    const material = await createMaterial(prisma, fixture)
    await prisma.messageCitation.create({
      data: {
        messageId: assistant.id,
        materialId: material.id,
        citationOrder: 1,
      },
    })

    await expect(
      turnRepository.attachResolvedTopic({
        turnId: turn.id,
        studentMessageId: student.id,
        topicId: topic.id,
      }),
    ).resolves.toMatchObject({ kind: 'ok' })

    const storedAssistant = await prisma.message.findUniqueOrThrow({
      where: { id: assistant.id },
      include: { citations: true },
    })
    const storedTurn = await prisma.tutorTurn.findUniqueOrThrow({
      where: { id: turn.id },
      select: { id: true, studentMessageId: true, topicId: true },
    })
    const state = await prisma.topicState.create({
      data: { topicId: topic.id },
      select: {
        summary: true,
        lastStudentAction: true,
        lastTutorQuestion: true,
      },
    })

    expect(storedAssistant).toMatchObject({
      provider: 'deterministic',
      model: 'deterministic-completion-v1',
      turnId: null,
      topicId: null,
    })
    expect(
      storedAssistant.citations.map(({ materialId, citationOrder }) => ({
        materialId,
        citationOrder,
      })),
    ).toEqual([{ materialId: material.id, citationOrder: 1 }])
    expect(storedTurn).toEqual({
      id: turn.id,
      studentMessageId: student.id,
      topicId: topic.id,
    })
    expect(state).toEqual({
      summary: null,
      lastStudentAction: null,
      lastTutorQuestion: null,
    })
  })
})

async function createChatFixture(prisma: PrismaService): Promise<ChatFixture> {
  const student = await prisma.user.create({
    data: {
      email: `issue167-${randomUUID()}@morshid.test`,
      displayName: 'Issue 167 student',
      role: 'STUDENT',
      passwordHash: 'test-password-hash',
    },
  })
  const course = await prisma.course.create({
    data: {
      code: `I167-${randomUUID().slice(0, 24)}`,
      title: 'Issue 167 test course',
      createdById: student.id,
    },
  })
  await prisma.courseMembership.create({
    data: {
      courseId: course.id,
      userId: student.id,
      role: 'STUDENT',
      createdById: student.id,
    },
  })
  const session = await prisma.chatSession.create({
    data: {
      courseId: course.id,
      studentId: student.id,
      title: 'Message linkage',
    },
  })

  return {
    courseId: course.id,
    studentId: student.id,
    sessionId: session.id,
  }
}

function createTurn(
  prisma: PrismaService,
  fixture: ChatFixture,
): Promise<{ id: string }> {
  return prisma.tutorTurn.create({
    data: {
      sessionId: fixture.sessionId,
      idempotencyKey: `turn-${randomUUID()}`,
    },
    select: { id: true },
  })
}

function createTopic(
  prisma: PrismaService,
  fixture: ChatFixture,
): Promise<{ id: string }> {
  return prisma.topic.create({
    data: {
      sessionId: fixture.sessionId,
      courseId: fixture.courseId,
      title: `Topic ${randomUUID()}`,
    },
    select: { id: true },
  })
}

function createMessage(
  prisma: PrismaService,
  fixture: ChatFixture,
  input: {
    sequence: number
    role: 'STUDENT' | 'ASSISTANT'
    content?: string
    responseToMessageId?: string | null
    provider?: string | null
    model?: string | null
    guidanceLabel?: MessageGuidanceLabel | null
  },
): Promise<{ id: string }> {
  return prisma.message.create({
    data: {
      sessionId: fixture.sessionId,
      sequence: input.sequence,
      role: input.role,
      authorUserId: input.role === 'STUDENT' ? fixture.studentId : null,
      responseToMessageId: input.responseToMessageId ?? null,
      content: input.content ?? 'Message content',
      status: 'COMPLETED',
      provider: input.provider ?? null,
      model: input.model ?? null,
      guidanceLabel: input.guidanceLabel ?? null,
    },
    select: { id: true },
  })
}

async function createMaterial(
  prisma: PrismaService,
  fixture: ChatFixture,
): Promise<{ id: string }> {
  return prisma.material.create({
    data: {
      courseId: fixture.courseId,
      uploadedById: fixture.studentId,
      title: 'Linked source',
      originalFilename: 'linked-source.pdf',
      storagePath: `${randomUUID()}.pdf`,
      status: 'READY',
      extractedTextLength: 120,
      chunkCount: 1,
    },
    select: { id: true },
  })
}

async function readLinkage(
  prisma: PrismaService,
  turnId: string,
  messageId: string,
): Promise<{
  turnStudentMessageId: string | null
  turnTopicId: string | null
  messageTurnId: string | null
  messageTopicId: string | null
}> {
  const [turn, message] = await Promise.all([
    prisma.tutorTurn.findUniqueOrThrow({
      where: { id: turnId },
      select: {
        studentMessageId: true,
        topicId: true,
      },
    }),
    prisma.message.findUniqueOrThrow({
      where: { id: messageId },
      select: {
        turnId: true,
        topicId: true,
      },
    }),
  ])

  return {
    turnStudentMessageId: turn.studentMessageId,
    turnTopicId: turn.topicId,
    messageTurnId: message.turnId,
    messageTopicId: message.topicId,
  }
}
