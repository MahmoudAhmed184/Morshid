import { Injectable } from '@nestjs/common'

import {
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  chatMessageSelect,
  chatMessageSelectForStudent,
  chatMessageScalarSelect,
  currentDatabaseTime,
  hasActiveStudentMembershipInTransaction,
  ownedActiveSessionWhere,
} from './student-chat.repository.support'
import type {
  AppendPendingAssistantMessageInput,
  AppendStudentMessageInput,
  BlockAssistantMessageInput,
  ChatMessageRecord,
  CompleteAssistantMessageInput,
  FailAssistantMessageInput,
  MessageListPagination,
  MessagePersistenceResult,
} from './student-chat.repository.types'

export abstract class StudentChatMessageRepository {
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
export class PrismaStudentChatMessageRepository extends StudentChatMessageRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
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

    const before = pagination.before
    const isLoadingLatestOrEarlier =
      pagination.latest === true || (before !== undefined && before !== null)
    const sequenceFilter =
      pagination.after !== undefined && pagination.after !== null
        ? { gt: pagination.after }
        : before !== undefined && before !== null
          ? { lt: before }
          : undefined
    const messages = await this.prismaService.message.findMany({
      where: {
        sessionId: session.id,
        ...(sequenceFilter === undefined ? {} : { sequence: sequenceFilter }),
      },
      select: chatMessageSelectForStudent(studentId),
      orderBy: {
        sequence: isLoadingLatestOrEarlier ? 'desc' : 'asc',
      },
      take: pagination.limit,
    })

    return isLoadingLatestOrEarlier ? messages.reverse() : messages
  }

  async appendStudentMessage(
    input: AppendStudentMessageInput,
  ): Promise<MessagePersistenceResult> {
    const data = {
      role: MessageRole.STUDENT,
      authorUserId: input.studentId,
      content: input.content,
      status: MessageStatus.COMPLETED,
      attemptId: input.attemptId ?? null,
      topicId: input.topicId ?? null,
      requestKind: input.requestKind ?? null,
      guidanceLabel: input.guidanceLabel ?? null,
      hintLevel: input.hintLevel ?? null,
    }
    validateTrustedMessageFields(data, {
      role: MessageRole.STUDENT,
      approvedAssistant: false,
    })

    return this.appendMessage(input, data)
  }

  async appendPendingAssistantMessage(
    input: AppendPendingAssistantMessageInput,
  ): Promise<MessagePersistenceResult> {
    const data = {
      role: MessageRole.ASSISTANT,
      authorUserId: null,
      responseToMessageId: input.responseToMessageId ?? null,
      content: input.content ?? '',
      status: MessageStatus.PENDING,
      attemptId: input.attemptId ?? null,
      topicId: input.topicId ?? null,
      requestKind: input.requestKind ?? null,
      guidanceLabel: input.guidanceLabel ?? null,
      hintLevel: input.hintLevel ?? null,
    }
    validateTrustedMessageFields(data, {
      role: MessageRole.ASSISTANT,
      approvedAssistant: false,
    })

    return this.appendMessage(input, data)
  }

  async completeAssistantMessage(
    input: CompleteAssistantMessageInput,
  ): Promise<MessagePersistenceResult> {
    const data = {
      status: MessageStatus.COMPLETED,
      content: input.content,
      completedAt: new Date(),
      provider: input.provider ?? null,
      model: input.model ?? null,
      promptVersion: input.promptVersion ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      attemptId: input.attemptId === undefined ? undefined : input.attemptId,
      topicId: input.topicId === undefined ? undefined : input.topicId,
      hintLevel: input.hintLevel === undefined ? undefined : input.hintLevel,
      // Preserve an explicit `null` (re-classify as unlabeled); only `undefined`
      // means "leave the pending label unchanged".
      guidanceLabel:
        input.guidanceLabel === undefined ? undefined : input.guidanceLabel,
      errorCode: null,
      errorMessage: null,
    }
    validateTrustedMessageFields(data, {
      role: MessageRole.ASSISTANT,
      approvedAssistant: true,
    })

    return this.updateAssistantMessage(input, data)
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

  private async appendMessage(
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

  private async updateAssistantMessage(
    input:
      | CompleteAssistantMessageInput
      | FailAssistantMessageInput
      | BlockAssistantMessageInput,
    data: Prisma.MessageUncheckedUpdateManyInput,
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
        select: chatMessageScalarSelect,
        limit: 1,
      })
      const updated = messages.at(0)

      if (updated === undefined) {
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

      const message = await tx.message.findUniqueOrThrow({
        where: { id: updated.id },
        select: chatMessageSelect,
      })
      return { kind: 'ok', message }
    })
  }
}

function validateTrustedMessageFields(
  data: {
    requestKind?: unknown
    hintLevel?: unknown
  },
  context: {
    role: MessageRole
    approvedAssistant: boolean
  },
): void {
  const requestKind = data.requestKind
  if (
    requestKind !== undefined &&
    requestKind !== null &&
    !Object.values(MessageRequestKind).includes(
      requestKind as MessageRequestKind,
    )
  ) {
    throw new Error('Message requestKind must use MessageRequestKind')
  }
  if (
    requestKind !== undefined &&
    requestKind !== null &&
    context.role !== MessageRole.STUDENT
  ) {
    throw new Error(
      'Message requestKind is only supported for student messages',
    )
  }

  const hintLevel = data.hintLevel
  if (
    hintLevel !== undefined &&
    hintLevel !== null &&
    (typeof hintLevel !== 'number' ||
      !Number.isInteger(hintLevel) ||
      hintLevel < 1 ||
      hintLevel > 4)
  ) {
    throw new Error('Message hintLevel must be between 1 and 4')
  }
  if (
    hintLevel !== undefined &&
    hintLevel !== null &&
    !(context.role === MessageRole.ASSISTANT && context.approvedAssistant)
  ) {
    throw new Error(
      'Message hintLevel is only supported for approved assistant messages',
    )
  }
}
