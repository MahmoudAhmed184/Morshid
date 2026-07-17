import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  MessageRole,
  MessageStatus,
  type MessageGuidanceLabel,
  type MessageRequestKind,
  Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { AuditRequestContext } from '../audit/audit.service'
import { StudentChatAuditService } from './student-chat.audit.service'

export interface ChatSessionRecord {
  id: string
  courseId: string
  title: string
  lastSequence: number
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface SoftDeleteChatSessionInput {
  courseId: string
  sessionId: string
  studentId: string
  requestContext?: AuditRequestContext
}

export interface ChatMessageRecord {
  id: string
  sequence: number
  role: MessageRole
  authorUserId: string | null
  responseToMessageId: string | null
  content: string
  status: MessageStatus
  requestKind: MessageRequestKind | null
  guidanceLabel: MessageGuidanceLabel | null
  hintLevel: number | null
  errorCode: string | null
  createdAt: Date
  completedAt: Date | null
}

export interface AppendStudentMessageInput {
  courseId: string
  sessionId: string
  studentId: string
  content: string
  requestKind?: MessageRequestKind | null
  guidanceLabel?: MessageGuidanceLabel | null
  hintLevel?: number | null
}

export interface AppendPendingAssistantMessageInput {
  courseId: string
  sessionId: string
  studentId: string
  responseToMessageId?: string | null
  content?: string
  requestKind?: MessageRequestKind | null
  guidanceLabel?: MessageGuidanceLabel | null
  hintLevel?: number | null
}

export interface CompleteAssistantMessageInput {
  courseId: string
  sessionId: string
  studentId: string
  messageId: string
  content: string
  provider?: string | null
  model?: string | null
  promptVersion?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  guidanceLabel?: MessageGuidanceLabel | null
}

export interface FailAssistantMessageInput {
  courseId: string
  sessionId: string
  studentId: string
  messageId: string
  errorCode: string
  safeErrorMessage?: string | null
}

export interface BlockAssistantMessageInput {
  courseId: string
  sessionId: string
  studentId: string
  messageId: string
  errorCode: string
}

export type MessagePersistenceResult =
  | { kind: 'ok'; message: ChatMessageRecord }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'message_not_found'; messageId: string }
  | { kind: 'message_not_pending'; messageId: string }

export interface SessionListPagination {
  limit: number
  cursor?: string | null
}

export interface MessageListPagination {
  limit: number
  after?: number | null
}

export type SoftDeleteSessionOutcome =
  'deleted' | 'already_deleted' | 'not_found'

const chatSessionSelect = {
  id: true,
  courseId: true,
  title: true,
  lastSequence: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChatSessionSelect

const chatMessageSelect = {
  id: true,
  sequence: true,
  role: true,
  authorUserId: true,
  responseToMessageId: true,
  content: true,
  status: true,
  requestKind: true,
  guidanceLabel: true,
  hintLevel: true,
  errorCode: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.MessageSelect

export abstract class StudentChatRepository {
  abstract hasActiveStudentMembership(
    courseId: string,
    studentId: string,
  ): Promise<boolean>

  abstract courseExists(courseId: string): Promise<boolean>

  abstract createSession(
    courseId: string,
    studentId: string,
    title: string,
  ): Promise<ChatSessionRecord | null>

  abstract listSessions(
    courseId: string,
    studentId: string,
    pagination: SessionListPagination,
  ): Promise<ChatSessionRecord[]>

  abstract findOwnedActiveSession(
    courseId: string,
    sessionId: string,
    studentId: string,
  ): Promise<ChatSessionRecord | null>

  abstract renameSession(
    courseId: string,
    sessionId: string,
    studentId: string,
    title: string,
  ): Promise<ChatSessionRecord | null>

  abstract softDeleteSession(
    input: SoftDeleteChatSessionInput,
  ): Promise<SoftDeleteSessionOutcome>

  abstract listMessages(
    courseId: string,
    sessionId: string,
    studentId: string,
    pagination: MessageListPagination,
  ): Promise<ChatMessageRecord[] | null>

  abstract appendStudentMessage(
    input: AppendStudentMessageInput,
  ): Promise<MessagePersistenceResult>

  abstract appendPendingAssistantMessage(
    input: AppendPendingAssistantMessageInput,
  ): Promise<MessagePersistenceResult>

  abstract completeAssistantMessage(
    input: CompleteAssistantMessageInput,
  ): Promise<MessagePersistenceResult>

  abstract failAssistantMessage(
    input: FailAssistantMessageInput,
  ): Promise<MessagePersistenceResult>

  abstract blockAssistantMessage(
    input: BlockAssistantMessageInput,
  ): Promise<MessagePersistenceResult>
}

@Injectable()
export class PrismaStudentChatRepository extends StudentChatRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly studentChatAuditService: StudentChatAuditService,
  ) {
    super()
  }

  async hasActiveStudentMembership(
    courseId: string,
    studentId: string,
  ): Promise<boolean> {
    const membership = await this.prismaService.courseMembership.findFirst({
      where: {
        courseId,
        userId: studentId,
        role: CourseMembershipRole.STUDENT,
        removedAt: null,
      },
      select: {
        id: true,
      },
    })

    return membership !== null
  }

  async courseExists(courseId: string): Promise<boolean> {
    const course = await this.prismaService.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    })

    return course !== null
  }

  async createSession(
    courseId: string,
    studentId: string,
    title: string,
  ): Promise<ChatSessionRecord | null> {
    try {
      return await this.prismaService.chatSession.create({
        data: {
          courseId,
          studentId,
          title,
        },
        select: chatSessionSelect,
      })
    } catch (error) {
      // The composite (course_id, student_id) foreign key onto an active
      // membership can fail with P2003 if the membership was removed between
      // the guard check and the insert. Surface it as "no active membership".
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        return null
      }

      throw error
    }
  }

  listSessions(
    courseId: string,
    studentId: string,
    pagination: SessionListPagination,
  ) {
    return this.prismaService.chatSession.findMany({
      where: {
        courseId,
        studentId,
        deletedAt: null,
      },
      select: chatSessionSelect,
      orderBy: [
        {
          lastMessageAt: {
            sort: 'desc',
            nulls: 'last',
          },
        },
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      take: pagination.limit,
      ...(pagination.cursor != null
        ? { cursor: { id: pagination.cursor }, skip: 1 }
        : {}),
    })
  }

  findOwnedActiveSession(
    courseId: string,
    sessionId: string,
    studentId: string,
  ) {
    return this.prismaService.chatSession.findFirst({
      where: ownedActiveSessionWhere(courseId, sessionId, studentId),
      select: chatSessionSelect,
    })
  }

  async renameSession(
    courseId: string,
    sessionId: string,
    studentId: string,
    title: string,
  ) {
    const result = await this.prismaService.chatSession.updateManyAndReturn({
      where: ownedActiveSessionWhere(courseId, sessionId, studentId),
      data: {
        title,
      },
      select: chatSessionSelect,
      limit: 1,
    })

    return result[0] ?? null
  }

  async softDeleteSession(
    input: SoftDeleteChatSessionInput,
  ): Promise<SoftDeleteSessionOutcome> {
    return this.prismaService.$transaction(async (tx) => {
      const result = await tx.chatSession.updateMany({
        where: ownedActiveSessionWhere(
          input.courseId,
          input.sessionId,
          input.studentId,
        ),
        data: {
          deletedAt: new Date(),
        },
      })

      if (result.count === 0) {
        // Distinguish "already deleted by the owner" (idempotent success) from
        // "not owned / does not exist" (a genuine access denial).
        const existing = await tx.chatSession.findFirst({
          where: {
            id: input.sessionId,
            courseId: input.courseId,
            studentId: input.studentId,
          },
          select: {
            deletedAt: true,
          },
        })

        if (existing !== null && existing.deletedAt !== null) {
          return 'already_deleted'
        }

        return 'not_found'
      }

      await this.studentChatAuditService.recordSessionDeleted(
        {
          actorUserId: input.studentId,
          courseId: input.courseId,
          sessionId: input.sessionId,
          requestContext: input.requestContext,
        },
        tx,
      )

      return 'deleted'
    })
  }

  async listMessages(
    courseId: string,
    sessionId: string,
    studentId: string,
    pagination: MessageListPagination,
  ): Promise<ChatMessageRecord[] | null> {
    const session = await this.prismaService.chatSession.findFirst({
      where: ownedActiveSessionWhere(courseId, sessionId, studentId),
      select: {
        id: true,
      },
    })

    if (session === null) {
      return null
    }

    return this.prismaService.message.findMany({
      where: {
        sessionId: session.id,
        ...(pagination.after !== undefined && pagination.after !== null
          ? { sequence: { gt: pagination.after } }
          : {}),
      },
      select: chatMessageSelect,
      orderBy: {
        sequence: 'asc',
      },
      take: pagination.limit,
    })
  }

  appendStudentMessage(input: AppendStudentMessageInput) {
    return this.appendMessage(input, {
      role: MessageRole.STUDENT,
      authorUserId: input.studentId,
      content: input.content,
      status: MessageStatus.COMPLETED,
      requestKind: input.requestKind ?? null,
      guidanceLabel: input.guidanceLabel ?? null,
      hintLevel: input.hintLevel ?? null,
    })
  }

  appendPendingAssistantMessage(input: AppendPendingAssistantMessageInput) {
    return this.appendMessage(input, {
      role: MessageRole.ASSISTANT,
      authorUserId: null,
      responseToMessageId: input.responseToMessageId ?? null,
      content: input.content ?? '',
      status: MessageStatus.PENDING,
      requestKind: input.requestKind ?? null,
      guidanceLabel: input.guidanceLabel ?? null,
      hintLevel: input.hintLevel ?? null,
    })
  }

  completeAssistantMessage(input: CompleteAssistantMessageInput) {
    return this.updateAssistantMessage(input, {
      status: MessageStatus.COMPLETED,
      content: input.content,
      completedAt: new Date(),
      provider: input.provider ?? null,
      model: input.model ?? null,
      promptVersion: input.promptVersion ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      // Preserve an explicit `null` (re-classify as unlabeled); only `undefined`
      // means "leave the pending label unchanged".
      guidanceLabel:
        input.guidanceLabel === undefined ? undefined : input.guidanceLabel,
      errorCode: null,
      errorMessage: null,
    })
  }

  failAssistantMessage(input: FailAssistantMessageInput) {
    return this.updateAssistantMessage(input, {
      status: MessageStatus.FAILED,
      errorCode: input.errorCode,
      errorMessage: input.safeErrorMessage ?? null,
      completedAt: new Date(),
    })
  }

  blockAssistantMessage(input: BlockAssistantMessageInput) {
    return this.updateAssistantMessage(input, {
      status: MessageStatus.BLOCKED,
      errorCode: input.errorCode,
      errorMessage: null,
      completedAt: new Date(),
    })
  }

  private appendMessage(
    input: AppendStudentMessageInput | AppendPendingAssistantMessageInput,
    data: Omit<
      Prisma.MessageUncheckedCreateInput,
      'id' | 'sessionId' | 'sequence' | 'createdAt'
    >,
  ): Promise<MessagePersistenceResult> {
    return this.prismaService.$transaction(async (tx) => {
      const hasMembership = await hasActiveStudentMembershipInTransaction(
        tx,
        input.courseId,
        input.studentId,
      )

      if (!hasMembership) {
        return { kind: 'membership_missing' }
      }

      // The row-locking increment doubles as the ownership check: the identical
      // predicate is enforced here, and a missing/soft-deleted session surfaces
      // as P2025. A separate pre-read would only widen the TOCTOU window.
      const session = await tx.chatSession
        .update({
          where: {
            id: input.sessionId,
            courseId: input.courseId,
            studentId: input.studentId,
            deletedAt: null,
          },
          data: {
            lastSequence: {
              increment: 1,
            },
          },
          select: {
            id: true,
            lastSequence: true,
          },
        })
        .catch((error: unknown) => {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
          ) {
            return null
          }

          throw error
        })

      if (session === null) {
        return { kind: 'session_not_found' }
      }

      // A reply must target a message that belongs to the same session; the FK
      // alone only requires the referenced message to exist somewhere.
      const responseToMessageId =
        typeof data.responseToMessageId === 'string'
          ? data.responseToMessageId
          : null

      if (responseToMessageId !== null) {
        const target = await tx.message.findFirst({
          where: {
            id: responseToMessageId,
            sessionId: session.id,
          },
          select: {
            id: true,
          },
        })

        if (target === null) {
          return { kind: 'message_not_found', messageId: responseToMessageId }
        }
      }

      // Use a single database clock source so `lastMessageAt`, `completedAt`,
      // and `createdAt` stay mutually consistent and monotonic with sequence.
      const now = await currentDatabaseTime(tx)

      const message = await tx.message.create({
        data: {
          ...data,
          sessionId: session.id,
          sequence: session.lastSequence,
          createdAt: now,
          completedAt:
            data.status === MessageStatus.COMPLETED
              ? now
              : (data.completedAt ?? null),
        },
        select: chatMessageSelect,
      })

      await tx.chatSession.update({
        where: {
          id: session.id,
        },
        data: {
          lastMessageAt: now,
        },
      })

      return { kind: 'ok', message }
    })
  }

  private updateAssistantMessage(
    input:
      | CompleteAssistantMessageInput
      | FailAssistantMessageInput
      | BlockAssistantMessageInput,
    data: Prisma.MessageUpdateManyMutationInput,
  ): Promise<MessagePersistenceResult> {
    return this.prismaService.$transaction(async (tx) => {
      const hasMembership = await hasActiveStudentMembershipInTransaction(
        tx,
        input.courseId,
        input.studentId,
      )

      if (!hasMembership) {
        return { kind: 'membership_missing' }
      }

      const session = await tx.chatSession.findFirst({
        where: ownedActiveSessionWhere(
          input.courseId,
          input.sessionId,
          input.studentId,
        ),
        select: {
          id: true,
        },
      })

      if (session === null) {
        return { kind: 'session_not_found' }
      }

      // Only PENDING assistant messages may transition to a terminal state.
      // Persisted chat history is an immutable record: a late/duplicate callback
      // must not overwrite a COMPLETED answer or flip it to FAILED/BLOCKED.
      const messages = await tx.message.updateManyAndReturn({
        where: {
          id: input.messageId,
          sessionId: session.id,
          role: MessageRole.ASSISTANT,
          status: MessageStatus.PENDING,
        },
        data,
        select: chatMessageSelect,
        limit: 1,
      })
      const message = messages.at(0)

      if (message === undefined) {
        // Distinguish "already finalized" from "never existed" so callers can
        // treat a duplicate finalization differently from a genuine miss.
        const existing = await tx.message.findFirst({
          where: {
            id: input.messageId,
            sessionId: session.id,
            role: MessageRole.ASSISTANT,
          },
          select: {
            id: true,
          },
        })

        if (existing !== null) {
          return { kind: 'message_not_pending', messageId: input.messageId }
        }

        return { kind: 'message_not_found', messageId: input.messageId }
      }

      return { kind: 'ok', message }
    })
  }
}

async function currentDatabaseTime(
  database: Pick<Prisma.TransactionClient, '$queryRaw'>,
): Promise<Date> {
  const rows = await database.$queryRaw<{ now: Date }[]>`SELECT now() AS now`

  return rows[0].now
}

function ownedActiveSessionWhere(
  courseId: string,
  sessionId: string,
  studentId: string,
): Prisma.ChatSessionWhereInput {
  return {
    id: sessionId,
    courseId,
    studentId,
    deletedAt: null,
  }
}

function hasActiveStudentMembershipInTransaction(
  database: Pick<Prisma.TransactionClient, 'courseMembership'>,
  courseId: string,
  studentId: string,
): Promise<boolean> {
  return database.courseMembership
    .findFirst({
      where: {
        courseId,
        userId: studentId,
        role: CourseMembershipRole.STUDENT,
        removedAt: null,
      },
      select: {
        id: true,
      },
    })
    .then((membership) => membership !== null)
}
