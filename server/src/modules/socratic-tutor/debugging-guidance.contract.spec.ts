import {
  DEBUGGING_GUIDANCE_FULL_REWRITE_REFUSAL,
  validateDebuggingGuidanceOutput,
} from './debugging-guidance.contract'

const validGuidance = [
  'Likely defect',
  'The accumulator changes before the condition is checked.',
  '',
  'Relevant location',
  'The update expression inside the loop.',
  '',
  'Concept',
  'Trace the value across the update and condition. [1]',
  '',
  'Next inspection step',
  'Write down the value before and after the update.',
].join('\n')

describe('debugging guidance contract', () => {
  it('accepts language-neutral guidance with one cited concept and one inspection step', () => {
    expect(
      validateDebuggingGuidanceOutput({
        content: validGuidance,
        authorizedCitationCount: 1,
      }),
    ).toBe('ALLOWED_DEBUGGING_GUIDANCE')
  })

  it('accepts a complete-program refusal without accepting executable code', () => {
    expect(
      validateDebuggingGuidanceOutput({
        content: `${DEBUGGING_GUIDANCE_FULL_REWRITE_REFUSAL}\n\n${validGuidance}`,
        authorizedCitationCount: 1,
      }),
    ).toBe('ALLOWED_DEBUGGING_GUIDANCE')
  })

  it.each([
    [
      'missing section',
      validGuidance.replace('\nConcept\n', '\nExplanation\n'),
      'INVALID_RESPONSE_SHAPE',
    ],
    [
      'unauthorized citation',
      validGuidance.replace('[1]', '[2]'),
      'INVALID_CITATION',
    ],
    [
      'execution claim',
      validGuidance.replace(
        'The accumulator changes before the condition is checked.',
        'I ran the code and it returned the expected value.',
      ),
      'EXECUTION_CLAIM',
    ],
    [
      'complete program',
      validGuidance.replace(
        'The update expression inside the loop.',
        'function solve() is the relevant location.',
      ),
      'FULL_REWRITE_SUSPECTED',
    ],
  ])('rejects %s', (_name, content, expected) => {
    expect(
      validateDebuggingGuidanceOutput({
        content,
        authorizedCitationCount: 1,
      }),
    ).toBe(expected)
  })

  it('rejects more than one inspection action', () => {
    const content = validGuidance.replace(
      'Write down the value before and after the update.',
      'Write down the value before the update. Then compare it after the update.',
    )

    expect(
      validateDebuggingGuidanceOutput({
        content,
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_RESPONSE_SHAPE')
  })
})
