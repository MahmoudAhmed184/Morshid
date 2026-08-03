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

export function staleTutorTurnStatusException(): HttpException {
  return new ConflictException({
    code: TURN_ERROR_CODES.STALE_STATUS,
    message: 'Tutor turn status is stale',
  })
}

export function invalidTutorTurnLifecycleTransitionException(): HttpException {
  return new ConflictException({
    code: TURN_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    message: 'Tutor turn lifecycle transition is not allowed',
  })
}
