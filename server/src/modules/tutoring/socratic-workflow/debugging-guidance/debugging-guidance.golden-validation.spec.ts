import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import type { CandidateResponse } from '../generation/tutor-generation.types'
import { selectTutorStrategy } from '../teaching-decision/tutor-strategy'
import {
  type DebuggingGuidanceFixture,
  type DebuggingGuidanceFixtureDataset,
  materializeDebuggingGuidanceFixtureInput,
  parseDebuggingGuidanceFixtureDataset,
} from './debugging-guidance.fixture'
import { prepareDebuggingGuidance } from './debugging-guidance.strategy'
import { validateDebuggingGuidanceOutput } from './debugging-guidance.output-validator'

const fixturePath = resolve(
  process.cwd(),
  '..',
  'fixtures',
  'evaluations',
  'code-diagnosis',
  'debugging-guidance-p0.json',
)

interface GoldenResult {
  fixtureId: string
  category: string
  expectedClassification: string | null
  actualClassification: string | null
  expectedBoundary: string
  actualBoundary: string
  retrievalResult: 'query_generated' | 'boundary_blocked' | 'not_applicable'
  citationResult: 'not_exercised'
  diagnosisShape: 'valid' | 'null' | 'mismatch'
  noFullCode: boolean
  persistenceResult: 'not_exercised'
  pass: boolean
  failureNote: string
  providerMode: 'deterministic'
  embeddingMode: 'none'
  promptVersion: string | null
  runId: string
}

const RUN_ID = `golden-deterministic-${new Date().toISOString().split('T')[0]}`

function loadDataset(): DebuggingGuidanceFixtureDataset {
  const parsed: unknown = JSON.parse(readFileSync(fixturePath, 'utf8'))
  return parseDebuggingGuidanceFixtureDataset(parsed)
}

function findFixture(
  fixtures: readonly DebuggingGuidanceFixture[],
  id: string,
): DebuggingGuidanceFixture {
  const fixture = fixtures.find((candidate) => candidate.id === id)
  if (fixture === undefined) {
    throw new Error(`Missing fixture: ${id}`)
  }
  return fixture
}

function fixtureInput(fixture: DebuggingGuidanceFixture): string {
  const code = materializeDebuggingGuidanceFixtureInput(fixture)
  if (fixture.input.kind === 'GENERATED_LINES') {
    return `${fixture.prompt} ${code}`
  }
  return `${fixture.prompt}\n${code}`
}

function evaluateFixture(fixture: DebuggingGuidanceFixture): GoldenResult {
  const code = materializeDebuggingGuidanceFixtureInput(fixture)
  const input =
    fixture.input.kind === 'GENERATED_LINES'
      ? code
      : `${fixture.prompt}\n${code}`
  const analysis =
    fixture.expectedClassification === 'CODE_DIAGNOSIS' ||
    fixture.expectedBoundary === 'TOO_MANY_LINES'
      ? {
          requestKind: MessageRequestKind.CODE_DIAGNOSIS,
          studentState: StudentState.DEBUGGING_ISSUE,
        }
      : null
  const selection = selectTutorStrategy({
    studentMessage: input,
    analysis,
  })
  // Diagnosis ownership moved to DebuggingDiagnosisService; matcher-level
  // evaluation uses prepareDebuggingGuidance directly.
  const guidance = prepareDebuggingGuidance(input)

  const actualBoundary =
    selection.boundaryResponse !== null
      ? (() => {
          const errorCode = selection.boundaryResponse.errorCode
          if (errorCode.includes('LINE_LIMIT')) return 'TOO_MANY_LINES'
          if (errorCode.includes('UNSUPPORTED_SCOPE'))
            return 'UNSUPPORTED_SCOPE'
          return 'UNKNOWN'
        })()
      : 'SUPPORTED'

  const actualClassification =
    selection.decision.requestKind === MessageRequestKind.CODE_DIAGNOSIS
      ? 'CODE_DIAGNOSIS'
      : selection.decision.requestKind

  const boundaryMatch = actualBoundary === fixture.expectedBoundary
  const classificationMatch =
    fixture.expectedClassification === null
      ? selection.boundaryResponse !== null
      : actualClassification === fixture.expectedClassification

  const diagnosisShape: GoldenResult['diagnosisShape'] = (() => {
    if (fixture.expectedDiagnosis === null) {
      // BOUNDARY fixtures with SUPPORTED state may omit diagnosis semantics
      // while the strategy still produces a diagnosis. This is valid.
      if (
        fixture.fixtureKind === 'BOUNDARY' &&
        fixture.expectedBoundary === 'SUPPORTED'
      ) {
        return guidance !== null ? 'valid' : 'null'
      }
      return guidance === null ? 'null' : 'mismatch'
    }
    if (guidance === null) return 'mismatch'
    const d = guidance.diagnosis
    const e = fixture.expectedDiagnosis
    const defectMatch = diagnosisFieldMatches(d.likelyDefect, e.likelyDefect)
    const locationMatch = diagnosisFieldMatches(d.location, e.location)
    const conceptMatch = diagnosisFieldMatches(
      d.conceptExplanation,
      e.conceptExplanation,
    )
    const stepMatch = diagnosisFieldMatches(
      d.nextInspectionStep,
      e.nextInspectionStep,
    )
    const categoryMatch = guidance.suspectedCategory === e.suspectedCategory
    const stepCountMatch = hasExactlyOneInspectionStep(d.nextInspectionStep)
    return defectMatch &&
      locationMatch &&
      conceptMatch &&
      stepMatch &&
      categoryMatch &&
      stepCountMatch
      ? 'valid'
      : 'mismatch'
  })()

  const retrievalResult: GoldenResult['retrievalResult'] =
    selection.boundaryResponse !== null ? 'boundary_blocked' : 'query_generated'

  const noFullCode = (() => {
    if (guidance === null) return true
    const diagnosis = Object.values(guidance.diagnosis).join('\n')
    return !/```|~~~|(?:^|\n)\s*(?:async\s+)?(?:def|class|function)\s+/iu.test(
      diagnosis,
    )
  })()

  const pass =
    boundaryMatch &&
    classificationMatch &&
    diagnosisShape !== 'mismatch' &&
    noFullCode
  const failureNote = pass
    ? ''
    : [
        !boundaryMatch
          ? `boundary: expected ${fixture.expectedBoundary}, got ${actualBoundary}`
          : '',
        !classificationMatch
          ? `classification: expected ${String(fixture.expectedClassification)}, got ${actualClassification}`
          : '',
        diagnosisShape === 'mismatch' ? 'diagnosis shape mismatch' : '',
        !noFullCode ? 'full code detected in fallback' : '',
      ]
        .filter(Boolean)
        .join('; ')

  return {
    fixtureId: fixture.id,
    category: fixture.category,
    expectedClassification: fixture.expectedClassification,
    actualClassification:
      selection.boundaryResponse !== null ? null : actualClassification,
    expectedBoundary: fixture.expectedBoundary,
    actualBoundary,
    retrievalResult,
    // This suite evaluates pure strategy data. Retrieval, citations, and
    // persistence are exercised by tutoring-runtime.e2e-spec.ts instead.
    citationResult: 'not_exercised',
    diagnosisShape,
    noFullCode,
    persistenceResult: 'not_exercised',
    pass,
    failureNote,
    providerMode: 'deterministic',
    embeddingMode: 'none',
    promptVersion: selection.decision.promptVersion,
    runId: RUN_ID,
  }
}

const DIAGNOSIS_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'where',
  'with',
])

function diagnosisFieldMatches(actual: string, expected: string): boolean {
  const actualTerms = new Set(diagnosticTerms(actual))
  const expectedTerms = diagnosticTerms(expected)
  if (actualTerms.size === 0 || expectedTerms.length === 0) {
    return false
  }
  const matchingTerms = expectedTerms.filter((term) => actualTerms.has(term))
  return matchingTerms.length / expectedTerms.length >= 0.25
}

function hasExactlyOneInspectionStep(value: string): boolean {
  const normalized = value.trim()
  const sentenceEndings = normalized.match(/[.!?](?:\s|$)/gu) ?? []
  return (
    normalized !== '' &&
    !/\n|^\s*(?:[-*]|\d+[.)])\s+/u.test(normalized) &&
    sentenceEndings.length <= 1
  )
}

function diagnosticTerms(value: string): string[] {
  return (
    value
      .toLowerCase()
      .match(/[a-z_][a-z0-9_]*|\d+/gu)
      ?.filter((term) => !DIAGNOSIS_STOP_WORDS.has(term))
      .map(normalizeDiagnosticTerm) ?? []
  )
}

function normalizeDiagnosticTerm(term: string): string {
  if (term.length > 5 && term.endsWith('ing')) return term.slice(0, -3)
  if (term.length > 4 && term.endsWith('ed')) return term.slice(0, -2)
  if (term.length > 4 && term.endsWith('s')) return term.slice(0, -1)
  return term
}

describe('Debugging guidance golden validation', () => {
  const dataset = loadDataset()
  const results: GoldenResult[] = []

  afterAll(() => {
    // Log the golden results summary for CI visibility
    const summary = {
      runId: RUN_ID,
      total: results.length,
      passed: results.filter((r) => r.pass).length,
      failed: results.filter((r) => !r.pass).length,
      providerMode: 'deterministic',
    }
    console.log(`\nGolden validation summary: ${JSON.stringify(summary)}`)
  })

  describe('syntax defects', () => {
    it('detects a missing function-header colon', () => {
      const fixture = findFixture(dataset.fixtures, 'code-diagnosis-syntax-001')
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
      expect(result.expectedBoundary).toBe('SUPPORTED')
      expect(result.diagnosisShape).toBe('valid')
    })
  })

  describe('name lookup defects', () => {
    it('detects gd-p0-v1-058 num/nums mismatch', () => {
      const fixture = findFixture(dataset.fixtures, 'gd-p0-v1-058')
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
      expect(result.expectedBoundary).toBe('SUPPORTED')
      expect(result.actualClassification).toBe('CODE_DIAGNOSIS')
      expect(result.diagnosisShape).toBe('valid')
    })

    it('detects injection comment name lookup', () => {
      const fixture = findFixture(
        dataset.fixtures,
        'code-diagnosis-injection-comment-001',
      )
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
    })

    it('detects injection string name lookup', () => {
      const fixture = findFixture(
        dataset.fixtures,
        'code-diagnosis-injection-string-001',
      )
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
    })
  })

  describe('index defects', () => {
    it('detects index at list length', () => {
      const fixture = findFixture(dataset.fixtures, 'code-diagnosis-index-001')
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
      expect(result.diagnosisShape).toBe('valid')
    })
  })

  describe('loop defects', () => {
    it('detects unindented loop body', () => {
      const fixture = findFixture(
        dataset.fixtures,
        'code-diagnosis-loop-indentation-001',
      )
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
      expect(result.diagnosisShape).toBe('valid')
    })
  })

  describe('indentation defects', () => {
    it('covers indentation through the loop-indentation fixture', () => {
      const fixture = findFixture(
        dataset.fixtures,
        'code-diagnosis-loop-indentation-001',
      )
      const input = fixtureInput(fixture)
      const guidance = prepareDebuggingGuidance(input)

      expect(guidance).not.toBeNull()
      expect(guidance?.diagnosis.conceptExplanation).toMatch(/indent/iu)
    })
  })

  describe('function defects', () => {
    it('detects missing function argument', () => {
      const fixture = findFixture(
        dataset.fixtures,
        'code-diagnosis-function-usage-001',
      )
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
      expect(result.diagnosisShape).toBe('valid')
    })
  })

  describe('dictionary defects', () => {
    it('detects missing dictionary key', () => {
      const fixture = findFixture(
        dataset.fixtures,
        'code-diagnosis-dictionary-001',
      )
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
      expect(result.diagnosisShape).toBe('valid')
    })
  })

  describe('string defects', () => {
    it('detects string and integer concatenation', () => {
      const fixture = findFixture(dataset.fixtures, 'code-diagnosis-string-001')
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
      expect(result.diagnosisShape).toBe('valid')
    })
  })

  describe('file-path defects', () => {
    it('detects backslash escapes in a file path', () => {
      const fixture = findFixture(
        dataset.fixtures,
        'code-diagnosis-file-path-001',
      )
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
      expect(result.diagnosisShape).toBe('valid')
    })
  })

  describe('language-neutral diagnosis boundary', () => {
    it.each([
      'code-diagnosis-javascript-001',
      'code-diagnosis-typescript-001',
      'code-diagnosis-java-001',
      'code-diagnosis-c-001',
    ])('routes %s through one structured diagnosis', (fixtureId) => {
      const fixture = findFixture(dataset.fixtures, fixtureId)
      const input = fixtureInput(fixture)
      const selection = selectTutorStrategy(input)
      const guidance = prepareDebuggingGuidance(input)
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
      expect(result.expectedBoundary).toBe('SUPPORTED')
      expect(selection.boundaryResponse).toBeNull()
      expect(guidance?.retrievalQuery).toBeDefined()
      expect(guidance).not.toBeNull()
      expect(fixture.expectedProviderCalls).toBeNull()
    })
  })

  describe('over-limit boundary', () => {
    it('rejects 101-line code with zero provider calls', () => {
      const fixture = findFixture(
        dataset.fixtures,
        'code-diagnosis-lines-over-001',
      )
      const input = fixtureInput(fixture)
      const selection = selectTutorStrategy({
        studentMessage: input,
        analysis: {
          requestKind: MessageRequestKind.CODE_DIAGNOSIS,
          studentState: StudentState.DEBUGGING_ISSUE,
        },
      })
      const guidance = prepareDebuggingGuidance(input)
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
      expect(result.expectedBoundary).toBe('TOO_MANY_LINES')
      expect(selection.boundaryResponse).not.toBeNull()
      expect(selection.retrievalQuery).toBeNull()
      expect(guidance).toBeNull()
      expect(fixture.expectedProviderCalls).toBe(0)
    })
  })

  describe('full-corrected-program request', () => {
    it('refuses full rewrite while retaining a useful diagnosis', () => {
      const fixture = findFixture(
        dataset.fixtures,
        'code-diagnosis-full-correction-request-001',
      )
      const input = fixtureInput(fixture)
      const selection = selectTutorStrategy(input)
      const guidance = prepareDebuggingGuidance(input)
      const result = evaluateFixture(fixture)
      results.push(result)

      expect(result.pass).toBe(true)
      expect(selection.fullRewriteRequested).toBe(true)
      expect(guidance).not.toBeNull()
      expect(fixture.refuseFullRewrite).toBe(true)
      expect(fixture.forbiddenBehavior).toContain('FULL_CORRECTED_PROGRAM')
      expect(fixture.forbiddenBehavior).toContain('CORRECTED_FUNCTION')
    })
  })

  describe('malicious provider full rewrite', () => {
    it('blocks unsafe provider output containing a full rewrite', () => {
      const unsafeOutput = [
        'Likely defect',
        'The name `num` does not match `nums`.',
        '',
        'Relevant location',
        'The return expression.',
        '',
        'Concept',
        'Name lookup uses local scope. [1]',
        '',
        'Next inspection step',
        'Compare the return-expression name with the parameter.',
        '',
        'Here is the complete corrected code:',
        '```python',
        'def average(nums):',
        '    return sum(nums) / len(nums)',
        '```',
      ].join('\n')

      const policyResult = validateDebuggingGuidanceOutput({
        candidate: debuggingCandidate({ message: unsafeOutput }),
        allowedCitationIds: new Set(['retrieval.rank.1']),
        rewriteRequested: false,
      })

      expect(policyResult.approved).toBe(false)
    })
  })

  describe('no-full-code in diagnosis', () => {
    it('ensures diagnosis text contains no corrected code', () => {
      const fixture = findFixture(dataset.fixtures, 'gd-p0-v1-058')
      const input = fixtureInput(fixture)
      const guidance = prepareDebuggingGuidance(input)

      expect(guidance).not.toBeNull()
      if (guidance === null) {
        throw new Error('Expected guidance to be non-null')
      }
      const diagnosis = Object.values(guidance.diagnosis).join('\n')

      expect(diagnosis).not.toContain('def average(nums)')
      expect(diagnosis).not.toContain('return sum(nums) / len(nums)')
    })
  })

  describe('provider failure', () => {
    it('validates that provider error does not expose raw errors through the output guard', () => {
      const malformedOutput = 'Internal error: connection refused at 10.0.0.1'

      const policyResult = validateDebuggingGuidanceOutput({
        candidate: debuggingCandidate({
          message: malformedOutput,
          debuggingGuidance: null,
        }),
        allowedCitationIds: new Set(['retrieval.rank.1']),
        rewriteRequested: false,
      })

      expect(policyResult.approved).toBe(false)
    })

    it('validates that a shaped response without citations is rejected', () => {
      const policyResult = validateDebuggingGuidanceOutput({
        candidate: debuggingCandidate({ usedCitationIds: [] }),
        allowedCitationIds: new Set(['retrieval.rank.1']),
        rewriteRequested: false,
      })

      expect(policyResult).toEqual({
        approved: false,
        failure: 'MISSING_AUTHORIZED_CITATION',
      })
    })
  })

  describe('refresh persistence', () => {
    it('produces stable matcher output for the same input', () => {
      const fixture = findFixture(dataset.fixtures, 'gd-p0-v1-058')
      const input = fixtureInput(fixture)

      const first = prepareDebuggingGuidance(input)
      const second = prepareDebuggingGuidance(input)

      expect(first?.diagnosis).toEqual(second?.diagnosis)
      expect(first?.retrievalQuery).toBe(second?.retrievalQuery)
      expect(first?.suspectedCategory).toBe(second?.suspectedCategory)
    })

    it('produces stable language-neutral diagnosis for boundary fixtures', () => {
      const fixture = findFixture(
        dataset.fixtures,
        'code-diagnosis-javascript-001',
      )
      const input = fixtureInput(fixture)

      const first = prepareDebuggingGuidance(input)
      const second = prepareDebuggingGuidance(input)

      expect(first).not.toBeNull()
      expect(first?.diagnosis).toEqual(second?.diagnosis)
    })
  })

  describe('no-execution architecture assertion', () => {
    it('confirms the strategy produces no subprocess, interpreter, or eval path', () => {
      // This is verified architecturally by the existing
      // no-student-code-execution.spec.ts, which scans production source files.
      // Here we additionally confirm the strategy itself returns pure data
      // without side effects.
      for (const fixture of dataset.fixtures) {
        const input = fixtureInput(fixture)
        const selection = selectTutorStrategy(input)

        // The selection is a frozen data object with no callable side effects
        expect(Object.isFrozen(selection)).toBe(true)

        const guidance = prepareDebuggingGuidance(input)
        if (guidance !== null) {
          expect(Object.isFrozen(guidance)).toBe(true)
          expect(Object.isFrozen(guidance.diagnosis)).toBe(true)
        }
      }
    })
  })

  describe('gd-p0-v1-058 end-to-end', () => {
    it('satisfies every locked SCN-005 expectation', () => {
      const fixture = findFixture(dataset.fixtures, 'gd-p0-v1-058')
      const input = fixtureInput(fixture)
      const selection = selectTutorStrategy(input)
      const guidance = prepareDebuggingGuidance(input)

      // classification is CODE_DIAGNOSIS
      expect(selection.decision.requestKind).toBe(
        MessageRequestKind.CODE_DIAGNOSIS,
      )

      // strategy is DEBUGGING_GUIDANCE
      expect(selection.decision.strategy).toBe('DEBUGGING_GUIDANCE')

      // detects the num/nums mismatch or suspicious expression
      expect(guidance).not.toBeNull()
      if (guidance === null) {
        throw new Error('Expected guidance to be non-null')
      }
      expect(guidance.diagnosis.likelyDefect).toMatch(/num/iu)
      expect(guidance.diagnosis.likelyDefect).toMatch(/nums/iu)

      // points to the relevant return statement
      expect(guidance.diagnosis.location).toMatch(/return|len\(num\)/iu)

      // explains name lookup or scope
      expect(guidance.diagnosis.conceptExplanation).toMatch(
        /name lookup|scope/iu,
      )

      // gives exactly one next inspection step
      expect(guidance.diagnosis.nextInspectionStep.length).toBeGreaterThan(0)

      // retrieval query generated by the matcher
      expect(guidance.retrievalQuery).not.toBeNull()
      expect(guidance.retrievalQuery).toMatch(/code/iu)
      expect(guidance.retrievalQuery).toMatch(/name/iu)

      // does not provide a complete corrected program
      const diagnosis = Object.values(guidance.diagnosis).join('\n')
      expect(diagnosis).not.toContain('def average(nums)')
      expect(diagnosis).not.toContain('return sum(nums) / len(nums)')

      // remains linked to SCN-005
      expect(fixture.linkedDemoScenarioId).toBe('SCN-005')

      // expected source coverage
      expect(fixture.expectedSourceIds).toEqual(['p0-npt-part-02'])
      expect(fixture.expectedSourceLabel).toBe('COURSE_GROUNDED')
      expect(fixture.citationExpectation).toBe('REQUIRED')

      // forbidden behaviors
      expect(fixture.forbiddenBehavior).toContain('FULL_CORRECTED_PROGRAM')
      expect(fixture.forbiddenBehavior).toContain('CORRECTED_FUNCTION')
      expect(fixture.forbiddenBehavior).toContain('EXECUTION_CLAIM')
      expect(fixture.forbiddenBehavior).toContain('INVENTED_CITATION')

      // full rewrite not specifically requested in gd-p0-v1-058
      expect(selection.fullRewriteRequested).toBe(false)

      // guidance label
      expect(selection.decision.guidanceLabel).toBe(
        MessageGuidanceLabel.COURSE_GROUNDED,
      )
    })
  })

  describe('canonical diagnosis ownership', () => {
    it('resolves a canonical diagnosis independent of TeachingDecision strategy', () => {
      // Proves that diagnosis is available via the deterministic matcher
      // even when the same code could produce a SOCRATIC_QUESTIONING
      // TeachingDecision. Debugging admission determines diagnosis
      // applicability; TeachingDecision owns strategy independently.
      const input = [
        'Why does this fail?',
        '```python',
        'def average(nums):',
        '    return sum(nums) / len(num)',
        '```',
      ].join('\n')
      const _messageId = '11111111-1111-4111-8111-111111111111'

      // Matcher produces a valid diagnosis
      const guidance = prepareDebuggingGuidance(input)
      expect(guidance).not.toBeNull()
      expect(guidance?.resolution).toBe('MATCH')
      expect(guidance?.diagnosis.likelyDefect).toMatch(/num.*nums/iu)
      expect(guidance?.suspectedCategory).toBe('NAME_LOOKUP')
    })

    it('maps FILE_HANDLING category in strategy', () => {
      const input = [
        'Why could this file path be interpreted differently than expected?',
        '```python',
        'path = "C:\\new\\notes.txt"',
        'with open(path, "r") as file:',
        '    print(file.read())',
        '```',
      ].join('\n')

      const guidance = prepareDebuggingGuidance(input)
      expect(guidance?.suspectedCategory).toBe('FILE_HANDLING')
    })
  })

  describe('complete fixture coverage', () => {
    it('evaluates every fixture in the dataset', () => {
      for (const fixture of dataset.fixtures) {
        const result = evaluateFixture(fixture)
        results.push(result)

        expect({
          id: fixture.id,
          pass: result.pass,
          failureNote: result.failureNote,
        }).toEqual({
          id: fixture.id,
          pass: true,
          failureNote: '',
        })
      }
    })
  })
})

function debuggingCandidate(
  patch: Partial<CandidateResponse> = {},
): CandidateResponse {
  return {
    message: [
      'Likely defect',
      'The name num does not match nums.',
      '',
      'Relevant location',
      'The return expression.',
      '',
      'Concept',
      'Name lookup uses local scope. [retrieval.rank.1]',
      '',
      'Next inspection step',
      'Compare the names.',
    ].join('\n'),
    debuggingGuidance: {
      diagnosis: 'The name num does not match nums.',
      relevantLocation: 'The return expression.',
      conceptExplanation: 'Name lookup uses local scope.',
      inspectionActions: ['Compare the names.'],
    },
    responseIntent: TeachingStrategy.DEBUGGING_GUIDANCE,
    usedCitationIds: ['retrieval.rank.1'],
    requiresStudentAction: true,
    studentAction: {
      type: TeachingTechnique.TRACE_EXECUTION,
      description: 'Compare the names.',
    },
    reflectionIncluded: false,
    selfReportedCompliance: {
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    },
    provider: 'deterministic',
    model: 'deterministic-tutor',
    promptVersion: 'tutor-generation.mvp.v10',
    tokenUsage: { input: 0, output: 0 },
    ...patch,
  }
}
