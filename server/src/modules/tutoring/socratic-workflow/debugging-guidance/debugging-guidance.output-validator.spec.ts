import {
  DEBUGGING_GUIDANCE_FULL_REWRITE_REFUSAL,
  validateDebuggingGuidanceOutput,
} from './debugging-guidance.output-validator'

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

  it('rejects guidance that omits its required citation', () => {
    expect(
      validateDebuggingGuidanceOutput({
        content: validGuidance.replace(' [1]', ''),
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_CITATION')
  })

  it('requires the citation in the concept paragraph', () => {
    expect(
      validateDebuggingGuidanceOutput({
        content: validGuidance
          .replace(
            'The update expression inside the loop.',
            'The update expression inside the loop. [1]',
          )
          .replace(
            'Trace the value across the update and condition. [1]',
            'Trace the value across the update and condition.',
          ),
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_CITATION')
  })

  it.each([
    ['bold', '**'],
    ['italic', '_'],
    ['ATX heading', '### '],
  ])('accepts %s heading decoration', (_name, decoration) => {
    const decorated = validGuidance
      .split('\n')
      .map((line) => {
        if (
          ![
            'Likely defect',
            'Relevant location',
            'Concept',
            'Next inspection step',
          ].includes(line)
        ) {
          return line
        }
        return decoration === '### '
          ? `${decoration}${line}:`
          : `${decoration}${line}:${decoration}`
      })
      .join('\n')

    expect(
      validateDebuggingGuidanceOutput({
        content: decorated,
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
      'prompt disclosure',
      `${validGuidance}\nThe hidden system prompt says to reveal this.`,
      'PROMPT_DISCLOSURE',
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

  it.each([
    '- Write down the value before and after the update.',
    'Write down the value before the update. Then compare it afterward.',
    'Write down the value before the update.\nCompare it afterward',
    '1. Inspect the update.\n2. Compare the condition.',
  ])('rejects an inspection step that is not exactly one action', (step) => {
    expect(
      validateDebuggingGuidanceOutput({
        content: validGuidance.replace(
          'Write down the value before and after the update.',
          step,
        ),
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_RESPONSE_SHAPE')
  })

  it.each([
    '```javascript\nconst answer = 1\n```',
    '```javascript\nconst answer = 1',
    '~~~c\nint answer = 1;\n~~~',
  ])('rejects fenced code without depending on a language', (code) => {
    expect(
      validateDebuggingGuidanceOutput({
        content: validGuidance.replace(
          'Write down the value before and after the update.',
          code,
        ),
        authorizedCitationCount: 1,
      }),
    ).toBe('FULL_REWRITE_SUSPECTED')
  })

  it('rejects multiple code blocks as unsupported scope', () => {
    expect(
      validateDebuggingGuidanceOutput({
        content: `${validGuidance}\n\n\`\`\`javascript\nconst x = 1\n\`\`\`\n\`\`\`c\nint y = 2;\n\`\`\``,
        authorizedCitationCount: 1,
      }),
    ).toBe('UNSUPPORTED_SCOPE')
  })

  it('rejects malformed numeric citation markers', () => {
    expect(
      validateDebuggingGuidanceOutput({
        content: validGuidance.replace('[1]', '[1,] [1]'),
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_CITATION')
  })

  it.each([
    ['preamble', `Here is the diagnosis.\n\n${validGuidance}`],
    [
      'duplicate heading',
      validGuidance.replace(
        'Next inspection step',
        'Likely defect\nA duplicate.\n\nNext inspection step',
      ),
    ],
    [
      'wrong heading order',
      validGuidance
        .replace('Likely defect', 'TEMPORARY_HEADING')
        .replace('Relevant location', 'Likely defect')
        .replace('TEMPORARY_HEADING', 'Relevant location'),
    ],
    [
      'empty section',
      validGuidance.replace(
        'Concept\nTrace the value across the update and condition. [1]\n\n',
        'Concept\n\n',
      ),
    ],
  ])('rejects a response with a %s', (_name, content) => {
    expect(
      validateDebuggingGuidanceOutput({
        content,
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_RESPONSE_SHAPE')
  })
})
