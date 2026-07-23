import { isApiError } from '@/lib/api/http'

export const STUDENT_CHAT_ERROR_CODES = {
  SESSION_NOT_FOUND: 'STUDENT_CHAT_SESSION_NOT_FOUND',
  TERMINAL_STATE_UNAVAILABLE: 'STUDENT_CHAT_TERMINAL_STATE_UNAVAILABLE',
  TURN_IN_PROGRESS: 'STUDENT_CHAT_TURN_IN_PROGRESS',
} as const

type StudentChatErrorCode =
  (typeof STUDENT_CHAT_ERROR_CODES)[keyof typeof STUDENT_CHAT_ERROR_CODES]

export function isStudentChatApiError(
  error: unknown,
  code: StudentChatErrorCode,
) {
  return isApiError(error) && error.code === code
}
