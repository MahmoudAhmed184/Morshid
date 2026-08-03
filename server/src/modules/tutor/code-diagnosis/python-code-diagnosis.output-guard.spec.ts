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
    ['INVALID_CITATION', validOutput.replace('[1]', '[2]')],
    [
      'UNSUPPORTED_SCOPE',
      `${validOutput}\n\n\`\`\`python\nx = 1\n\`\`\`\n\`\`\`python\ny = 2\n\`\`\``,
    ],
  ] as const)('returns %s for unsafe provider output', (result, content) => {
    expect(
      validatePythonCodeDiagnosisOutput({
        content,
        authorizedCitationCount: 1,
      }),
    ).toBe(result)
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
