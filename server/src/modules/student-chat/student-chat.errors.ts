import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type HttpException,
  NotFoundException,
} from '@nestjs/common'

export const STUDENT_CHAT_ERROR_CODES = {
  INVALID_REQUEST: 'STUDENT_CHAT_INVALID_REQUEST',
  ACTIVE_STUDENT_MEMBERSHIP_REQUIRED:
    'STUDENT_CHAT_ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
  SESSION_NOT_FOUND: 'STUDENT_CHAT_SESSION_NOT_FOUND',
  ASSISTANT_MESSAGE_NOT_FOUND: 'STUDENT_CHAT_ASSISTANT_MESSAGE_NOT_FOUND',
  ASSISTANT_MESSAGE_NOT_PENDING: 'STUDENT_CHAT_ASSISTANT_MESSAGE_NOT_PENDING',
} as const

export interface StudentChatValidationIssue {
  field: string
  message: string
}

export function invalidStudentChatRequestException(
  errors: StudentChatValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: STUDENT_CHAT_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid student chat request',
    errors,
  })
}

export function activeStudentMembershipRequiredException(): HttpException {
  return new ForbiddenException({
    code: STUDENT_CHAT_ERROR_CODES.ACTIVE_STUDENT_MEMBERSHIP_REQUIRED,
    message: 'Active student course membership is required',
  })
}

export function chatSessionNotFoundException(): HttpException {
  return new NotFoundException({
    code: STUDENT_CHAT_ERROR_CODES.SESSION_NOT_FOUND,
    message: 'Chat session was not found',
  })
}

export function assistantMessageNotFoundException(): HttpException {
  return new NotFoundException({
    code: STUDENT_CHAT_ERROR_CODES.ASSISTANT_MESSAGE_NOT_FOUND,
    message: 'Assistant message was not found',
  })
}

export function assistantMessageNotPendingException(): HttpException {
  return new ConflictException({
    code: STUDENT_CHAT_ERROR_CODES.ASSISTANT_MESSAGE_NOT_PENDING,
    message: 'Assistant message is no longer pending',
  })
}
