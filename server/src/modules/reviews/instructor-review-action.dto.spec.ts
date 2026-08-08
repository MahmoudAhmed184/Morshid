import { ReviewOutcome } from '../../generated/prisma/client'
import {
  rejectReviewRequestSchema,
  resolveReviewRequestSchema,
} from './instructor-review-action.dto'

describe('Instructor review action DTOs', () => {
  it.each([
    [ReviewOutcome.APPROVED, null],
    [ReviewOutcome.EDITED, 'Corrected guidance'],
    [ReviewOutcome.REPLACED, 'Replacement guidance'],
  ])('accepts %s with its required content shape', (outcome, content) => {
    expect(
      resolveReviewRequestSchema.safeParse({
        expectedVersion: 1,
        outcome,
        content,
        reason: null,
      }).success,
    ).toBe(true)
  })

  it.each([
    [ReviewOutcome.APPROVED, 'Edited content'],
    [ReviewOutcome.EDITED, null],
    [ReviewOutcome.REPLACED, '   '],
  ])('rejects %s with invalid content', (outcome, content) => {
    expect(
      resolveReviewRequestSchema.safeParse({
        expectedVersion: 1,
        outcome,
        content,
        reason: null,
      }).success,
    ).toBe(false)
  })

  it('requires a nonblank rejection reason', () => {
    expect(
      rejectReviewRequestSchema.safeParse({
        expectedVersion: 1,
        reason: '   ',
      }).success,
    ).toBe(false)
  })
})
