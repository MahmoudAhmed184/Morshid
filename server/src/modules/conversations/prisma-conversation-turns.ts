import { Injectable } from '@nestjs/common'

import {
  MessageRequestKind,
  MessageRole,
  MessageStatus,
} from '../../generated/prisma/client'
import {
  lockAuthorizedStudentChat,
  lockStudentOwnedChat,
} from '../../common/authorization/locked-student-chat-session'
import {
  asPrismaTransaction,
  type DatabaseTransaction,
} from '../prisma/database-transaction'
import {
  ConversationTurns,
  type AdmitConversationTurnInput,
  type AdmittedTurn,
  type ConversationMessage,
  type ConversationMessageLookup,
  type FinalizeConversationMessageInput,
  type FinalizedMessage,
} from './conversation-turns'
import { PrismaService } from '../prisma/prisma.service'
import {
  chatMessageScalarSelect,
  chatMessageSelect,
  chatMessageSelectForStudent,
} from './conversation-repository.support'

@Injectable()
export class PrismaConversationTurns extends ConversationTurns {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async admit(
    input: AdmitConversationTurnInput,
    transaction: DatabaseTransaction,
  ): Promise<AdmittedTurn> {
    const tx = asPrismaTransaction(transaction)
    const authorization = await lockAuthorizedStudentChat(tx, input)
    if (authorization.kind !== 'ok') {
      return authorization
    }

    const activeAssistant = await tx.message.findFirst({
      where: {
        sessionId: input.sessionId,
        role: MessageRole.ASSISTANT,
        status: { in: [MessageStatus.PENDING, MessageStatus.STREAMING] },
      },
      select: { id: true },
    })
    if (activeAssistant !== null) {
      return { kind: 'turn_in_progress' }
    }

    if (input.kind === 'retry') {
      await tx.messageRetrieval.deleteMany({
        where: { messageId: input.assistantMessageId },
      })
      await tx.messageCitation.deleteMany({
        where: { messageId: input.assistantMessageId },
      })
      await tx.message.update({
        where: { id: input.studentMessageId },
        data: { attemptId: input.attemptId },
      })
      const assistantMessage = await tx.message.update({
        where: {
          id: input.assistantMessageId,
          sessionId: input.sessionId,
          role: MessageRole.ASSISTANT,
          responseToMessageId: input.studentMessageId,
        },
        data: {
          status: MessageStatus.PENDING,
          content: '',
          guidanceLabel: null,
          provider: null,
          model: null,
          promptVersion: null,
          inputTokens: null,
          outputTokens: null,
          errorCode: null,
          errorMessage: null,
          attemptId: input.attemptId,
          completedAt: null,
        },
        select: chatMessageSelect,
      })
      const studentMessage = await tx.message.findUniqueOrThrow({
        where: { id: input.studentMessageId },
        select: chatMessageSelect,
      })

      return {
        kind: 'admitted',
        studentMessage,
        assistantMessage,
      }
    }

    const studentSequence = authorization.session.lastSequence + 1
    const assistantSequence = studentSequence + 1
    const studentMessage = await tx.message.create({
      data: {
        id: input.studentMessageId,
        sessionId: input.sessionId,
        attemptId: input.attemptId,
        sequence: studentSequence,
        role: MessageRole.STUDENT,
        authorUserId: input.studentId,
        content: input.content,
        status: MessageStatus.COMPLETED,
        requestKind: input.requestKind,
        guidanceLabel: null,
        hintLevel: null,
        createdAt: input.now,
        completedAt: input.now,
      },
      select: chatMessageSelect,
    })
    const assistantMessage = await tx.message.create({
      data: {
        id: input.assistantMessageId,
        sessionId: input.sessionId,
        attemptId: input.attemptId,
        sequence: assistantSequence,
        role: MessageRole.ASSISTANT,
        authorUserId: null,
        responseToMessageId: studentMessage.id,
        content: '',
        status: MessageStatus.PENDING,
        requestKind: input.requestKind ?? MessageRequestKind.CONCEPTUAL,
        guidanceLabel: null,
        hintLevel: null,
        createdAt: input.now,
        completedAt: null,
      },
      select: chatMessageSelect,
    })
    await tx.chatSession.update({
      where: { id: input.sessionId },
      data: {
        lastSequence: assistantSequence,
        lastMessageAt: input.now,
      },
    })

    return {
      kind: 'admitted',
      studentMessage,
      assistantMessage,
    }
  }

  async finalize(
    input: FinalizeConversationMessageInput,
    transaction: DatabaseTransaction,
  ): Promise<FinalizedMessage> {
    const tx = asPrismaTransaction(transaction)
    const authorization =
      input.authorization === 'session_owner'
        ? await lockStudentOwnedChat(tx, input)
        : await lockAuthorizedStudentChat(tx, input)
    if (authorization.kind !== 'ok') {
      return authorization
    }

    const updated = await tx.message.updateManyAndReturn({
      where: {
        id: input.assistantMessageId,
        sessionId: input.sessionId,
        attemptId: input.attemptId,
        ...(input.topicId === undefined ? {} : { topicId: input.topicId }),
        role: MessageRole.ASSISTANT,
        status: MessageStatus.PENDING,
        responseToMessageId: input.studentMessageId,
      },
      data: {
        status: input.status,
        content: input.content,
        errorCode: input.errorCode ?? null,
        errorMessage: null,
        requestKind:
          input.requestKind === undefined ? undefined : input.requestKind,
        guidanceLabel:
          input.guidanceLabel === undefined ? undefined : input.guidanceLabel,
        hintLevel: input.hintLevel === undefined ? undefined : input.hintLevel,
        provider: input.provider === undefined ? undefined : input.provider,
        model: input.model === undefined ? undefined : input.model,
        promptVersion:
          input.promptVersion === undefined ? undefined : input.promptVersion,
        inputTokens:
          input.inputTokens === undefined ? undefined : input.inputTokens,
        outputTokens:
          input.outputTokens === undefined ? undefined : input.outputTokens,
        topicId: input.topicId === undefined ? undefined : input.topicId,
        completedAt: input.completedAt,
      },
      select: chatMessageScalarSelect,
      limit: 1,
    })
    const updatedMessage = updated.at(0)
    if (updatedMessage === undefined) {
      const existing = await tx.message.findUnique({
        where: { id: input.assistantMessageId },
        select: { id: true, status: true },
      })
      return existing === null
        ? { kind: 'message_not_found' }
        : { kind: 'message_not_pending' }
    }

    if (input.requestKind !== undefined) {
      await tx.message.update({
        where: { id: input.studentMessageId },
        data: { requestKind: input.requestKind },
      })
    }

    const message = await tx.message.findUnique({
      where: { id: updatedMessage.id },
      select: chatMessageSelect,
    })
    if (message === null) {
      return { kind: 'message_not_found' }
    }

    return { kind: 'finalized', message }
  }

  async find(
    input: ConversationMessageLookup & { readonly studentId?: string },
    transaction?: DatabaseTransaction,
  ): Promise<ConversationMessage | null> {
    const database =
      transaction === undefined
        ? this.prismaService
        : asPrismaTransaction(transaction)
    const { studentId, statuses, excludeId, ...lookup } = input

    const where = {
      ...lookup,
      ...(statuses === undefined ? {} : { status: { in: [...statuses] } }),
      ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
    }
    const message =
      studentId === undefined
        ? await database.message.findFirst({
            where,
            select: chatMessageSelect,
          })
        : await database.message.findFirst({
            where,
            select: chatMessageSelectForStudent(studentId),
          })

    return message
  }
}
