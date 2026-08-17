import {
  DEBUGGING_DIAGNOSIS_MODEL_VIOLATION,
  validateDebuggingDiagnosisModelOutput,
} from './debugging-diagnosis-model.validator'
import type { DebuggingDiagnosisModelOutput } from './debugging-diagnosis-model.schema'

describe('validateDebuggingDiagnosisModelOutput', () => {
  it('rejects resolved output without valid evidence and location', () => {
    expect(
      validateDebuggingDiagnosisModelOutput(
        {
          ...resolvedOutput(),
          location: { kind: 'UNKNOWN', lineStart: null, lineEnd: null },
          evidenceReferences: [{ source: 'CODE', lineStart: 20, lineEnd: 20 }],
        },
        { codeLineCount: 4, symptom: 'wrong answer' },
      ),
    ).toEqual(
      expect.arrayContaining([
        DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.RESOLVED_INVALID_LOCATION,
        DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.INVALID_CODE_RANGE,
      ]),
    )
  })

  it('rejects fake execution claims and corrected solution leaks', () => {
    expect(
      validateDebuggingDiagnosisModelOutput(
        {
          ...resolvedOutput(),
          likelyDefect: 'I ran it and it returned 0 for [-5, -2].',
        },
        { codeLineCount: 4, symptom: 'wrong answer' },
      ),
    ).toEqual(
      expect.arrayContaining([
        DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.EXECUTION_CLAIM,
        DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.UNSUPPORTED_RUNTIME_CLAIM,
      ]),
    )

    expect(
      validateDebuggingDiagnosisModelOutput(
        {
          ...resolvedOutput(),
          inspectionGoal:
            '```python\ndef fixed():\n    value = 1\n    return value\n```',
        },
        { codeLineCount: 4, symptom: 'wrong answer' },
      ),
    ).toContain(DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.SOLUTION_LEAK)
  })

  it('requires uncertainty to avoid naming a defect', () => {
    expect(
      validateDebuggingDiagnosisModelOutput(
        {
          ...uncertainOutput(),
          category: 'BOUNDARY',
          likelyDefect: 'The boundary might be wrong.',
        },
        { codeLineCount: 4, symptom: 'wrong answer' },
      ),
    ).toContain(DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.UNCERTAIN_ASSERTS_DEFECT)
  })

  it('enforces cross-field runtime evidence invariants', () => {
    expect(
      validateDebuggingDiagnosisModelOutput(
        {
          ...resolvedOutput(),
          requiresRuntimeEvidence: false,
          runtimeEvidenceNeeded: 'TRACE_VALUES',
        },
        { codeLineCount: 4, symptom: 'wrong answer' },
      ),
    ).toContain(
      DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.INCONSISTENT_RUNTIME_EVIDENCE,
    )

    expect(
      validateDebuggingDiagnosisModelOutput(
        {
          ...resolvedOutput(),
          requiresRuntimeEvidence: true,
          runtimeEvidenceNeeded: 'NONE',
        },
        { codeLineCount: 4, symptom: 'wrong answer' },
      ),
    ).toContain(
      DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.INCONSISTENT_RUNTIME_EVIDENCE,
    )
  })

  it('rejects resolved location that is not supported by code evidence', () => {
    expect(
      validateDebuggingDiagnosisModelOutput(
        {
          ...resolvedOutput(),
          location: { kind: 'CODE', lineStart: 4, lineEnd: 4 },
          evidenceReferences: [{ source: 'CODE', lineStart: 2, lineEnd: 2 }],
        },
        { codeLineCount: 4, symptom: 'wrong answer' },
      ),
    ).toContain(
      DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.RESOLVED_UNSUPPORTED_LOCATION,
    )
  })

  it('allows static code semantic claims while rejecting invented runtime outputs', () => {
    // Static code description without observed concrete runtime values
    expect(
      validateDebuggingDiagnosisModelOutput(
        {
          ...resolvedOutput(),
          likelyDefect:
            'The function returns the variable total instead of count.',
        },
        { codeLineCount: 4, symptom: 'wrong answer' },
      ),
    ).not.toContain(
      DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.UNSUPPORTED_RUNTIME_CLAIM,
    )

    // Invented concrete runtime output claim
    expect(
      validateDebuggingDiagnosisModelOutput(
        {
          ...resolvedOutput(),
          likelyDefect: 'The function returned 0 for [-5, -2]',
        },
        { codeLineCount: 4, symptom: 'wrong answer' },
      ),
    ).toContain(DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.UNSUPPORTED_RUNTIME_CLAIM)
  })
})

function resolvedOutput(): DebuggingDiagnosisModelOutput {
  return {
    status: 'RESOLVED',
    category: 'BOUNDARY',
    likelyDefect: 'The loop skips the last value.',
    location: { kind: 'CODE', lineStart: 3, lineEnd: 3 },
    evidenceReferences: [
      { source: 'CODE', lineStart: 3, lineEnd: 3 },
      { source: 'SYMPTOM', lineStart: null, lineEnd: null },
    ],
    underlyingConcept: 'Loop bounds control visited values.',
    requiresRuntimeEvidence: true,
    runtimeEvidenceNeeded: 'TRACE_VALUES',
    inspectionGoal: 'Trace which values the loop visits.',
  }
}

function uncertainOutput(): DebuggingDiagnosisModelOutput {
  return {
    status: 'UNCERTAIN',
    category: 'UNKNOWN',
    likelyDefect: null,
    location: { kind: 'SYMPTOM', lineStart: null, lineEnd: null },
    evidenceReferences: [],
    underlyingConcept: null,
    requiresRuntimeEvidence: true,
    runtimeEvidenceNeeded: 'TRACE_VALUES',
    inspectionGoal: 'Trace one input and compare the first unexpected value.',
  }
}
