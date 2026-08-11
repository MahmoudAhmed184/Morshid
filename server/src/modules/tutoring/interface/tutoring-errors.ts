import {
  ConflictException,
  ForbiddenException,
  type HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { CONVERSATION_ERROR_CODES } from '../../conversations/conversation.errors'

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

export function tutoringRetryNotAllowedException(): HttpException {
  return new ConflictException({
    code: CONVERSATION_ERROR_CODES.RETRY_NOT_ALLOWED,
    message: 'Only a failed or expired assistant response can be retried',
  })
}

export function tutoringRetryTargetNotFoundException(): HttpException {
  return new NotFoundException({
    code: CONVERSATION_ERROR_CODES.RETRY_TARGET_NOT_FOUND,
    message: 'Conversation message was not found',
  })
}

export function tutoringTerminalStateUnavailableException(): HttpException {
  return new ServiceUnavailableException({
    code: CONVERSATION_ERROR_CODES.TERMINAL_STATE_UNAVAILABLE,
    message: 'The tutoring turn could not be safely persisted',
  })
}
