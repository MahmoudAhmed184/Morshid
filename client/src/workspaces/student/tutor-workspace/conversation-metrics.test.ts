import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/features/chat/messages/chat-message.schema'
import {
  calculateConversationMetrics,
  formatTokens,
  MAX_CONVERSATION_TURNS,
  MAX_CONTEXT_TOKENS,
} from './conversation-metrics'

describe('conversation-metrics', () => {
  it('returns default zero values for an empty messages list', () => {
    const metrics = calculateConversationMetrics([])
    expect(metrics).toEqual({
      turnsUsed: 0,
      turnsRemaining: 30,
      turnLimit: 30,
      contextTokens: 0,
      maxContextTokens: 258_000,
      contextPercent: 0,
      totalProcessedTokens: 0,
    })
  })

  it('calculates turns used and remaining from messages', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        sequence: 1,
        role: 'STUDENT',
        attemptId: null,
        topicId: null,
        responseToMessageId: null,
        content: 'Hello, I have a question about variables.',
        status: 'COMPLETED',
        requestKind: null,
        guidanceLabel: null,
        hintLevel: null,
        promptVersion: null,
        errorCode: null,
        createdAt: '2026-08-20T12:00:00.000Z',
        completedAt: '2026-08-20T12:00:00.000Z',
        citations: [],
        reviewSummary: null,
      },
      {
        id: 'msg-2',
        sequence: 2,
        role: 'ASSISTANT',
        attemptId: null,
        topicId: null,
        responseToMessageId: 'msg-1',
        content:
          'Sure! What specific aspect of variables would you like to explore?',
        status: 'COMPLETED',
        requestKind: null,
        guidanceLabel: null,
        hintLevel: null,
        promptVersion: null,
        errorCode: null,
        createdAt: '2026-08-20T12:00:01.000Z',
        completedAt: '2026-08-20T12:00:02.000Z',
        citations: [],
        reviewSummary: null,
      },
      {
        id: 'msg-3',
        sequence: 3,
        role: 'STUDENT',
        attemptId: null,
        topicId: null,
        responseToMessageId: null,
        content: 'How does scope work in functions?',
        status: 'COMPLETED',
        requestKind: null,
        guidanceLabel: null,
        hintLevel: null,
        promptVersion: null,
        errorCode: null,
        createdAt: '2026-08-20T12:01:00.000Z',
        completedAt: '2026-08-20T12:01:00.000Z',
        citations: [],
        reviewSummary: null,
      },
    ]

    const metrics = calculateConversationMetrics(messages)
    expect(metrics.turnsUsed).toBe(2)
    expect(metrics.turnsRemaining).toBe(28)
    expect(metrics.turnLimit).toBe(MAX_CONVERSATION_TURNS)
    expect(metrics.contextTokens).toBe(0)
    expect(metrics.maxContextTokens).toBe(MAX_CONTEXT_TOKENS)
  })

  it('uses authoritative summary when provided', () => {
    const summary = {
      turnsUsed: 4,
      turnLimit: 30,
      turnsRemaining: 26,
      isTurnLimitExhausted: false,
      contextTokens: 40_000,
      maxContextTokens: 258_000,
      contextPercent: 16,
      totalProcessedTokens: 120_000,
      policyDay: '2026-08-20',
      policyTimeZone: 'Africa/Cairo',
      resetAt: '2026-08-21T00:00:00.000Z',
    }

    const metrics = calculateConversationMetrics([], summary)
    expect(metrics).toEqual({
      turnsUsed: 4,
      turnsRemaining: 26,
      turnLimit: 30,
      contextTokens: 40_000,
      maxContextTokens: 258_000,
      contextPercent: 16,
      totalProcessedTokens: 120_000,
    })
  })

  it('formats token strings cleanly', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(420)).toBe('420')
    expect(formatTokens(1_000)).toBe('1k')
    expect(formatTokens(40_000)).toBe('40k')
    expect(formatTokens(258_000)).toBe('258k')
    expect(formatTokens(1_000_000)).toBe('1m')
    expect(formatTokens(7_700_000)).toBe('7.7m')
  })
})
