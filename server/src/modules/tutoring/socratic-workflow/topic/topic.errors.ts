import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  type HttpException,
} from '@nestjs/common'

export const TOPIC_ERROR_CODES = {
  INVALID_REQUEST: 'TOPIC_INVALID_REQUEST',
  SESSION_NOT_FOUND: 'TOPIC_SESSION_NOT_FOUND',
  COURSE_SCOPE_MISMATCH: 'TOPIC_COURSE_SCOPE_MISMATCH',
  TOPIC_NOT_FOUND: 'TOPIC_NOT_FOUND',
  INVALID_LIFECYCLE_TRANSITION: 'TOPIC_INVALID_LIFECYCLE_TRANSITION',
  AMBIGUOUS_ACTIVE_TOPIC: 'TOPIC_AMBIGUOUS_ACTIVE_TOPIC',
  RESOLUTION_EVIDENCE_REQUIRED: 'TOPIC_RESOLUTION_EVIDENCE_REQUIRED',
} as const

export interface TopicValidationIssue {
  field: string
  message: string
}

export function invalidTopicRequestException(
  errors: TopicValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: TOPIC_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid topic request',
    errors,
  })
}

export function topicSessionNotFoundException(): HttpException {
  return new NotFoundException({
    code: TOPIC_ERROR_CODES.SESSION_NOT_FOUND,
    message: 'Chat session was not found',
  })
}

export function topicCourseScopeMismatchException(): HttpException {
  return new ConflictException({
    code: TOPIC_ERROR_CODES.COURSE_SCOPE_MISMATCH,
    message: 'Topic course scope does not match the chat session',
  })
}

export function topicNotFoundException(): HttpException {
  return new NotFoundException({
    code: TOPIC_ERROR_CODES.TOPIC_NOT_FOUND,
    message: 'Topic was not found',
  })
}

export function invalidTopicLifecycleTransitionException(): HttpException {
  return new ConflictException({
    code: TOPIC_ERROR_CODES.INVALID_LIFECYCLE_TRANSITION,
    message: 'Topic lifecycle transition is not allowed',
  })
}

export function ambiguousActiveTopicException(): HttpException {
  return new ConflictException({
    code: TOPIC_ERROR_CODES.AMBIGUOUS_ACTIVE_TOPIC,
    message: 'The active topic focus is ambiguous',
  })
}

export function topicResolutionEvidenceRequiredException(): HttpException {
  return new BadRequestException({
    code: TOPIC_ERROR_CODES.RESOLUTION_EVIDENCE_REQUIRED,
    message: 'Structured student evidence is required to resolve a topic',
  })
}
