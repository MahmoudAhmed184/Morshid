import { isApiError } from '@/lib/http/http'

export const CHAT_ERROR_CODES = {
  SESSION_NOT_FOUND: 'CONVERSATION_SESSION_NOT_FOUND',
  TERMINAL_STATE_UNAVAILABLE: 'CONVERSATION_TERMINAL_STATE_UNAVAILABLE',
  TURN_IN_PROGRESS: 'CONVERSATION_TURN_IN_PROGRESS',
  TUTORING_ALLOWANCE_EXHAUSTED: 'TUTORING_ALLOWANCE_EXHAUSTED',
} as const

type ChatErrorCode = (typeof CHAT_ERROR_CODES)[keyof typeof CHAT_ERROR_CODES]

export function isChatApiError(error: unknown, code: ChatErrorCode) {
  return isApiError(error) && error.code === code
}
