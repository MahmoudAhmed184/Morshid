import type { ChatMessage } from '@/features/chat/messages/chat-message.schema'
import type { ChatSessionSummary } from '@/features/chat/sessions/chat-session.schema'

export const MAX_CONVERSATION_TURNS = 30
export const MAX_CONTEXT_TOKENS = 258_000

export interface ConversationMetrics {
  turnsUsed: number
  turnsRemaining: number
  turnLimit: number
  contextTokens: number
  maxContextTokens: number
  contextPercent: number
  totalProcessedTokens: number
}

/**
 * Calculates authoritative conversation metrics and token usage from an authoritative
 * backend session summary or loaded chat message accounting.
 */
export function calculateConversationMetrics(
  messages: readonly ChatMessage[] = [],
  summary?: ChatSessionSummary | null,
): ConversationMetrics {
  if (summary) {
    return {
      turnsUsed: summary.turnsUsed,
      turnsRemaining: summary.turnsRemaining,
      turnLimit: summary.turnLimit,
      contextTokens: summary.contextTokens,
      maxContextTokens: summary.maxContextTokens,
      contextPercent: summary.contextPercent,
      totalProcessedTokens: summary.totalProcessedTokens ?? 0,
    }
  }

  const studentMessages = messages.filter(
    (m) => m.role === 'STUDENT' && m.status !== 'FAILED',
  )
  const turnsUsed = studentMessages.length
  const turnLimit = MAX_CONVERSATION_TURNS
  const turnsRemaining = Math.max(0, turnLimit - turnsUsed)

  if (messages.length === 0) {
    return {
      turnsUsed: 0,
      turnsRemaining: turnLimit,
      turnLimit,
      contextTokens: 0,
      maxContextTokens: MAX_CONTEXT_TOKENS,
      contextPercent: 0,
      totalProcessedTokens: 0,
    }
  }

  const contextTokens = 0
  const maxContextTokens = MAX_CONTEXT_TOKENS
  const contextPercent = Math.min(
    100,
    Math.max(0, Math.round((contextTokens / maxContextTokens) * 100)),
  )

  const totalProcessedTokens = 0

  return {
    turnsUsed,
    turnsRemaining,
    turnLimit,
    contextTokens,
    maxContextTokens,
    contextPercent,
    totalProcessedTokens,
  }
}

/**
 * Formats token counts cleanly: e.g. 258000 -> 258k, 7700000 -> 7.7m, 420 -> 420.
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000
    return millions % 1 === 0
      ? `${millions.toFixed(0)}m`
      : `${millions.toFixed(1)}m`
  }
  if (tokens >= 1_000) {
    const thousands = tokens / 1_000
    return thousands % 1 === 0
      ? `${thousands.toFixed(0)}k`
      : `${Math.round(thousands)}k`
  }
  return `${tokens}`
}
