import { Injectable } from '@nestjs/common'

import {
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  Prisma,
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
  type FinalizeConversationMessageInput,
  type FinalizedMessage,
} from './conversation-turns'

const messageSelect = {
  id: true,
  sessionId: true,
  attemptId: true,
  sequence: true,
  role: true,
  status: true,
  content: true,
  completedAt: true,
} satisfies Prisma.MessageSelect

@Injectable()
export class PrismaConversationTurns extends ConversationTurns {
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
      select: messageSelect,
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
      select: messageSelect,
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
      studentMessage: toConversationMessage(studentMessage),
      assistantMessage: toConversationMessage(assistantMessage),
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
      select: messageSelect,
      limit: 1,
    })
    const message = updated.at(0)
    if (message === undefined) {
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

    return { kind: 'finalized', message: toConversationMessage(message) }
  }
}

function toConversationMessage(
  message: Prisma.MessageGetPayload<{ select: typeof messageSelect }>,
): ConversationMessage {
  const role =
    message.role === MessageRole.STUDENT ||
    message.role === MessageRole.ASSISTANT
      ? message.role
      : (() => {
          throw new Error(
            `Unsupported conversation message role: ${message.role}`,
          )
        })()

  return {
    id: message.id,
    sessionId: message.sessionId,
    attemptId: message.attemptId,
    sequence: message.sequence,
    role,
    status: message.status,
    content: message.content,
    completedAt: message.completedAt,
  }
}
