import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { CONVERSATION_ERROR_CODES } from '../../conversations/interface/conversation-errors'

export function tutoringActiveStudentMembershipRequiredException(): HttpException {
  return new ForbiddenException({
    code: CONVERSATION_ERROR_CODES.ACTIVE_STUDENT_MEMBERSHIP_REQUIRED,
    message: 'Active student course membership is required',
  })
}

export function tutoringSessionNotFoundException(): HttpException {
  return new NotFoundException({
    code: CONVERSATION_ERROR_CODES.SESSION_NOT_FOUND,
    message: 'Conversation session was not found',
  })
}

export function tutoringTurnInProgressException(): HttpException {
  return new ConflictException({
    code: CONVERSATION_ERROR_CODES.TURN_IN_PROGRESS,
    message: 'A tutoring turn is already in progress',
  })
}

export function tutoringIdempotencyKeyReusedException(): HttpException {
  return new ConflictException({
    code: CONVERSATION_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
    message: 'The client message ID was already used for different content',
  })
}

export function tutoringRetryNotAllowedException(): HttpException {
  return new ConflictException({
    code: CONVERSATION_ERROR_CODES.RETRY_NOT_ALLOWED,
    message: 'Only a failed or expired assistant response can be retried',
  })
}

export function tutoringRetryTargetNotFoundException(): HttpException {
  return new NotFoundException({
    code: CONVERSATION_ERROR_CODES.RETRY_TARGET_NOT_FOUND,
    message: 'Tutoring attempt was not found',
  })
}

export function tutoringTerminalStateUnavailableException(): HttpException {
  return new ServiceUnavailableException({
    code: CONVERSATION_ERROR_CODES.TERMINAL_STATE_UNAVAILABLE,
    message: 'The tutoring turn could not be safely persisted',
  })
}

export function tutoringAllowanceExhaustedException(): HttpException {
  return new HttpException(
    {
      code: 'TUTORING_ALLOWANCE_EXHAUSTED',
      message: 'You have reached today’s tutoring turn limit for this course.',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  )
}

export function tutoringConversationTurnsExhaustedException(): HttpException {
  return new HttpException(
    {
      code: CONVERSATION_ERROR_CODES.CONVERSATION_TURN_LIMIT_EXHAUSTED,
      message: 'You have reached the turn limit for this conversation.',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  )
}
