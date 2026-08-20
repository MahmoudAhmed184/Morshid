import { BadRequestException, NotFoundException } from '@nestjs/common'

export interface SubscriptionsValidationIssue {
  field: string
  message: string
}

export class UniversityNotFoundError extends Error {
  constructor(public readonly universityId: string) {
    super(`University ${universityId} was not found`)
    this.name = 'UniversityNotFoundError'
  }
}

export class SubscriptionNotFoundError extends Error {
  constructor(public readonly universityId: string) {
    super(`Subscription for university ${universityId} was not found`)
    this.name = 'SubscriptionNotFoundError'
  }
}

export function universityNotFoundException(
  universityId: string,
): NotFoundException {
  return new NotFoundException({
    code: 'UNIVERSITY_NOT_FOUND',
    message: `University ${universityId} was not found`,
  })
}

export function subscriptionNotFoundException(
  universityId: string,
): NotFoundException {
  return new NotFoundException({
    code: 'SUBSCRIPTION_NOT_FOUND',
    message: `Subscription for university ${universityId} was not found`,
  })
}

export function invalidSubscriptionsRequestException(
  issues: SubscriptionsValidationIssue[],
): BadRequestException {
  return new BadRequestException({
    code: 'INVALID_SUBSCRIPTIONS_REQUEST',
    message: 'One or more fields failed validation.',
    issues,
  })
}
