import {
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  TutoringAttemptStatus,
} from '../../generated/prisma/client'
import type { ChatMessageRecord } from './student-chat.repository.types'
import { SocraticChatOrchestrator } from './socratic-chat.orchestrator'
import { TURN_ACQUISITION_OUTCOME } from '../socratic-tutor/turn.types'
import { TOPIC_RESOLUTION_OUTCOME } from '../socratic-tutor/topic.types'

const attemptId = 'turn-1'
const courseId = 'course-1'
const sessionId = 'session-1'
const studentId = 'student-1'
const studentMessageId = 'student-message-1'
const assistantMessageId = 'assistant-message-1'
const topicId = 'topic-1'

describe('SocraticChatOrchestrator classified responses', () => {
  it.each([
    [MessageRequestKind.UNSAFE, 'SOCRATIC_UNSAFE_REQUEST'],
    [MessageRequestKind.OFF_TOPIC, 'SOCRATIC_OFF_TOPIC_REQUEST'],
  ])(
    'terminates %s before teaching, retrieval, generation, or semantic guard',
    async (requestKind, errorCode) => {
      const teachingPolicyEngine = {
        findPreviousDecision: jest.fn(),
        selectDecision: jest.fn(),
      }
      const retrievalService = {
        retrieveCourseEvidence: jest.fn(),
      }
      const responseApprovalService = {
        approveAndPersist: jest.fn(),
      }
      const semanticGuard = {
        evaluate: jest.fn(),
      }
      const completeClassifiedResponse = jest.fn().mockResolvedValue({
        kind: 'ok',
        turn: {
          id: attemptId,
          status: TutoringAttemptStatus.COMPLETED,
        },
      })
      const studentMessage = buildMessage({
        id: studentMessageId,
        role: MessageRole.STUDENT,
        status: MessageStatus.COMPLETED,
        requestKind,
      })
      const assistantMessage = buildMessage({
        id: assistantMessageId,
        role: MessageRole.ASSISTANT,
        status: MessageStatus.COMPLETED,
        requestKind,
        guidanceLabel:
          requestKind === MessageRequestKind.UNSAFE
            ? MessageGuidanceLabel.REFUSAL
            : MessageGuidanceLabel.GENERAL_NOT_FOUND,
        content:
          requestKind === MessageRequestKind.UNSAFE
            ? 'I can’t help with unsafe requests.'
            : 'Let’s keep this focused on the course.',
      })
      const transitionStatus = jest.fn()
      const resolveTopic = jest.fn().mockResolvedValue({
        outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
        topicId,
        previousTopicId: null,
        confidence: 1,
        stableIdentitySource: 'PROBLEM_ID',
        reason: 'test topic',
      })
      const orchestrator = new SocraticChatOrchestrator(
        {
          getOrCreate: jest.fn().mockResolvedValue({
            outcome: TURN_ACQUISITION_OUTCOME.CREATED,
            turn: { id: attemptId },
          }),
          linkStudentMessage: jest.fn().mockResolvedValue(undefined),
          attachResolvedTopic: jest.fn().mockResolvedValue(undefined),
          transitionStatus,
          completeClassifiedResponse,
          markFailed: jest.fn(),
        } as never,
        {
          resolveTopic,
        } as never,
        { getOrCreate: jest.fn().mockResolvedValue({ version: 1 }) } as never,
        {
          buildAnalysisContext: jest.fn().mockResolvedValue({}),
        } as never,
        {
          analyze: jest.fn().mockResolvedValue({
            success: true,
            analysis: {
              result: { requestKind },
            },
          }),
        } as never,
        teachingPolicyEngine as never,
        responseApprovalService as never,
        { build: jest.fn() },
        retrievalService as never,
        {
          message: {
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
            findUniqueOrThrow: jest.fn(({ where }: { where: { id: string } }) =>
              Promise.resolve(
                where.id === studentMessageId
                  ? studentMessage
                  : assistantMessage,
              ),
            ),
          },
        } as never,
        {
          detectStudentInput: jest.fn().mockReturnValue(null),
          detectRetrievedDocuments: jest.fn(),
          detectOutput: jest.fn(),
        },
        { detect: jest.fn() },
      )

      const result = await orchestrator.orchestrate({
        courseId,
        sessionId,
        studentId,
        studentMessageId,
        assistantMessageId,
        studentMessageContent: 'classified request',
        topicSelection: {
          problemId: 'problem-1',
          title: 'Problem topic',
        },
        clientMessageId: 'idempotency-key',
      })

      expect(result).toMatchObject({
        kind: 'completed',
        assistantMessage: {
          id: assistantMessageId,
          status: MessageStatus.COMPLETED,
        },
      })
      expect(completeClassifiedResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId,
          sessionId,
          studentId,
          attemptId,
          topicId,
          studentMessageId,
          assistantMessageId,
          requestKind,
          errorCode,
          expectedTurnStatus: TutoringAttemptStatus.ANALYZING,
        }),
      )
      expect(resolveTopic).toHaveBeenCalledWith({
        sessionId,
        courseId,
        topicId: undefined,
        problemId: 'problem-1',
        conceptId: undefined,
        title: 'Problem topic',
      })
      expect(transitionStatus).toHaveBeenCalledWith(
        attemptId,
        TutoringAttemptStatus.RECEIVED,
        TutoringAttemptStatus.ANALYZING,
      )
      expect(teachingPolicyEngine.findPreviousDecision).not.toHaveBeenCalled()
      expect(teachingPolicyEngine.selectDecision).not.toHaveBeenCalled()
      expect(retrievalService.retrieveCourseEvidence).not.toHaveBeenCalled()
      expect(responseApprovalService.approveAndPersist).not.toHaveBeenCalled()
      expect(semanticGuard.evaluate).not.toHaveBeenCalled()
      expect(transitionStatus).not.toHaveBeenCalledWith(
        attemptId,
        TutoringAttemptStatus.ANALYZING,
        TutoringAttemptStatus.DECIDING,
      )
    },
  )
})

function buildMessage(
  overrides: Partial<ChatMessageRecord> = {},
): ChatMessageRecord {
  return {
    id: 'message-1',
    sequence: 1,
    role: MessageRole.STUDENT,
    attemptId,
    topicId,
    authorUserId: studentId,
    responseToMessageId: null,
    content: 'test message',
    status: MessageStatus.COMPLETED,
    requestKind: null,
    guidanceLabel: null,
    hintLevel: null,
    promptVersion: null,
    errorCode: null,
    createdAt: new Date('2026-08-11T00:00:00.000Z'),
    completedAt: new Date('2026-08-11T00:00:00.000Z'),
    reviewCase: null,
    citations: [],
    retrievals: [],
    ...overrides,
  }
}
