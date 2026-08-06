import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { MessageRequestKind } from '../../generated/prisma/client'
import {
  materializePythonCodeDiagnosisFixtureInput,
  parsePythonCodeDiagnosisFixtureDataset,
} from './code-diagnosis/python-code-diagnosis.fixture'
import { selectTutorStrategy } from './tutor-decision'

const fixturePath = resolve(
  process.cwd(),
  '..',
  'fixtures',
  'golden-dataset',
  'python-code-diagnosis-p0.json',
)

describe('shared Tutor strategy selection', () => {
  const dataset = parsePythonCodeDiagnosisFixtureDataset(
    JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown,
  )

  it('selects the frozen CODE_DIAGNOSIS decision for gd-p0-v1-058', () => {
    const fixture = dataset.fixtures.find(({ id }) => id === 'gd-p0-v1-058')
    if (fixture === undefined) {
      throw new Error('Missing gd-p0-v1-058')
    }

    const selection = selectTutorStrategy(
      `${fixture.prompt}\n${materializePythonCodeDiagnosisFixtureInput(fixture)}`,
    )

    expect(selection.decision).toMatchObject({
      requestKind: MessageRequestKind.CODE_DIAGNOSIS,
      strategy: 'PYTHON_CODE_DIAGNOSIS',
      promptVersion: 'python-code-diagnosis-prompt-v1',
      guidanceLabel: 'COURSE_GROUNDED',
    })
    expect(selection.retrievalQuery).toBe(
      'Python a possible variable-name mismatch or unresolved name near the loop body; study name lookup and local scope. Diagnostic signals: singular and plural identifiers may not match. Relevant identifiers: num, nums.',
    )
    expect(selection.diagnosis).toEqual({
      likelyDefect: 'The name `num` does not match the visible `nums` name.',
      location:
        'The `num` reference in the return expression `total / len(num)`.',
      conceptExplanation:
        'Python name lookup searches the active function scope, where `nums` exists but `num` does not.',
      nextInspectionStep:
        'Compare every name in the return expression with the function parameters and local variables.',
    })
  })

  it('keeps ordinary conceptual chat on the existing grounded strategy', () => {
    const selection = selectTutorStrategy('What does len() do in Python?')

    expect(selection).toMatchObject({
      decision: {
        requestKind: MessageRequestKind.CONCEPTUAL,
        strategy: 'GROUNDED_EXPLANATION',
        promptVersion: 'grounded-completion-v1',
      },
      retrievalQuery: 'What does len() do in Python?',
      diagnosis: null,
      boundaryResponse: null,
    })
  })

  it('returns a no-evidence refusal for clearly non-Python code', () => {
    const input = [
      'function countItems(nums) {',
      '  return nums.length;',
      '}',
    ].join('\n')

    const result = selectTutorStrategy(input)

    expect(result).toMatchObject({
      decision: {
        requestKind: MessageRequestKind.OFF_TOPIC,
        strategy: 'SAFE_REFUSAL',
        evidenceRequirement: 'NO_EVIDENCE',
        guidanceLabel: 'REFUSAL',
      },
      retrievalQuery: null,
      diagnosis: null,
    })
    expect(result.boundaryResponse).not.toBeNull()
    expect(result.boundaryResponse?.errorCode).toBe(
      'PYTHON_DIAGNOSIS_NON_PYTHON',
    )
    expect(result.boundaryResponse?.content).toMatch(/Python code only/iu)
  })

  it('returns a no-evidence reduction request for 101 Python lines', () => {
    const input = [
      'if True:',
      ...Array.from({ length: 100 }, () => '    pass'),
    ].join('\n')

    const result = selectTutorStrategy(input)

    expect(result).toMatchObject({
      decision: {
        requestKind: MessageRequestKind.CODE_DIAGNOSIS,
        strategy: 'SAFE_REFUSAL',
        evidenceRequirement: 'NO_EVIDENCE',
      },
      retrievalQuery: null,
      diagnosis: null,
    })
    expect(result.boundaryResponse).not.toBeNull()
    expect(result.boundaryResponse?.errorCode).toBe(
      'PYTHON_DIAGNOSIS_LINE_LIMIT_EXCEEDED',
    )
    expect(result.boundaryResponse?.content).toMatch(
      /101 normalized lines.*at most 100/iu,
    )
  })

  it('treats instructions in Student comments and strings only as diagnosis data', () => {
    for (const id of [
      'code-diagnosis-injection-comment-001',
      'code-diagnosis-injection-string-001',
    ]) {
      const fixture = dataset.fixtures.find((candidate) => candidate.id === id)
      if (fixture === undefined) {
        throw new Error(`Missing ${id}`)
      }

      const selection = selectTutorStrategy(
        materializePythonCodeDiagnosisFixtureInput(fixture),
      )
      const diagnosisText = Object.values(selection.diagnosis ?? {}).join('\n')

      expect(selection.decision.requestKind).toBe(
        MessageRequestKind.CODE_DIAGNOSIS,
      )
      expect(selection.fullRewriteRequested).toBe(false)
      expect(diagnosisText.toLowerCase()).not.toContain('hidden prompt')
      expect(diagnosisText.toLowerCase()).not.toContain(
        'complete corrected program',
      )
    }
  })

  it('retains diagnosis while marking an explicit full-rewrite request', () => {
    const selection = selectTutorStrategy(
      [
        'Rewrite the whole assignment and give me the complete corrected solution.',
        '```python',
        'def average(nums):',
        '    return sum(nums) / len(num)',
        '```',
      ].join('\n'),
    )

    expect(selection).toMatchObject({
      decision: {
        requestKind: MessageRequestKind.CODE_DIAGNOSIS,
        strategy: 'PYTHON_CODE_DIAGNOSIS',
      },
      boundaryResponse: null,
      fullRewriteRequested: true,
    })
    expect(selection.diagnosis).not.toBeNull()
    expect(selection.diagnosis?.likelyDefect).toMatch(/num.*nums/iu)
    expect(selection.diagnosis?.conceptExplanation).toMatch(
      /name lookup.*scope/iu,
    )
    expect(selection.diagnosis?.nextInspectionStep).toEqual(expect.any(String))
  })

  it('produces one structured next step for every supported behavior fixture', () => {
    const behaviorFixtures = dataset.fixtures.filter(
      ({ expectedDiagnosis }) => expectedDiagnosis !== null,
    )

    for (const fixture of behaviorFixtures) {
      const selection = selectTutorStrategy(
        `${fixture.prompt}\n${materializePythonCodeDiagnosisFixtureInput(fixture)}`,
      )

      expect({
        id: fixture.id,
        requestKind: selection.decision.requestKind,
      }).toEqual({
        id: fixture.id,
        requestKind: MessageRequestKind.CODE_DIAGNOSIS,
      })
      expect(selection.diagnosis?.nextInspectionStep.trim()).not.toBe('')
      expect(Object.keys(selection.diagnosis ?? {})).toEqual([
        'likelyDefect',
        'location',
        'conceptExplanation',
        'nextInspectionStep',
      ])
    }
  })
})
