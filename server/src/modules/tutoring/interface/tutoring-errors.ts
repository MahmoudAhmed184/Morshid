import {
  ConflictException,
  ForbiddenException,
  type HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'

// These wire codes remain stable for the current chat API while the turn
// admission and execution errors are owned by Tutoring rather than the HTTP
// session adapter.
export const TUTORING_ERROR_CODES = {
  ACTIVE_STUDENT_MEMBERSHIP_REQUIRED:
    'STUDENT_CHAT_ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
  SESSION_NOT_FOUND: 'STUDENT_CHAT_SESSION_NOT_FOUND',
  TURN_IN_PROGRESS: 'STUDENT_CHAT_TURN_IN_PROGRESS',
  RETRY_NOT_ALLOWED: 'STUDENT_CHAT_RETRY_NOT_ALLOWED',
  RETRY_TARGET_NOT_FOUND: 'STUDENT_CHAT_RETRY_TARGET_NOT_FOUND',
  TERMINAL_STATE_UNAVAILABLE: 'STUDENT_CHAT_TERMINAL_STATE_UNAVAILABLE',
} as const

export function tutoringActiveStudentMembershipRequiredException(): HttpException {
  return new ForbiddenException({
    code: TUTORING_ERROR_CODES.ACTIVE_STUDENT_MEMBERSHIP_REQUIRED,
    message: 'Active student course membership is required',
  })
}

export function tutoringSessionNotFoundException(): HttpException {
  return new NotFoundException({
    code: TUTORING_ERROR_CODES.SESSION_NOT_FOUND,
    message: 'Chat session was not found',
  })
}

export function tutoringTurnInProgressException(): HttpException {
  return new ConflictException({
    code: TUTORING_ERROR_CODES.TURN_IN_PROGRESS,
    message: 'A student chat turn is already in progress',
  })
}

export function tutoringRetryNotAllowedException(): HttpException {
  return new ConflictException({
    code: TUTORING_ERROR_CODES.RETRY_NOT_ALLOWED,
    message: 'Only a failed or expired assistant response can be retried',
  })
}

export function tutoringRetryTargetNotFoundException(): HttpException {
  return new NotFoundException({
    code: TUTORING_ERROR_CODES.RETRY_TARGET_NOT_FOUND,
    message: 'Chat message was not found',
  })
}

export function tutoringTerminalStateUnavailableException(): HttpException {
  return new ServiceUnavailableException({
    code: TUTORING_ERROR_CODES.TERMINAL_STATE_UNAVAILABLE,
    message: 'The student chat turn could not be safely persisted',
  })
}
