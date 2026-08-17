import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  type HttpException,
} from '@nestjs/common'

export const TOPIC_STATE_ERROR_CODES = {
  INVALID_REQUEST: 'TOPIC_STATE_INVALID_REQUEST',
  TOPIC_NOT_FOUND: 'TOPIC_STATE_TOPIC_NOT_FOUND',
  STATE_NOT_FOUND: 'TOPIC_STATE_NOT_FOUND',
  STALE_VERSION: 'TOPIC_STATE_STALE_VERSION',
} as const

export function invalidTopicStateRequestException(): HttpException {
  return new BadRequestException({
    code: TOPIC_STATE_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid topic state request',
  })
}

export function topicStateTopicNotFoundException(): HttpException {
  return new NotFoundException({
    code: TOPIC_STATE_ERROR_CODES.TOPIC_NOT_FOUND,
    message: 'Topic was not found',
  })
}

export function topicStateNotFoundException(): HttpException {
  return new NotFoundException({
    code: TOPIC_STATE_ERROR_CODES.STATE_NOT_FOUND,
    message: 'Topic state was not found',
  })
}

export function staleTopicStateVersionException(): HttpException {
  return new ConflictException({
    code: TOPIC_STATE_ERROR_CODES.STALE_VERSION,
    message: 'Topic state version is stale',
  })
}
