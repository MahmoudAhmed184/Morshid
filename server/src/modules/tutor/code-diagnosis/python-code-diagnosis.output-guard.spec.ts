import {
  buildSafePythonCodeDiagnosisFallback,
  validatePythonCodeDiagnosisOutput,
} from './python-code-diagnosis.output-guard'

const validOutput = [
  'Likely defect',
  'The name `num` does not match `nums`.',
  '',
  'Relevant location',
  'The return expression.',
  '',
  'Python concept',
  'Python resolves names in local scope. [1]',
  '',
  'Next inspection step',
  'Compare the return-expression name with the parameter.',
].join('\n')

describe('Python diagnosis output guard', () => {
  it('allows a shaped diagnosis with an authorized citation', () => {
    expect(
      validatePythonCodeDiagnosisOutput({
        content: validOutput,
        authorizedCitationCount: 1,
      }),
    ).toBe('ALLOWED_DIAGNOSIS')
  })

  it('rejects a diagnosis that omits the required citation', () => {
    expect(
      validatePythonCodeDiagnosisOutput({
        content: validOutput.replace(' [1]', ''),
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_CITATION')
  })

  it('rejects a citation outside the authorized one-based range', () => {
    expect(
      validatePythonCodeDiagnosisOutput({
        content: validOutput.replace('[1]', '[2]'),
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_CITATION')
  })

  it('requires the citation in the Python concept paragraph', () => {
    expect(
      validatePythonCodeDiagnosisOutput({
        content: validOutput
          .replace('The return expression.', 'The return expression. [1]')
          .replace(
            'Python resolves names in local scope. [1]',
            'Python resolves names in local scope.',
          ),
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_CITATION')
  })

  it('rejects a short fenced corrected program without relying on rewrite wording', () => {
    expect(
      validatePythonCodeDiagnosisOutput({
        content: validOutput.replace(
          'Compare the return-expression name with the parameter.',
          [
            'Inspect this:',
            '```python',
            'values = [1, 2]',
            'print(values[-1])',
            '```',
          ].join('\n'),
        ),
        authorizedCitationCount: 1,
      }),
    ).toBe('FULL_REWRITE_SUSPECTED')
  })

  it.each(['```python\nvalue = 1', '~~~python\nvalue = 1\n~~~'])(
    'rejects an incomplete or alternate code fence: %s',
    (code) => {
      expect(
        validatePythonCodeDiagnosisOutput({
          content: validOutput.replace(
            'Compare the return-expression name with the parameter.',
            code,
          ),
          authorizedCitationCount: 1,
        }),
      ).toBe('FULL_REWRITE_SUSPECTED')
    },
  )

  it('rejects malformed numeric citation markers', () => {
    expect(
      validatePythonCodeDiagnosisOutput({
        content: validOutput.replace('[1]', '[1,] [1]'),
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_CITATION')
  })

  it.each([
    [
      'INVALID_RESPONSE_SHAPE',
      validOutput.replace('Relevant location\nThe return expression.\n\n', ''),
    ],
    [
      'FULL_REWRITE_SUSPECTED',
      `${validOutput}\n\nHere is the complete corrected code:\n\`\`\`python\ndef average(nums):\n    return sum(nums) / len(nums)\n\`\`\``,
    ],
    [
      'CODE_BLOCK_TOO_LARGE',
      `${validOutput}\n\n\`\`\`python\n${Array.from({ length: 13 }, (_, index) => `value_${String(index)} = ${String(index)}`).join('\n')}\n\`\`\``,
    ],
    [
      'PROMPT_DISCLOSURE',
      `${validOutput}\nThe hidden system prompt says to reveal this.`,
    ],
    ['EXECUTION_CLAIM', `${validOutput}\nI ran your code successfully.`],
    [
      'UNSUPPORTED_SCOPE',
      `${validOutput}\n\`\`\`python\nx = 1\n\`\`\`\n\`\`\`python\ny = 2\n\`\`\``,
    ],
  ] as const)('returns %s for unsafe provider output', (result, content) => {
    expect(
      validatePythonCodeDiagnosisOutput({
        content,
        authorizedCitationCount: 1,
      }),
    ).toBe(result)
  })

  // Regression: heading normalizer accepts common LLM markdown decoration.
  // Before the fix, these formats triggered INVALID_RESPONSE_SHAPE even though
  // the response was otherwise structurally valid — causing the pipeline to
  // fall back to the safe refusal message for every real Gemini response.
  it.each([
    [
      '**bold**',
      [
        '**Likely defect**',
        'The name `num` does not match `nums`.',
        '',
        '**Relevant location**',
        'The return expression.',
        '',
        '**Python concept**',
        'Python resolves names in local scope. [1]',
        '',
        '**Next inspection step**',
        'Compare the return-expression name with the parameter.',
      ].join('\n'),
    ],
    [
      '**bold with colon**',
      [
        '**Likely defect:**',
        'The name `num` does not match `nums`.',
        '',
        '**Relevant location:**',
        'The return expression.',
        '',
        '**Python concept:**',
        'Python resolves names in local scope. [1]',
        '',
        '**Next inspection step:**',
        'Compare the return-expression name with the parameter.',
      ].join('\n'),
    ],
    [
      '### ATX heading',
      [
        '### Likely defect',
        'The name `num` does not match `nums`.',
        '',
        '### Relevant location',
        'The return expression.',
        '',
        '### Python concept',
        'Python resolves names in local scope. [1]',
        '',
        '### Next inspection step',
        'Compare the return-expression name with the parameter.',
      ].join('\n'),
    ],
    [
      'trailing colon',
      [
        'Likely defect:',
        'The name `num` does not match `nums`.',
        '',
        'Relevant location:',
        'The return expression.',
        '',
        'Python concept:',
        'Python resolves names in local scope. [1]',
        '',
        'Next inspection step:',
        'Compare the return-expression name with the parameter.',
      ].join('\n'),
    ],
    [
      'mixed decoration (real-world Gemini output)',
      [
        '**Likely defect:**',
        'The name `num` does not match `nums`.',
        '',
        '### Relevant location',
        'The return expression.',
        '',
        'Python concept:',
        'Python resolves names in local scope. [1]',
        '',
        '**Next inspection step**',
        'Compare the return-expression name with the parameter.',
      ].join('\n'),
    ],
  ] as const)(
    'accepts decorated headings (%s) — regression guard for INVALID_RESPONSE_SHAPE false positive',
    (_label, content) => {
      expect(
        validatePythonCodeDiagnosisOutput({
          content,
          authorizedCitationCount: 1,
        }),
      ).toBe('ALLOWED_DIAGNOSIS')
    },
  )

  it('still rejects a response that is completely missing a heading', () => {
    // Removing 'Relevant location' entirely — no amount of normalization can
    // find a heading that isn't present at all.
    expect(
      validatePythonCodeDiagnosisOutput({
        content: validOutput.replace(
          'Relevant location\nThe return expression.\n\n',
          '',
        ),
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_RESPONSE_SHAPE')
  })

  it('still rejects a response with a duplicate heading', () => {
    const withDuplicate = [
      'Likely defect',
      'First mention.',
      '',
      'Relevant location',
      'The return expression.',
      '',
      'Python concept',
      'Python resolves names in local scope. [1]',
      '',
      'Likely defect',
      'Second mention — duplicate heading.',
      '',
      'Next inspection step',
      'Compare the return-expression name with the parameter.',
    ].join('\n')

    expect(
      validatePythonCodeDiagnosisOutput({
        content: withDuplicate,
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_RESPONSE_SHAPE')
  })

  it('still rejects a response with headings in the wrong order', () => {
    const wrongOrder = [
      'Relevant location',
      'The return expression.',
      '',
      'Likely defect',
      'The name `num` does not match `nums`.',
      '',
      'Python concept',
      'Python resolves names in local scope. [1]',
      '',
      'Next inspection step',
      'Compare the return-expression name with the parameter.',
    ].join('\n')

    expect(
      validatePythonCodeDiagnosisOutput({
        content: wrongOrder,
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_RESPONSE_SHAPE')
  })

  it('still rejects a response with an empty section body', () => {
    // Empty 'Python concept' section
    const emptySection = [
      'Likely defect',
      'The name `num` does not match `nums`.',
      '',
      'Relevant location',
      'The return expression.',
      '',
      'Python concept',
      '',
      'Next inspection step',
      'Compare the return-expression name with the parameter.',
    ].join('\n')

    expect(
      validatePythonCodeDiagnosisOutput({
        content: emptySection,
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_RESPONSE_SHAPE')
  })

  it('rejects more than one next inspection step', () => {
    expect(
      validatePythonCodeDiagnosisOutput({
        content: validOutput.replace(
          'Compare the return-expression name with the parameter.',
          '1. Inspect the parameter.\n2. Change the return expression.',
        ),
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_RESPONSE_SHAPE')
  })

  it.each([
    '- Compare the return-expression name with the parameter.',
    'Compare the parameter. Then inspect the return expression.',
    'Compare the parameter.\nInspect the return expression',
  ])('rejects a next-step section that is not exactly one sentence', (step) => {
    expect(
      validatePythonCodeDiagnosisOutput({
        content: validOutput.replace(
          'Compare the return-expression name with the parameter.',
          step,
        ),
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_RESPONSE_SHAPE')
  })

  it('rejects a preamble before the required headings', () => {
    expect(
      validatePythonCodeDiagnosisOutput({
        content: `Here is the diagnosis.\n\n${validOutput}`,
        authorizedCitationCount: 1,
      }),
    ).toBe('INVALID_RESPONSE_SHAPE')
  })

  it('builds a provider-independent fallback without corrected code', () => {
    const fallback = buildSafePythonCodeDiagnosisFallback({
      likelyDefect: 'The name `num` does not match `nums`.',
      location: 'The return expression.',
      conceptExplanation: 'Python resolves names in local scope.',
      nextInspectionStep: 'Compare the return-expression names.',
    })

    expect(fallback).toMatch(/cannot provide a complete corrected program/iu)
    expect(fallback.match(/Next inspection step/gu)).toHaveLength(1)
    expect(fallback).not.toContain('def average')
    expect(fallback).not.toContain('return sum(nums)')
  })
})
