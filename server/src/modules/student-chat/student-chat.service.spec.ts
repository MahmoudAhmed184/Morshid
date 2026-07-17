import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import {
  MessageRole,
  MessageStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import type { AccessAuditService } from '../audit/access-audit.service'
import type { StudentChatAuditService } from './student-chat.audit.service'
import {
  createChatSessionRequestSchema,
  renameChatSessionRequestSchema,
} from './student-chat.dto'
import { STUDENT_CHAT_ERROR_CODES } from './student-chat.errors'
import type { StudentChatMessageRepository } from './student-chat-message.repository'
import { StudentChatSessionRepository } from './student-chat-session.repository'
import type {
  AppendPendingAssistantMessageInput,
  AppendStudentMessageInput,
  BlockAssistantMessageInput,
  ChatMessageRecord,
  ChatSessionRecord,
  CompleteAssistantMessageInput,
  FailAssistantMessageInput,
  MessageListPagination,
  MessagePersistenceResult,
  SessionListPagination,
  SoftDeleteChatSessionInput,
  SoftDeleteSessionOutcome,
} from './student-chat.repository.types'
import { StudentChatService } from './student-chat.service'

const createdAt = new Date('2026-07-14T10:00:00.000Z')
const updatedAt = new Date('2026-07-14T10:01:00.000Z')

class StudentChatTestRepository
  extends StudentChatSessionRepository
  implements StudentChatMessageRepository
{
  readonly memberships = new Set<string>()
  readonly courses = new Set<string>()
  readonly sessions = new Map<
    string,
    ChatSessionRecord & { studentId: string; deletedAt: Date | null }
  >()
  readonly messages = new Map<string, ChatMessageRecord[]>()

  private sessionSequence = 1
  private messageSequence = 1
  createSessionFailsMembership = false

  hasActiveStudentMembership(courseId: string, studentId: string) {
    return Promise.resolve(this.memberships.has(key(courseId, studentId)))
  }

  courseExists(courseId: string) {
    return Promise.resolve(this.courses.has(courseId))
  }

  createSession(
    courseId: string,
    studentId: string,
    title: string,
  ): Promise<ChatSessionRecord | null> {
    // Simulates the membership being removed between the guard and the insert.
    if (this.createSessionFailsMembership) {
      return Promise.resolve(null)
    }

    const session = this.addSession(courseId, studentId, title)

    return Promise.resolve(toSessionRecord(session))
  }

  listSessions(
    courseId: string,
    studentId: string,
    pagination: SessionListPagination,
  ) {
    const sessions = [...this.sessions.values()]
      .filter(
        (session) =>
          session.courseId === courseId &&
          session.studentId === studentId &&
          session.deletedAt === null,
      )
      .sort((a, b) => {
        const aActivity = a.lastMessageAt?.getTime() ?? Number.NEGATIVE_INFINITY
        const bActivity = b.lastMessageAt?.getTime() ?? Number.NEGATIVE_INFINITY

        return (
          bActivity - aActivity ||
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id)
        )
      })

    const startIndex =
      pagination.cursor != null
        ? sessions.findIndex((session) => session.id === pagination.cursor) + 1
        : 0

    return Promise.resolve(
      sessions
        .slice(startIndex, startIndex + pagination.limit)
        .map(toSessionRecord),
    )
  }

  findOwnedActiveSession(
    courseId: string,
    sessionId: string,
    studentId: string,
  ) {
    const session = this.findOwnedSession(courseId, sessionId, studentId)

    return Promise.resolve(session ? toSessionRecord(session) : null)
  }

  renameSession(
    courseId: string,
    sessionId: string,
    studentId: string,
    title: string,
  ) {
    const session = this.findOwnedSession(courseId, sessionId, studentId)

    if (session === null) {
      return Promise.resolve(null)
    }

    session.title = title
    session.updatedAt = new Date(updatedAt.getTime() + 1)

    return Promise.resolve(toSessionRecord(session))
  }

  softDeleteSession(
    input: SoftDeleteChatSessionInput,
  ): Promise<SoftDeleteSessionOutcome> {
    const session = this.findOwnedSession(
      input.courseId,
      input.sessionId,
      input.studentId,
    )

    if (session === null) {
      // Owned but already deleted → idempotent success; otherwise not found.
      const owned = this.sessions.get(input.sessionId)

      if (
        owned?.courseId === input.courseId &&
        owned.studentId === input.studentId &&
        owned.deletedAt !== null
      ) {
        return Promise.resolve('already_deleted')
      }

      return Promise.resolve('not_found')
    }

    session.deletedAt = new Date('2026-07-14T11:00:00.000Z')

    return Promise.resolve('deleted')
  }

  listMessages(
    courseId: string,
    sessionId: string,
    studentId: string,
    pagination: MessageListPagination,
  ) {
    const session = this.findOwnedSession(courseId, sessionId, studentId)

    if (session === null) {
      return Promise.resolve(null)
    }

    const messages = [...(this.messages.get(sessionId) ?? [])]
      .sort((a, b) => a.sequence - b.sequence)
      .filter((message) =>
        pagination.after === undefined || pagination.after === null
          ? true
          : message.sequence > pagination.after,
      )
      .slice(0, pagination.limit)

    return Promise.resolve(messages)
  }

  appendStudentMessage(input: AppendStudentMessageInput) {
    return this.appendMessage(input, {
      role: MessageRole.STUDENT,
      authorUserId: input.studentId,
      content: input.content,
      status: MessageStatus.COMPLETED,
      completedAt: new Date(),
    })
  }

  appendPendingAssistantMessage(input: AppendPendingAssistantMessageInput) {
    return this.appendMessage(input, {
      role: MessageRole.ASSISTANT,
      authorUserId: null,
      responseToMessageId: input.responseToMessageId ?? null,
      content: input.content ?? '',
      status: MessageStatus.PENDING,
      completedAt: null,
    })
  }

  completeAssistantMessage(
    input: CompleteAssistantMessageInput,
  ): Promise<MessagePersistenceResult> {
    return this.updateAssistantMessage(input, {
      content: input.content,
      status: MessageStatus.COMPLETED,
      errorCode: null,
      completedAt: new Date(),
    })
  }

  failAssistantMessage(
    input: FailAssistantMessageInput,
  ): Promise<MessagePersistenceResult> {
    return this.updateAssistantMessage(input, {
      status: MessageStatus.FAILED,
      errorCode: input.errorCode,
      completedAt: new Date(),
    })
  }

  blockAssistantMessage(
    input: BlockAssistantMessageInput,
  ): Promise<MessagePersistenceResult> {
    return this.updateAssistantMessage(input, {
      status: MessageStatus.BLOCKED,
      errorCode: input.errorCode,
      completedAt: new Date(),
    })
  }

  addMembership(courseId: string, studentId: string) {
    this.courses.add(courseId)
    this.memberships.add(key(courseId, studentId))
  }

  addSession(courseId: string, studentId: string, title: string) {
    this.courses.add(courseId)
    const id = `session-${String(this.sessionSequence)}`
    this.sessionSequence += 1
    const session: ChatSessionRecord & {
      studentId: string
      deletedAt: Date | null
    } = {
      id,
      courseId,
      studentId,
      title,
      lastSequence: 0,
      lastMessageAt: null,
      deletedAt: null,
      createdAt: new Date(createdAt.getTime() + this.sessionSequence),
      updatedAt,
    }

    this.sessions.set(id, session)
    this.messages.set(id, [])

    return session
  }

  addMessage(
    sessionId: string,
    input: Partial<ChatMessageRecord> & Pick<ChatMessageRecord, 'sequence'>,
  ) {
    const message = makeMessage(this.nextMessageId(), input.sequence, input)
    const messages = this.messages.get(sessionId) ?? []
    messages.push(message)
    this.messages.set(sessionId, messages)

    return message
  }

  private appendMessage(
    input: AppendStudentMessageInput | AppendPendingAssistantMessageInput,
    values: Partial<ChatMessageRecord> &
      Pick<ChatMessageRecord, 'role' | 'authorUserId' | 'content' | 'status'>,
  ): Promise<MessagePersistenceResult> {
    if (!this.memberships.has(key(input.courseId, input.studentId))) {
      return Promise.resolve({ kind: 'membership_missing' })
    }

    const session = this.findOwnedSession(
      input.courseId,
      input.sessionId,
      input.studentId,
    )

    if (session === null) {
      return Promise.resolve({ kind: 'session_not_found' })
    }

    session.lastSequence += 1
    session.lastMessageAt = new Date()

    const message = makeMessage(
      this.nextMessageId(),
      session.lastSequence,
      values,
    )
    this.messages.get(session.id)?.push(message)

    return Promise.resolve({ kind: 'ok', message })
  }

  private updateAssistantMessage(
    input:
      | CompleteAssistantMessageInput
      | FailAssistantMessageInput
      | BlockAssistantMessageInput,
    values: Partial<ChatMessageRecord>,
  ): Promise<MessagePersistenceResult> {
    if (!this.memberships.has(key(input.courseId, input.studentId))) {
      return Promise.resolve({ kind: 'membership_missing' })
    }

    const session = this.findOwnedSession(
      input.courseId,
      input.sessionId,
      input.studentId,
    )

    if (session === null) {
      return Promise.resolve({ kind: 'session_not_found' })
    }

    const messages = this.messages.get(session.id) ?? []
    const index = messages.findIndex(
      (message) =>
        message.id === input.messageId &&
        message.role === MessageRole.ASSISTANT,
    )

    if (index === -1) {
      return Promise.resolve({
        kind: 'message_not_found',
        messageId: input.messageId,
      })
    }

    // Only PENDING assistant messages may transition to a terminal state.
    if (messages[index].status !== MessageStatus.PENDING) {
      return Promise.resolve({
        kind: 'message_not_pending',
        messageId: input.messageId,
      })
    }

    const updated = { ...messages[index], ...values }
    messages[index] = updated

    return Promise.resolve({ kind: 'ok', message: updated })
  }

  private findOwnedSession(
    courseId: string,
    sessionId: string,
    studentId: string,
  ) {
    const session = this.sessions.get(sessionId)

    if (
      session?.courseId !== courseId ||
      session.studentId !== studentId ||
      session.deletedAt !== null
    ) {
      return null
    }

    return session
  }

  private nextMessageId() {
    const id = `message-${String(this.messageSequence)}`
    this.messageSequence += 1

    return id
  }
}

describe('StudentChatService', () => {
  const student = buildUser('student-1', UserRole.STUDENT)
  const otherStudent = buildUser('student-2', UserRole.STUDENT)
  const instructor = buildUser('instructor-1', UserRole.INSTRUCTOR)

  function buildService() {
    const repository = new StudentChatTestRepository()
    const auditService = {
      recordAccessDenied: jest.fn().mockResolvedValue(undefined),
      recordSessionDeleted: jest.fn().mockResolvedValue(undefined),
    } satisfies Partial<StudentChatAuditService>
    const accessAuditService = {
      recordCourseBoundaryDenied: jest.fn().mockResolvedValue(undefined),
    } satisfies Partial<AccessAuditService>

    return {
      repository,
      auditService,
      accessAuditService,
      service: new StudentChatService(
        repository,
        repository,
        auditService as unknown as StudentChatAuditService,
        accessAuditService as unknown as AccessAuditService,
      ),
    }
  }

  it('creates sessions for the authenticated active Student membership', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)

    const response = await service.createSession(
      'course-1',
      { title: 'Unit 1 help' },
      student,
    )

    expect(response.session).toMatchObject({
      courseId: 'course-1',
      title: 'Unit 1 help',
      lastMessageAt: null,
    })
    expect(response.session).not.toHaveProperty('lastSequence')
    expect([...repository.sessions.values()][0].studentId).toBe(student.id)
  })

  it('rejects client ownership and course override fields through strict schemas', () => {
    const create = {
      title: 'Valid',
      studentId: otherStudent.id,
      courseId: 'other-course',
      role: MessageRole.ASSISTANT,
      status: MessageStatus.FAILED,
      provider: 'client-provider',
      citations: [],
    }

    expect(serviceSchema.create.safeParse(create).success).toBe(false)
    expect(
      serviceSchema.rename.safeParse({ title: 'Valid', ownerId: 'x' }).success,
    ).toBe(false)
  })

  it('lists only owned active sessions in recent activity order', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const old = repository.addSession('course-1', student.id, 'Old')
    const recent = repository.addSession('course-1', student.id, 'Recent')
    const deleted = repository.addSession('course-1', student.id, 'Deleted')
    repository.addSession('course-1', otherStudent.id, 'Other student')
    repository.addSession('course-2', student.id, 'Other course')
    old.lastMessageAt = new Date('2026-07-14T10:05:00.000Z')
    recent.lastMessageAt = new Date('2026-07-14T10:10:00.000Z')
    deleted.deletedAt = new Date()

    const response = await service.listSessions('course-1', student, {})

    expect(response.sessions.map((session) => session.title)).toEqual([
      'Recent',
      'Old',
    ])
    expect(response.nextCursor).toBeNull()
  })

  it('gets and renames only the owned active session', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'Original')

    await expect(
      service.getSession('course-1', session.id, student),
    ).resolves.toMatchObject({ session: { title: 'Original' } })

    await expect(
      service.renameSession(
        'course-1',
        session.id,
        { title: 'Renamed' },
        student,
      ),
    ).resolves.toMatchObject({ session: { title: 'Renamed' } })

    await expect(
      service.getSession('course-1', session.id, otherStudent),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('returns the same safe not found for deleted, unowned, and cross-course sessions', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    repository.addMembership('course-2', student.id)
    const deleted = repository.addSession('course-1', student.id, 'Deleted')
    const otherOwned = repository.addSession(
      'course-1',
      otherStudent.id,
      'Other',
    )
    const crossCourse = repository.addSession('course-2', student.id, 'Cross')
    deleted.deletedAt = new Date()

    await expect(
      service.getSession('course-1', deleted.id, student),
    ).rejects.toBeInstanceOf(NotFoundException)
    await expect(
      service.renameSession(
        'course-1',
        otherOwned.id,
        { title: 'Nope' },
        student,
      ),
    ).rejects.toBeInstanceOf(NotFoundException)
    await expect(
      service.listMessages('course-1', crossCourse.id, student, {}),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('soft-deletes a session and records the deletion audit', async () => {
    const { repository, service, auditService } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'Disposable')

    await service.softDeleteSession('course-1', session.id, student)

    expect(repository.sessions.get(session.id)?.deletedAt).toBeInstanceOf(Date)
    await expect(
      service.getSession('course-1', session.id, student),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(auditService.recordAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: student.id,
        courseId: 'course-1',
        sessionId: session.id,
        reason: 'DELETED_OR_UNOWNED',
      }),
    )
  })

  it('returns message history ordered by sequence without internal metadata', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'History')
    repository.addMessage(session.id, {
      sequence: 2,
      role: MessageRole.ASSISTANT,
      content: 'Second',
      status: MessageStatus.COMPLETED,
    })
    repository.addMessage(session.id, {
      sequence: 1,
      role: MessageRole.STUDENT,
      authorUserId: student.id,
      content: 'First',
      status: MessageStatus.COMPLETED,
    })

    const response = await service.listMessages(
      'course-1',
      session.id,
      student,
      {},
    )

    expect(response.messages.map((message) => message.sequence)).toEqual([1, 2])
    expect(response.messages[0]).not.toHaveProperty('authorUserId')
    expect(response.messages[0]).not.toHaveProperty('provider')
    expect(response.messages[0]).not.toHaveProperty('errorMessage')
    expect(response.nextCursor).toBeNull()
  })

  it('rejects unassigned Students and Instructors for private chat operations', async () => {
    const { repository, service, auditService } = buildService()
    const session = repository.addSession('course-1', student.id, 'Private')

    await expect(
      service.createSession('course-1', {}, otherStudent),
    ).rejects.toBeInstanceOf(ForbiddenException)
    await expect(
      service.getSession('course-1', session.id, instructor),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(auditService.recordAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      }),
    )
  })

  it('appends concurrent internal messages with unique monotonic sequences', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'Internal')

    const messages = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        service.appendStudentMessage({
          courseId: 'course-1',
          sessionId: session.id,
          studentId: student.id,
          content: `Message ${String(index)}`,
        }),
      ),
    )

    expect(messages.map((message) => message.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ])
    expect(new Set(messages.map((message) => message.sequence)).size).toBe(8)
    expect(repository.sessions.get(session.id)?.lastSequence).toBe(8)
  })

  it('updates trusted assistant messages without exposing arbitrary client metadata', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'Assistant')
    const pending = await service.appendPendingAssistantMessage({
      courseId: 'course-1',
      sessionId: session.id,
      studentId: student.id,
    })

    const completed = await service.completeAssistantMessage({
      courseId: 'course-1',
      sessionId: session.id,
      studentId: student.id,
      messageId: pending.id,
      content: 'Done',
      provider: 'trusted-provider',
      model: 'trusted-model',
    })

    expect(completed).toMatchObject({
      role: MessageRole.ASSISTANT,
      status: MessageStatus.COMPLETED,
      content: 'Done',
    })
    expect(completed).not.toHaveProperty('provider')
    expect(completed).not.toHaveProperty('model')
  })

  it('audits missing assistant messages distinctly without exposing content', async () => {
    const { repository, service, auditService } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'Assistant')

    await expect(
      service.completeAssistantMessage({
        courseId: 'course-1',
        sessionId: session.id,
        studentId: student.id,
        messageId: 'missing-message',
        content: 'Should not be audited',
      }),
    ).rejects.toBeInstanceOf(NotFoundException)

    expect(auditService.recordAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: student.id,
        courseId: 'course-1',
        sessionId: session.id,
        reason: 'ASSISTANT_MESSAGE_NOT_FOUND',
        messageId: 'missing-message',
      }),
    )
  })

  it('surfaces a distinct not-found code for missing assistant messages (L4)', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'Assistant')

    await expect(
      service.failAssistantMessage({
        courseId: 'course-1',
        sessionId: session.id,
        studentId: student.id,
        messageId: 'missing-message',
        errorCode: 'PIPELINE_ERROR',
      }),
    ).rejects.toMatchObject({
      response: {
        code: STUDENT_CHAT_ERROR_CODES.ASSISTANT_MESSAGE_NOT_FOUND,
      },
    })
  })

  it('rejects finalizing an assistant message that is no longer pending (M2)', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'Assistant')
    const pending = await service.appendPendingAssistantMessage({
      courseId: 'course-1',
      sessionId: session.id,
      studentId: student.id,
    })

    await service.completeAssistantMessage({
      courseId: 'course-1',
      sessionId: session.id,
      studentId: student.id,
      messageId: pending.id,
      content: 'Final answer',
    })

    // A late/duplicate callback must not overwrite or flip a finalized message.
    const failAfterComplete = service.failAssistantMessage({
      courseId: 'course-1',
      sessionId: session.id,
      studentId: student.id,
      messageId: pending.id,
      errorCode: 'LATE_TIMEOUT',
    })

    await expect(failAfterComplete).rejects.toBeInstanceOf(ConflictException)
    await expect(failAfterComplete).rejects.toMatchObject({
      response: {
        code: STUDENT_CHAT_ERROR_CODES.ASSISTANT_MESSAGE_NOT_PENDING,
      },
    })

    const stored = repository.messages
      .get(session.id)
      ?.find((message) => message.id === pending.id)
    expect(stored?.status).toBe(MessageStatus.COMPLETED)
    expect(stored?.content).toBe('Final answer')

    // A duplicate completion is likewise rejected.
    await expect(
      service.completeAssistantMessage({
        courseId: 'course-1',
        sessionId: session.id,
        studentId: student.id,
        messageId: pending.id,
        content: 'Overwrite attempt',
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('denies membership on a non-existent course without leaking existence (H2)', async () => {
    const { service, auditService } = buildService()

    // No membership and no such course: must be a safe 403, never a 500 or a
    // course-existence oracle, and the raw id must not hit the FK column.
    await expect(
      service.listSessions('missing-course', student, {}),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(auditService.recordAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: student.id,
        courseId: null,
        unverifiedCourseId: 'missing-course',
        reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      }),
    )
  })

  it('records the verified course id when the course exists but membership is absent', async () => {
    const { repository, service, auditService } = buildService()
    repository.addMembership('course-1', otherStudent.id)

    await expect(
      service.listSessions('course-1', student, {}),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(auditService.recordAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: 'course-1',
        unverifiedCourseId: null,
        reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      }),
    )
  })

  it('never converts a deny path into a 500 when the audit write fails (M4)', async () => {
    const { repository, service, auditService } = buildService()
    auditService.recordAccessDenied.mockRejectedValue(
      new Error('audit backend unavailable'),
    )

    // Nonexistent course + failing audit: still a 403, not a 500.
    await expect(
      service.listSessions('course-1', student, {}),
    ).rejects.toBeInstanceOf(ForbiddenException)

    // Owned-session deny path with a failing audit likewise stays a 404.
    repository.addMembership('course-2', student.id)
    const owned = repository.addSession('course-2', otherStudent.id, 'Other')
    await expect(
      service.getSession('course-2', owned.id, student),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('maps a membership removed mid-create to a 403 rather than a 500 (L2)', async () => {
    const { repository, service, auditService } = buildService()
    repository.addMembership('course-1', student.id)
    repository.createSessionFailsMembership = true

    await expect(
      service.createSession('course-1', {}, student),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(auditService.recordAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: student.id,
        reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      }),
    )
  })

  it('is idempotent when re-deleting an already-deleted owned session (L1)', async () => {
    const { repository, service, auditService } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'Disposable')

    await service.softDeleteSession('course-1', session.id, student)
    auditService.recordAccessDenied.mockClear()

    // Re-deleting your own already-deleted session succeeds (204) and must not
    // emit a spurious access-denied audit row.
    await expect(
      service.softDeleteSession('course-1', session.id, student),
    ).resolves.toBeUndefined()
    expect(auditService.recordAccessDenied).not.toHaveBeenCalled()
  })

  it('still denies deleting a session that is not owned', async () => {
    const { repository, service, auditService } = buildService()
    repository.addMembership('course-1', student.id)
    const otherOwned = repository.addSession(
      'course-1',
      otherStudent.id,
      'Other',
    )

    await expect(
      service.softDeleteSession('course-1', otherOwned.id, student),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(auditService.recordAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'DELETED_OR_UNOWNED' }),
    )
  })

  it('paginates the session list with a forward cursor (M3)', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const first = repository.addSession('course-1', student.id, 'First')
    const second = repository.addSession('course-1', student.id, 'Second')
    const third = repository.addSession('course-1', student.id, 'Third')
    first.lastMessageAt = new Date('2026-07-14T10:30:00.000Z')
    second.lastMessageAt = new Date('2026-07-14T10:20:00.000Z')
    third.lastMessageAt = new Date('2026-07-14T10:10:00.000Z')

    const page1 = await service.listSessions('course-1', student, { limit: 2 })
    expect(page1.sessions.map((session) => session.title)).toEqual([
      'First',
      'Second',
    ])
    expect(page1.nextCursor).toBe(second.id)

    const page2 = await service.listSessions('course-1', student, {
      limit: 2,
      cursor: page1.nextCursor ?? undefined,
    })
    expect(page2.sessions.map((session) => session.title)).toEqual(['Third'])
    expect(page2.nextCursor).toBeNull()
  })

  it('paginates message history with a forward sequence cursor (M3)', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'History')
    for (let sequence = 1; sequence <= 3; sequence += 1) {
      repository.addMessage(session.id, {
        sequence,
        role: MessageRole.STUDENT,
        authorUserId: student.id,
        content: `Message ${String(sequence)}`,
        status: MessageStatus.COMPLETED,
      })
    }

    const page1 = await service.listMessages('course-1', session.id, student, {
      limit: 2,
    })
    expect(page1.messages.map((message) => message.sequence)).toEqual([1, 2])
    expect(page1.nextCursor).toBe(2)

    const page2 = await service.listMessages('course-1', session.id, student, {
      limit: 2,
      after: page1.nextCursor ?? undefined,
    })
    expect(page2.messages.map((message) => message.sequence)).toEqual([3])
    expect(page2.nextCursor).toBeNull()
  })
})

function buildUser(id: string, role: UserRole): AuthenticatedRequestUser {
  return {
    id,
    email: `${id}@morshid.demo`,
    displayName: id,
    role,
    status: UserStatus.ACTIVE,
  }
}

function key(courseId: string, studentId: string) {
  return `${courseId}:${studentId}`
}

function toSessionRecord(
  session: ChatSessionRecord & { studentId: string; deletedAt: Date | null },
): ChatSessionRecord {
  return {
    id: session.id,
    courseId: session.courseId,
    title: session.title,
    lastSequence: session.lastSequence,
    lastMessageAt: session.lastMessageAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }
}

function makeMessage(
  id: string,
  sequence: number,
  values: Partial<ChatMessageRecord>,
): ChatMessageRecord {
  return {
    id,
    sequence,
    role: values.role ?? MessageRole.STUDENT,
    authorUserId: values.authorUserId ?? null,
    responseToMessageId: values.responseToMessageId ?? null,
    content: values.content ?? '',
    status: values.status ?? MessageStatus.COMPLETED,
    requestKind: values.requestKind ?? null,
    guidanceLabel: values.guidanceLabel ?? null,
    hintLevel: values.hintLevel ?? null,
    errorCode: values.errorCode ?? null,
    createdAt,
    completedAt: values.completedAt ?? null,
  }
}

const serviceSchema = {
  create: createChatSessionRequestSchema,
  rename: renameChatSessionRequestSchema,
}
