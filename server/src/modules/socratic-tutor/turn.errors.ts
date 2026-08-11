import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  type HttpException,
} from '@nestjs/common'

export const TURN_ERROR_CODES = {
  INVALID_REQUEST: 'TURN_INVALID_REQUEST',
  SESSION_NOT_FOUND: 'TURN_SESSION_NOT_FOUND',
  TURN_NOT_FOUND: 'TURN_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'TURN_MESSAGE_NOT_FOUND',
  TOPIC_NOT_FOUND: 'TURN_TOPIC_NOT_FOUND',
  SCOPE_MISMATCH: 'TURN_SCOPE_MISMATCH',
  MESSAGE_ROLE_MISMATCH: 'TURN_MESSAGE_ROLE_MISMATCH',
  LINKAGE_CONFLICT: 'TURN_LINKAGE_CONFLICT',
  ALREADY_PROCESSING: 'TURN_ALREADY_PROCESSING',
  STALE_STATUS: 'TURN_STALE_STATUS',
  INVALID_LIFECYCLE_TRANSITION: 'TURN_INVALID_LIFECYCLE_TRANSITION',
} as const

export interface TurnValidationIssue {
  field: string
  message: string
}

export function invalidTurnRequestException(
  errors: TurnValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: TURN_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid tutor turn request',
    errors,
  })
}

export function turnSessionNotFoundException(): HttpException {
  return new NotFoundException({
    code: TURN_ERROR_CODES.SESSION_NOT_FOUND,
    message: 'Chat session was not found',
  })
}

export function turnNotFoundException(): HttpException {
  return new NotFoundException({
    code: TURN_ERROR_CODES.TURN_NOT_FOUND,
    message: 'Tutor turn was not found',
  })
}

export function turnMessageNotFoundException(): HttpException {
  return new NotFoundException({
    code: TURN_ERROR_CODES.MESSAGE_NOT_FOUND,
    message: 'Tutor turn message was not found',
  })
}

export function turnTopicNotFoundException(): HttpException {
  return new NotFoundException({
    code: TURN_ERROR_CODES.TOPIC_NOT_FOUND,
    message: 'Tutor turn topic was not found',
  })
}

export function turnScopeMismatchException(): HttpException {
  return new ConflictException({
    code: TURN_ERROR_CODES.SCOPE_MISMATCH,
    message: 'Tutor turn records do not share the same authoritative scope',
  })
}

export function turnMessageRoleMismatchException(): HttpException {
  return new BadRequestException({
    code: TURN_ERROR_CODES.MESSAGE_ROLE_MISMATCH,
    message: 'Tutor turn message role is not supported for this operation',
  })
}

export function turnLinkageConflictException(): HttpException {
  return new ConflictException({
    code: TURN_ERROR_CODES.LINKAGE_CONFLICT,
    message: 'Tutor turn linkage conflicts with an existing authoritative link',
  })
}

export function staleTutoringAttemptStatusException(): HttpException {
  return new ConflictException({
    code: TURN_ERROR_CODES.STALE_STATUS,
    message: 'Tutor turn status is stale',
  })
}

export function invalidTutoringAttemptLifecycleTransitionException(): HttpException {
  return new ConflictException({
    code: TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    message: 'Tutor turn lifecycle transition is not allowed',
  })
}
