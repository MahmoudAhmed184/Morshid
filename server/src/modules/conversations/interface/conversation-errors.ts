import {
  BadRequestException,
  ForbiddenException,
  type HttpException,
  NotFoundException,
} from '@nestjs/common'

export const CONVERSATION_ERROR_CODES = {
  INVALID_REQUEST: 'CONVERSATION_INVALID_REQUEST',
  ACTIVE_STUDENT_MEMBERSHIP_REQUIRED:
    'CONVERSATION_ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
  SESSION_NOT_FOUND: 'CONVERSATION_SESSION_NOT_FOUND',
  IDEMPOTENCY_KEY_REUSED: 'CONVERSATION_IDEMPOTENCY_KEY_REUSED',
  TURN_IN_PROGRESS: 'CONVERSATION_TURN_IN_PROGRESS',
  RETRY_NOT_ALLOWED: 'CONVERSATION_RETRY_NOT_ALLOWED',
  RETRY_TARGET_NOT_FOUND: 'CONVERSATION_RETRY_TARGET_NOT_FOUND',
  TERMINAL_STATE_UNAVAILABLE: 'CONVERSATION_TERMINAL_STATE_UNAVAILABLE',
} as const

export interface ConversationValidationIssue {
  field: string
  message: string
}

export function invalidConversationRequestException(
  errors: ConversationValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: CONVERSATION_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid conversation request',
    errors,
  })
}

export function activeStudentMembershipRequiredException(): HttpException {
  return new ForbiddenException({
    code: CONVERSATION_ERROR_CODES.ACTIVE_STUDENT_MEMBERSHIP_REQUIRED,
    message: 'Active student course membership is required',
  })
}

export function conversationSessionNotFoundException(): HttpException {
  return new NotFoundException({
    code: CONVERSATION_ERROR_CODES.SESSION_NOT_FOUND,
    message: 'Conversation session was not found',
  })
}
