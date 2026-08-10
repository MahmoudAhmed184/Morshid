import type { ReviewCaseCreator } from '../reviews/review-case.creator'
import {
  AUTOMATIC_SAFETY_FIXTURES,
  type AutomaticSafetyFixture,
} from './automatic-safety.fixtures'
import { OutputPolicyReviewAdapter } from './output-policy-review.adapter'
import {
  OUTPUT_POLICY_GENERAL_NOT_FOUND_CONTENT,
  OUTPUT_POLICY_REFUSAL_CONTENT,
  OUTPUT_POLICY_SOURCE_CONFLICT_CONTENT,
  OutputPolicyService,
} from './output-policy.service'

const assistantMessageId = '70000000-0000-4000-8000-000000000001'
const reviewCaseId = '70000000-0000-4000-8000-000000000002'

describe('automatic safety SCN-01–SCN-08 matrix', () => {
  const policy = new OutputPolicyService()

  it.each(AUTOMATIC_SAFETY_FIXTURES)(
    '$id proves response, ordered reasons, bounded evidence, and delivery uniqueness',
    async (fixture) => {
      const createAutomatic = jest.fn() as jest.MockedFunction<
        ReviewCaseCreator['createAutomatic']
      >
      createAutomatic.mockResolvedValue({
        caseId: reviewCaseId,
        messageId: assistantMessageId,
        status: 'PENDING',
        replayed: false,
      })
      const adapter = new OutputPolicyReviewAdapter({
        createAutomatic,
      } as unknown as ReviewCaseCreator)
      const decision = policy.evaluate(fixture.input)

      expect(decision.reasons).toEqual(fixture.expectedReasons)
      expect(decision.content).toBe(expectedContent(fixture))
      expect(decision.createReview).toBe(fixture.expectedReasons.length > 0)
      expect(decision.reviewEvidence === null).toBe(
        fixture.expectedReasons.length === 0,
      )
      for (const source of decision.reviewEvidence?.sources ?? []) {
        expect(Array.from(source.excerpt).length).toBeLessThanOrEqual(500)
      }

      const results = []
      for (let attempt = 0; attempt < fixture.attempts; attempt += 1) {
        results.push(
          await adapter.createRequiredReview({
            assistantMessageId,
            decision,
          }),
        )
      }

      expect(createAutomatic).toHaveBeenCalledTimes(
        fixture.expectedReasons.length * fixture.attempts,
      )
      expect(
        createAutomatic.mock.calls.map(([request]) => request.trigger),
      ).toEqual(
        Array.from({ length: fixture.attempts }, () => [
          ...fixture.expectedReasons,
        ]).flat(),
      )
      expect(
        new Set(
          createAutomatic.mock.calls.map(([request]) => request.sourceEventKey),
        ).size,
      ).toBe(fixture.expectedReasons.length)
      for (const result of results) {
        if (fixture.expectedReasons.length === 0) {
          expect(result).toBeNull()
        } else {
          expect(result).toMatchObject({
            caseId: reviewCaseId,
            messageId: assistantMessageId,
            status: 'PENDING',
          })
        }
      }
    },
  )
})

function expectedContent(fixture: AutomaticSafetyFixture): string {
  if (
    fixture.expectedReasons.includes('POLICY_CHECK_FAILED') ||
    fixture.expectedReasons.includes('FINAL_ANSWER_RISK')
  ) {
    return OUTPUT_POLICY_REFUSAL_CONTENT
  }
  if (fixture.expectedReasons.includes('SOURCE_CONFLICT')) {
    return OUTPUT_POLICY_SOURCE_CONFLICT_CONTENT
  }
  if (fixture.expectedReasons.includes('GENERAL_NOT_FOUND')) {
    return OUTPUT_POLICY_GENERAL_NOT_FOUND_CONTENT
  }
  return fixture.input.proposedContent
}
