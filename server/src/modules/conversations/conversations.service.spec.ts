import { ForbiddenException, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../identity/identity.types'
import { UserRole, UserStatus } from '../identity/identity.roles'
import type { AccessAuditService } from '../audit/audit.public'
import type { StudentCitationSources } from '../materials/interface/student-citation-sources'
import type { ConversationAuditService } from './conversation-audit.service'
import {
  createChatSessionRequestSchema,
  listChatMessagesQuerySchema,
  renameChatSessionRequestSchema,
  sendTutoringMessageRequestSchema,
} from './interface/conversation-dto'
import { MessageRole, MessageStatus } from './interface/conversation-values'
import type { ConversationMessageRepository } from './conversation-message.repository'
import { ApplicationConversationMessagePresenter } from '../../application/conversation-message.presenter'
import { ConversationSessionRepository } from './conversation-session.repository'
import type {
  ChatMessageRecord,
  ChatSessionRecord,
  ExportableMessageRecord,
  ExportableSessionRecord,
  MessageListPagination,
  SessionListPagination,
  SoftDeleteChatSessionInput,
  SoftDeleteSessionOutcome,
} from '../conversations/interface/conversation-records'
import { collectStreamToString } from './conversation-markdown-export'
import { ConversationsService } from './conversations.service'

const createdAt = new Date('2026-07-14T10:00:00.000Z')
const updatedAt = new Date('2026-07-14T10:01:00.000Z')

class ConversationTestRepository
  extends ConversationSessionRepository
  implements ConversationMessageRepository
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

  hasActiveOrArchivedStudentAccess(courseId: string, studentId: string) {
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

    const cursorIndex =
      pagination.cursor != null
        ? sessions.findIndex((session) => session.id === pagination.cursor)
        : -1
    const startIndex =
      pagination.cursor != null
        ? cursorIndex === -1
          ? sessions.length
          : cursorIndex + 1
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

  findExportableSession(
    courseId: string,
    sessionId: string,
    studentId: string,
  ): Promise<ExportableSessionRecord | null> {
    const session = this.findOwnedSession(courseId, sessionId, studentId)
    if (!session) return Promise.resolve(null)
    return Promise.resolve({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      course: {
        id: session.courseId,
        code: 'CS101',
        title: 'Algorithms & Data Structures',
      },
    })
  }

  listMessagesForExport(
    sessionId: string,
    cursor?: number,
    limit = 100,
  ): Promise<ExportableMessageRecord[]> {
    const messages = [...(this.messages.get(sessionId) ?? [])]
      .filter((msg) => msg.status === 'COMPLETED')
      .sort((a, b) => a.sequence - b.sequence)
      .filter((msg) => (cursor !== undefined ? msg.sequence > cursor : true))
      .slice(0, limit)
      .map((msg) => ({
        id: msg.id,
        sequence: msg.sequence,
        role: msg.role,
        content: msg.content,
        guidanceLabel: msg.guidanceLabel,
        createdAt: msg.createdAt,
        completedAt: msg.completedAt,
      }))

    return Promise.resolve(messages)
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

    const orderedMessages = [...(this.messages.get(sessionId) ?? [])]
      .sort((a, b) => a.sequence - b.sequence)
      .filter((message) => {
        if (pagination.after !== undefined && pagination.after !== null) {
          return message.sequence > pagination.after
        }
        if (pagination.before !== undefined && pagination.before !== null) {
          return message.sequence < pagination.before
        }
        return true
      })
    const messages =
      pagination.latest === true ||
      (pagination.before !== undefined && pagination.before !== null)
        ? orderedMessages.slice(-pagination.limit)
        : orderedMessages.slice(0, pagination.limit)

    return Promise.resolve(messages)
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

describe('ConversationsService', () => {
  const student = buildUser('student-1', UserRole.STUDENT)
  const otherStudent = buildUser('student-2', UserRole.STUDENT)
  const instructor = buildUser('instructor-1', UserRole.INSTRUCTOR)

  function buildService() {
    const repository = new ConversationTestRepository()
    const auditService = {
      recordAccessDenied: jest.fn().mockResolvedValue(undefined),
      recordSessionDeleted: jest.fn().mockResolvedValue(undefined),
      recordSessionExported: jest.fn().mockResolvedValue(undefined),
    } satisfies Partial<ConversationAuditService>
    const accessAuditService = {
      recordCourseBoundaryDenied: jest.fn().mockResolvedValue(undefined),
    } satisfies Partial<AccessAuditService>
    const citationSources = {
      loadForMessages: jest.fn().mockResolvedValue([]),
    }
    const reviewSummaries = {
      loadForMessages: jest.fn().mockResolvedValue([]),
      loadPublishedGuidanceForMessages: jest.fn().mockResolvedValue([]),
    }

    return {
      repository,
      auditService,
      accessAuditService,
      citationSources,
      reviewSummaries,
      service: new ConversationsService(
        repository,
        repository,
        auditService as unknown as ConversationAuditService,
        accessAuditService as unknown as AccessAuditService,
        new ApplicationConversationMessagePresenter(
          {
            loadForMessages: jest.fn().mockResolvedValue([]),
            loadPolicyEvidence: jest.fn().mockResolvedValue([]),
          },
          {
            loadForMessages: jest.fn().mockResolvedValue([]),
            loadPublishedGuidanceForMessages: jest.fn().mockResolvedValue([]),
          },
        ),
        citationSources as unknown as StudentCitationSources,
        reviewSummaries,
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

  it('accepts only trimmed nonblank tutoring content within 4,000 Unicode code points', () => {
    expect(
      sendTutoringMessageRequestSchema.parse({
        clientMessageId: 'c139776a-0c68-44fe-97f8-e9128aa40458',
        content: '  How do lists work?  ',
        problemId: '2c4d4f3a-7e37-4c6c-8d8b-9c6a3f9a6e11',
        conceptId: '8e8a2e4a-f2f5-4d63-9dc8-4f7f5c02b2a6',
        title: '  List iteration  ',
      }),
    ).toEqual({
      clientMessageId: 'c139776a-0c68-44fe-97f8-e9128aa40458',
      content: 'How do lists work?',
      problemId: '2c4d4f3a-7e37-4c6c-8d8b-9c6a3f9a6e11',
      conceptId: '8e8a2e4a-f2f5-4d63-9dc8-4f7f5c02b2a6',
      title: 'List iteration',
    })
    expect(
      sendTutoringMessageRequestSchema.safeParse({
        content: '😀'.repeat(4_000),
      }).success,
    ).toBe(false)

    for (const input of [
      { content: '   ' },
      { content: '😀'.repeat(4_001) },
      { content: 'Question', provider: 'client-selected' },
      { content: 'Question', citations: [] },
      { content: 'Question', courseId: 'other-course' },
      { content: 'Question', studentId: otherStudent.id },
      { content: 'Question', chunks: [] },
      { content: 'Question', rank: 1, similarityScore: 1 },
      { clientMessageId: 'not-a-uuid', content: 'Question' },
      {
        clientMessageId: 'c139776a-0c68-44fe-97f8-e9128aa40458',
        content: 'Question',
        problemId: 'not-a-uuid',
      },
      {
        clientMessageId: 'c139776a-0c68-44fe-97f8-e9128aa40458',
        content: 'Question',
        title: '   ',
      },
    ]) {
      expect(sendTutoringMessageRequestSchema.safeParse(input).success).toBe(
        false,
      )
    }
  })

  it('accepts one explicit message pagination direction at a time', () => {
    expect(listChatMessagesQuerySchema.parse({ before: '101' })).toEqual({
      before: 101,
    })
    expect(listChatMessagesQuerySchema.parse({ page: 'latest' })).toEqual({
      page: 'latest',
    })
    expect(
      listChatMessagesQuerySchema.safeParse({ after: '50', before: '101' })
        .success,
    ).toBe(false)
    expect(
      listChatMessagesQuerySchema.safeParse({
        after: '50',
        page: 'latest',
      }).success,
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

    for (const listedSession of response.sessions) {
      await expect(
        service.getSession('course-1', listedSession.id, student),
      ).resolves.toMatchObject({ session: { id: listedSession.id } })
    }
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
      service.getSession('course-1', otherOwned.id, student),
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

  it('does not advertise a next page when session count exactly matches limit', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const first = repository.addSession('course-1', student.id, 'First')
    const second = repository.addSession('course-1', student.id, 'Second')
    first.lastMessageAt = new Date('2026-07-14T10:30:00.000Z')
    second.lastMessageAt = new Date('2026-07-14T10:20:00.000Z')

    const response = await service.listSessions('course-1', student, {
      limit: 2,
    })
    expect(response.sessions.map((session) => session.title)).toEqual([
      'First',
      'Second',
    ])
    expect(response.nextCursor).toBeNull()
  })

  it('paginates multiple exact-size forward session pages without an empty page', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const first = repository.addSession('course-1', student.id, 'First')
    const second = repository.addSession('course-1', student.id, 'Second')
    const third = repository.addSession('course-1', student.id, 'Third')
    const fourth = repository.addSession('course-1', student.id, 'Fourth')
    first.lastMessageAt = new Date('2026-07-14T10:40:00.000Z')
    second.lastMessageAt = new Date('2026-07-14T10:30:00.000Z')
    third.lastMessageAt = new Date('2026-07-14T10:20:00.000Z')
    fourth.lastMessageAt = new Date('2026-07-14T10:10:00.000Z')

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
    expect(page2.sessions.map((session) => session.title)).toEqual([
      'Third',
      'Fourth',
    ])
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

  it('loads the newest messages first and paginates backward', async () => {
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

    const newest = await service.listMessages('course-1', session.id, student, {
      limit: 2,
      page: 'latest',
    })
    expect(newest.messages.map((message) => message.sequence)).toEqual([2, 3])
    expect(newest.nextCursor).toBe(2)

    const earlier = await service.listMessages(
      'course-1',
      session.id,
      student,
      { limit: 2, before: newest.nextCursor ?? undefined },
    )
    expect(earlier.messages.map((message) => message.sequence)).toEqual([1])
    expect(earlier.nextCursor).toBeNull()
  })

  it('does not advertise an earlier page for an exact-limit newest history', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'History')
    for (let sequence = 1; sequence <= 2; sequence += 1) {
      repository.addMessage(session.id, {
        sequence,
        role: MessageRole.STUDENT,
        authorUserId: student.id,
        content: `Message ${String(sequence)}`,
        status: MessageStatus.COMPLETED,
      })
    }

    const newest = await service.listMessages('course-1', session.id, student, {
      limit: 2,
      page: 'latest',
    })

    expect(newest.messages.map((message) => message.sequence)).toEqual([1, 2])
    expect(newest.nextCursor).toBeNull()
  })

  it('paginates multiple exact-size backward pages without an empty page', async () => {
    const { repository, service } = buildService()
    repository.addMembership('course-1', student.id)
    const session = repository.addSession('course-1', student.id, 'History')
    for (let sequence = 1; sequence <= 4; sequence += 1) {
      repository.addMessage(session.id, {
        sequence,
        role: MessageRole.STUDENT,
        authorUserId: student.id,
        content: `Message ${String(sequence)}`,
        status: MessageStatus.COMPLETED,
      })
    }

    const newest = await service.listMessages('course-1', session.id, student, {
      limit: 2,
      page: 'latest',
    })
    const earliest = await service.listMessages(
      'course-1',
      session.id,
      student,
      { limit: 2, before: newest.nextCursor ?? undefined },
    )

    expect(newest.messages.map((message) => message.sequence)).toEqual([3, 4])
    expect(newest.nextCursor).toBe(3)
    expect(earliest.messages.map((message) => message.sequence)).toEqual([1, 2])
    expect(earliest.nextCursor).toBeNull()
  })

  describe('exportSessionMarkdown', () => {
    it('exports complete markdown stream and records audit event for active student', async () => {
      const {
        repository,
        auditService,
        citationSources,
        reviewSummaries,
        service,
      } = buildService()
      repository.addMembership('course-1', student.id)
      const session = repository.addSession(
        'course-1',
        student.id,
        'Recursion Discussion',
      )

      repository.messages.set(session.id, [
        makeMessage('msg-1', 1, {
          role: MessageRole.STUDENT,
          content: 'What is a base case?',
          completedAt: new Date('2026-08-16T12:00:00.000Z'),
        }),
        makeMessage('msg-2', 2, {
          role: MessageRole.ASSISTANT,
          content: 'A base case terminates recursion.',
          guidanceLabel: 'COURSE_GROUNDED',
          completedAt: new Date('2026-08-16T12:00:05.000Z'),
        }),
      ])

      citationSources.loadForMessages.mockResolvedValueOnce([
        {
          messageId: 'msg-2',
          order: 1,
          materialId: 'mat-1',
          materialTitle: 'Lecture 4',
          sourceAvailable: true,
          sourceStatus: 'AVAILABLE',
          evidence: [
            {
              rank: 1,
              similarityScore: 0.9,
              chunkId: 'c1',
              chunkNumber: 1,
              excerpt: 'Every recursive function needs a base case.',
            },
          ],
        },
      ])

      reviewSummaries.loadPublishedGuidanceForMessages.mockResolvedValueOnce([
        {
          messageId: 'msg-2',
          reviewCaseId: 'rev-1',
          outcome: 'APPROVED',
          publishedContent: 'Approved instructor guidance text.',
          resolvedAt: new Date('2026-08-16T12:30:00.000Z'),
        },
      ])

      const { stream, filename } = await service.exportSessionMarkdown(
        'course-1',
        session.id,
        student,
      )

      expect(filename).toBe('morshid-CS101-Recursion-Discussion.md')
      const output = await collectStreamToString(stream)

      expect(output).toContain('# Morshid Conversation Export')
      expect(output).toContain(
        '- **Course:** CS101 — Algorithms &amp; Data Structures',
      )
      expect(output).toContain('- **Conversation:** Recursion Discussion')
      expect(output).toContain('## Message 1 — Student')
      expect(output).toContain('What is a base case?')
      expect(output).toContain('## Message 2 — Assistant')
      expect(output).toContain('*Guidance: Course Grounded*')
      expect(output).toContain('### Citations')
      expect(output).toContain('1. [1] **Lecture 4**')
      expect(output).toContain('### Published Instructor Guidance')
      expect(output).toContain('*Outcome: Approved (2026-08-16T12:30:00.000Z)*')

      expect(auditService.recordSessionExported).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: student.id,
          courseId: 'course-1',
          sessionId: session.id,
        }),
      )
    })

    it('rejects export with 403 when student is not enrolled in course', async () => {
      const { repository, auditService, service } = buildService()
      const session = repository.addSession(
        'course-1',
        student.id,
        'Unauthorized Session',
      )

      await expect(
        service.exportSessionMarkdown('course-1', session.id, student),
      ).rejects.toThrow(ForbiddenException)

      expect(auditService.recordAccessDenied).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: student.id,
          courseId: 'course-1',
          reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
        }),
      )
    })

    it('rejects export with 404 when session is deleted or not owned', async () => {
      const { repository, auditService, service } = buildService()
      repository.addMembership('course-1', student.id)
      const session = repository.addSession(
        'course-1',
        otherStudent.id,
        'Other Student Session',
      )

      await expect(
        service.exportSessionMarkdown('course-1', session.id, student),
      ).rejects.toThrow(NotFoundException)

      expect(auditService.recordAccessDenied).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: student.id,
          courseId: 'course-1',
          sessionId: session.id,
          reason: 'DELETED_OR_UNOWNED',
        }),
      )
    })

    it('fails export without returning content when audit logging fails', async () => {
      const { repository, auditService, service } = buildService()
      repository.addMembership('course-1', student.id)
      const session = repository.addSession(
        'course-1',
        student.id,
        'Audit Failure Test',
      )

      auditService.recordSessionExported.mockRejectedValueOnce(
        new Error('Database error during audit logging'),
      )

      await expect(
        service.exportSessionMarkdown('course-1', session.id, student),
      ).rejects.toThrow('Database error during audit logging')
    })
  })
})

function buildUser(id: string, role: UserRole): AuthenticatedUser {
  return {
    id,
    email: `${id}@morshid.demo`,
    displayName: id,
    role,
    status: UserStatus.ACTIVE,
    universityId: 'univ-1',
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
    attemptId: values.attemptId ?? null,
    topicId: values.topicId ?? null,
    authorUserId: values.authorUserId ?? null,
    responseToMessageId: values.responseToMessageId ?? null,
    content: values.content ?? '',
    status: values.status ?? MessageStatus.COMPLETED,
    requestKind: values.requestKind ?? null,
    guidanceLabel: values.guidanceLabel ?? null,
    hintLevel: values.hintLevel ?? null,
    promptVersion: values.promptVersion ?? null,
    errorCode: values.errorCode ?? null,
    createdAt,
    completedAt: values.completedAt ?? null,
  }
}

const serviceSchema = {
  create: createChatSessionRequestSchema,
  rename: renameChatSessionRequestSchema,
}
