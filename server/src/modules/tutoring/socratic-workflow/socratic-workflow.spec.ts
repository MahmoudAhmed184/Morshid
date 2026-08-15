import { MessageRequestKind, TutoringAttemptStatus } from '../tutoring-values'
import { SocraticWorkflow } from './socratic-workflow'
import { TOPIC_RESOLUTION_OUTCOME } from './topic/topic.types'

const attemptId = 'turn-1'
const courseId = 'course-1'
const sessionId = 'session-1'
const studentId = 'student-1'
const studentMessageId = 'student-message-1'
const assistantMessageId = 'assistant-message-1'
const topicId = 'topic-1'

describe('SocraticWorkflow classified responses', () => {
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
      const courseEvidence = {
        search: jest.fn(),
      }
      const responseApprovalService = {
        approve: jest.fn(),
      }
      const semanticGuard = {
        evaluate: jest.fn(),
      }
      const transitionAttempt = jest.fn().mockResolvedValue(true)
      const resolveTopic = jest.fn().mockResolvedValue({
        outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
        topicId,
        previousTopicId: null,
        confidence: 1,
        stableIdentitySource: 'PROBLEM_ID',
        reason: 'test topic',
      })
      const orchestrator = new SocraticWorkflow(
        {
          transitionAttempt,
        } as never,
        {
          resolveTopic,
        } as never,
        { getOrCreate: jest.fn().mockResolvedValue({ version: 1 }) } as never,
        {
          resolve: jest.fn().mockResolvedValue({
            protectTargetSolution: true,
            topicId,
            source: 'AUTHORITATIVE_TASK_METADATA',
            policyVersion: 'solution-protection.v1',
          }),
        } as never,
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
        courseEvidence,
        {
          detectStudentInput: jest.fn().mockReturnValue(null),
          detectRetrievedDocuments: jest.fn(),
          detectOutput: jest.fn(),
        },
        { detect: jest.fn() },
      )

      const result = await orchestrator.run({
        courseId,
        sessionId,
        studentId,
        attemptId,
        studentMessageId,
        assistantMessageId,
        studentMessageContent: 'classified request',
        explicitProtectedSolutionSignal: false,
        topicSelection: {
          problemId: 'problem-1',
          title: 'Problem topic',
        },
      })

      expect(result).toMatchObject({
        kind: 'completed',
        completion: {
          kind: 'classified',
          topicId,
          errorCode,
        },
      })
      expect(transitionAttempt).toHaveBeenCalledWith({
        courseId,
        sessionId,
        studentId,
        attemptId,
        expectedStatus: TutoringAttemptStatus.RECEIVED,
        nextStatus: TutoringAttemptStatus.ANALYZING,
        topicId,
      })
      expect(resolveTopic).toHaveBeenCalledWith({
        sessionId,
        courseId,
        topicId: undefined,
        problemId: 'problem-1',
        conceptId: undefined,
        title: 'Problem topic',
      })
      expect(teachingPolicyEngine.findPreviousDecision).not.toHaveBeenCalled()
      expect(teachingPolicyEngine.selectDecision).not.toHaveBeenCalled()
      expect(courseEvidence.search).not.toHaveBeenCalled()
      expect(responseApprovalService.approve).not.toHaveBeenCalled()
      expect(semanticGuard.evaluate).not.toHaveBeenCalled()
      expect(transitionAttempt).not.toHaveBeenCalledWith(
        attemptId,
        TutoringAttemptStatus.ANALYZING,
        TutoringAttemptStatus.DECIDING,
      )
    },
  )
})
