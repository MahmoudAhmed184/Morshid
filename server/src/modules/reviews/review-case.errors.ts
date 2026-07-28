import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common'

export const REVIEW_ERROR_CODES = {
  INVALID_REQUEST: 'REVIEW_INVALID_REQUEST',
  NOT_FOUND: 'REVIEW_NOT_FOUND',
  TARGET_NOT_REVIEWABLE: 'TARGET_NOT_REVIEWABLE',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  QUOTA_EXCEEDED: 'MANUAL_REVIEW_QUOTA_EXCEEDED',
  SNAPSHOT_TOO_LARGE: 'REVIEW_SNAPSHOT_TOO_LARGE',
} as const

export function invalidReviewRequestException(errors: unknown[] = []) {
  return new BadRequestException({
    code: REVIEW_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid review request',
    errors,
  })
}

export function reviewNotFoundException() {
  return new NotFoundException({
    code: REVIEW_ERROR_CODES.NOT_FOUND,
    message: 'Review target was not found',
  })
}

export function targetNotReviewableException() {
  return new BadRequestException({
    code: REVIEW_ERROR_CODES.TARGET_NOT_REVIEWABLE,
    message: 'Only completed assistant responses can be reviewed',
  })
}

export function idempotencyKeyReusedException() {
  return new ConflictException({
    code: REVIEW_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
    message: 'Idempotency key was already used for a different request',
  })
}

export function reviewQuotaExceededException() {
  return new HttpException(
    {
      code: REVIEW_ERROR_CODES.QUOTA_EXCEEDED,
      message: 'Daily manual review request limit reached',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  )
}

export function reviewSnapshotTooLargeException() {
  return new PayloadTooLargeException({
    code: REVIEW_ERROR_CODES.SNAPSHOT_TOO_LARGE,
    message: 'Required review evidence exceeds the snapshot limit',
  })
}
