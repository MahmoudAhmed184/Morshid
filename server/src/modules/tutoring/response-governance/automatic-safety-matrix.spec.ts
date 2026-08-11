import {
  AUTOMATIC_SAFETY_FIXTURES,
  type AutomaticSafetyFixture,
} from './automatic-safety.fixtures'
import {
  RESPONSE_GOVERNANCE_GENERAL_NOT_FOUND_CONTENT,
  RESPONSE_GOVERNANCE_REFUSAL_CONTENT,
  RESPONSE_GOVERNANCE_SOURCE_CONFLICT_CONTENT,
  ResponseGovernance,
} from './response-governance'

describe('automatic safety SCN-01–SCN-08 matrix', () => {
  const policy = new ResponseGovernance()

  it.each(AUTOMATIC_SAFETY_FIXTURES)(
    '$id proves response, ordered reasons, and bounded evidence',
    (fixture) => {
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
    },
  )
})

function expectedContent(fixture: AutomaticSafetyFixture): string {
  if (
    fixture.expectedReasons.includes('POLICY_CHECK_FAILED') ||
    fixture.expectedReasons.includes('FINAL_ANSWER_RISK')
  ) {
    return RESPONSE_GOVERNANCE_REFUSAL_CONTENT
  }
  if (fixture.expectedReasons.includes('SOURCE_CONFLICT')) {
    return RESPONSE_GOVERNANCE_SOURCE_CONFLICT_CONTENT
  }
  if (fixture.expectedReasons.includes('GENERAL_NOT_FOUND')) {
    return RESPONSE_GOVERNANCE_GENERAL_NOT_FOUND_CONTENT
  }
  return fixture.input.proposedContent
}
