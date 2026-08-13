import {
  MessageRole,
  MessageStatus,
  RevealPolicy,
  StudentState,
} from '../../tutoring-values'
import {
  approximateAnalysisTokens,
  previousTeachingDecisionFromTopicState,
  selectAnalysisHistory,
  textReferencesFromTopicState,
} from './analysis-context-selector'
import type { AnalysisContextMessage } from './analysis-context.types'
import type { TopicStateSnapshot } from '../topic/topic-state.types'

const now = new Date('2026-08-03T12:00:00.000Z')

describe('analysis context selection', () => {
  it('selects same-topic history without the current student message and preserves chronology', () => {
    const selected = selectAnalysisHistory({
      activeTopicId: 'topic-1',
      studentMessageId: 'current',
      candidates: [
        message({ id: 'other-topic', sequence: 1, topicId: 'topic-2' }),
        message({ id: 'earlier', sequence: 2 }),
        message({
          id: 'question',
          sequence: 3,
          role: MessageRole.ASSISTANT,
          content: 'What value do you get next?',
        }),
        message({
          id: 'attempt',
          sequence: 4,
          role: MessageRole.STUDENT,
          content: 'I think it is 42',
        }),
        message({ id: 'current', sequence: 5 }),
      ],
      historyTokenBudget: 100,
      historyMessageLimit: 10,
    })

    expect(selected.selectedHistory.map((entry) => entry.id)).toEqual([
      'earlier',
      'question',
      'attempt',
    ])
    expect(selected.previousTutorQuestion).toMatchObject({
      source: 'selected_history',
      messageId: 'question',
      sequence: 3,
    })
    expect(selected.previousStudentAttempt).toMatchObject({
      source: 'selected_history',
      messageId: 'attempt',
      sequence: 4,
    })
  })

  it('deduplicates candidates and applies bounded history controls', () => {
    const selected = selectAnalysisHistory({
      activeTopicId: 'topic-1',
      studentMessageId: 'current',
      candidates: [
        message({ id: 'older', sequence: 1, content: 'x'.repeat(80) }),
        message({ id: 'older', sequence: 1, content: 'duplicate' }),
        message({ id: 'recent', sequence: 2, content: 'short' }),
      ],
      historyTokenBudget: 5,
      historyMessageLimit: 1,
    })

    expect(selected.selectedHistory.map((entry) => entry.id)).toEqual([
      'recent',
    ])
    expect(selected.tokenBudget).toEqual({
      maxHistoryTokens: 5,
      maxHistoryMessages: 1,
      approximateHistoryTokens: approximateAnalysisTokens('short'),
      tokenizer: 'char_approximation_v1',
    })
  })

  it('uses a safe default for zero budget inputs', () => {
    const selected = selectAnalysisHistory({
      activeTopicId: 'topic-1',
      studentMessageId: 'current',
      candidates: [message({ id: 'history', sequence: 1 })],
      historyTokenBudget: 0,
      historyMessageLimit: 0,
    })

    expect(selected.selectedHistory.map((entry) => entry.id)).toEqual([
      'history',
    ])
    expect(selected.tokenBudget.maxHistoryTokens).toBe(1200)
    expect(selected.tokenBudget.maxHistoryMessages).toBe(24)
  })

  it('keeps messages that exactly fit the token budget and skips overflow', () => {
    const exact = 'abcdefghijkl'
    const selected = selectAnalysisHistory({
      activeTopicId: 'topic-1',
      studentMessageId: 'current',
      candidates: [
        message({ id: 'overflow', sequence: 1, content: 'abcd' }),
        message({ id: 'exact-fit', sequence: 2, content: exact }),
      ],
      historyTokenBudget: approximateAnalysisTokens(exact),
      historyMessageLimit: 3,
    })

    expect(selected.selectedHistory.map((entry) => entry.id)).toEqual([
      'exact-fit',
    ])
    expect(selected.tokenBudget.approximateHistoryTokens).toBe(
      approximateAnalysisTokens(exact),
    )
  })

  it('returns empty selected history when the only candidate exceeds the budget', () => {
    const selected = selectAnalysisHistory({
      activeTopicId: 'topic-1',
      studentMessageId: 'current',
      candidates: [
        message({
          id: 'oversized',
          sequence: 1,
          content: 'x'.repeat(80),
        }),
      ],
      historyTokenBudget: 2,
      historyMessageLimit: 3,
    })

    expect(selected.selectedHistory).toEqual([])
    expect(selected.tokenBudget.approximateHistoryTokens).toBe(0)
  })

  it('does not spend budget twice for duplicate messages under constrained budget', () => {
    const selected = selectAnalysisHistory({
      activeTopicId: 'topic-1',
      studentMessageId: 'current',
      candidates: [
        message({ id: 'same', sequence: 1, content: 'abcd' }),
        message({ id: 'same', sequence: 1, content: 'wxyz' }),
      ],
      historyTokenBudget: 1,
      historyMessageLimit: 2,
    })

    expect(selected.selectedHistory.map((entry) => entry.id)).toEqual(['same'])
    expect(selected.tokenBudget.approximateHistoryTokens).toBe(1)
  })

  it('excludes incomplete, failed, blocked, and unsupported-role candidates', () => {
    const selected = selectAnalysisHistory({
      activeTopicId: 'topic-1',
      studentMessageId: 'current',
      candidates: [
        message({ id: 'complete', sequence: 1 }),
        message({
          id: 'pending',
          sequence: 2,
          role: MessageRole.ASSISTANT,
          status: MessageStatus.PENDING,
        }),
        message({
          id: 'failed',
          sequence: 3,
          role: MessageRole.ASSISTANT,
          status: MessageStatus.FAILED,
        }),
        message({
          id: 'blocked',
          sequence: 4,
          role: MessageRole.ASSISTANT,
          status: MessageStatus.BLOCKED,
        }),
        message({
          id: 'system',
          sequence: 5,
          role: MessageRole.SYSTEM,
        }),
      ],
      historyTokenBudget: 100,
      historyMessageLimit: 10,
    })

    expect(selected.selectedHistory.map((entry) => entry.id)).toEqual([
      'complete',
    ])
  })

  it('does not mutate candidates and is deterministic for identical input', () => {
    const candidates = [
      message({ id: 'later', sequence: 2 }),
      message({ id: 'earlier', sequence: 1 }),
    ]
    const originalOrder = candidates.map((candidate) => candidate.id)

    const first = selectAnalysisHistory({
      activeTopicId: 'topic-1',
      studentMessageId: 'current',
      candidates,
      historyTokenBudget: 100,
      historyMessageLimit: 10,
    })
    const second = selectAnalysisHistory({
      activeTopicId: 'topic-1',
      studentMessageId: 'current',
      candidates,
      historyTokenBudget: 100,
      historyMessageLimit: 10,
    })

    expect(candidates.map((candidate) => candidate.id)).toEqual(originalOrder)
    expect(first).toEqual(second)
  })

  it('falls back to TopicState text references when selected history has none', () => {
    const references = textReferencesFromTopicState({
      topicState: topicState({
        lastTutorQuestion: 'Can you isolate x?',
        lastStudentAction: 'Subtracted 3 from both sides',
      }),
      previousTutorQuestion: null,
      previousStudentAttempt: null,
    })

    expect(references.previousTutorQuestion).toEqual({
      source: 'topic_state',
      content: 'Can you isolate x?',
      messageId: null,
      sequence: null,
    })
    expect(references.previousStudentAttempt).toEqual({
      source: 'topic_state',
      content: 'Subtracted 3 from both sides',
      messageId: null,
      sequence: null,
    })
  })

  it('surfaces prior teaching decision fields only when TopicState has a strategy or technique', () => {
    expect(previousTeachingDecisionFromTopicState(topicState())).toBeNull()

    expect(
      previousTeachingDecisionFromTopicState(
        topicState({ activeStrategy: 'SOCRATIC_QUESTIONING' }),
      ),
    ).toMatchObject({
      source: 'topic_state',
      activeStrategy: 'SOCRATIC_QUESTIONING',
      guidanceLevel: 1,
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    })
  })
})

function message(
  input: Partial<AnalysisContextMessage>,
): AnalysisContextMessage {
  return {
    id: input.id ?? 'message-1',
    sequence: input.sequence ?? 1,
    role: input.role ?? MessageRole.STUDENT,
    attemptId: input.attemptId ?? null,
    topicId: input.topicId === undefined ? 'topic-1' : input.topicId,
    authorUserId: input.authorUserId ?? 'student-1',
    responseToMessageId: input.responseToMessageId ?? null,
    content: input.content ?? 'message content',
    status: input.status ?? MessageStatus.COMPLETED,
    requestKind: input.requestKind ?? null,
    guidanceLabel: input.guidanceLabel ?? null,
    hintLevel: input.hintLevel ?? null,
    createdAt: input.createdAt ?? now,
    completedAt: input.completedAt ?? now,
  }
}

function topicState(
  input: Partial<TopicStateSnapshot> = {},
): TopicStateSnapshot {
  return {
    id: 'state-1',
    topicId: 'topic-1',
    version: 1,
    requestKind: null,
    studentState: StudentState.UNKNOWN,
    activeStrategy: null,
    primaryTechnique: null,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    attemptCount: 0,
    meaningfulAttemptCount: 0,
    misconceptionStatus: null,
    learningStatus: 'UNKNOWN',
    resolutionEvidenceStrength: 'NONE',
    summary: null,
    lastTutorQuestion: null,
    lastStudentAction: null,
    resolved: false,
    updatedAt: now,
    ...input,
  }
}
