import type { DebuggingDiagnosisModelOutput } from './debugging-diagnosis-model.schema'

export const DEBUGGING_DIAGNOSIS_MODEL_VIOLATION = {
  INVALID_CODE_RANGE: 'INVALID_CODE_RANGE',
  INVALID_SYMPTOM_REFERENCE: 'INVALID_SYMPTOM_REFERENCE',
  RESOLVED_INVALID_LOCATION: 'RESOLVED_INVALID_LOCATION',
  RESOLVED_WITHOUT_EVIDENCE: 'RESOLVED_WITHOUT_EVIDENCE',
  RESOLVED_UNSUPPORTED_LOCATION: 'RESOLVED_UNSUPPORTED_LOCATION',
  RESOLVED_UNKNOWN_CATEGORY: 'RESOLVED_UNKNOWN_CATEGORY',
  RESOLVED_MISSING_CONCEPT: 'RESOLVED_MISSING_CONCEPT',
  UNCERTAIN_ASSERTS_DEFECT: 'UNCERTAIN_ASSERTS_DEFECT',
  INCONSISTENT_RUNTIME_EVIDENCE: 'INCONSISTENT_RUNTIME_EVIDENCE',
  SOLUTION_LEAK: 'SOLUTION_LEAK',
  EXECUTION_CLAIM: 'EXECUTION_CLAIM',
  UNSUPPORTED_RUNTIME_CLAIM: 'UNSUPPORTED_RUNTIME_CLAIM',
} as const

export type DebuggingDiagnosisModelViolation =
  (typeof DEBUGGING_DIAGNOSIS_MODEL_VIOLATION)[keyof typeof DEBUGGING_DIAGNOSIS_MODEL_VIOLATION]

export function validateDebuggingDiagnosisModelOutput(
  output: DebuggingDiagnosisModelOutput,
  input: { readonly codeLineCount: number; readonly symptom: string },
): readonly DebuggingDiagnosisModelViolation[] {
  const violations: DebuggingDiagnosisModelViolation[] = []
  const references = [output.location, ...output.evidenceReferences]
  for (const reference of references) {
    const source = 'source' in reference ? reference.source : reference.kind
    if (
      source === 'CODE' &&
      !isValidCodeRange(reference, input.codeLineCount)
    ) {
      violations.push(DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.INVALID_CODE_RANGE)
    }
    if (
      source === 'SYMPTOM' &&
      (reference.lineStart !== null ||
        reference.lineEnd !== null ||
        input.symptom.trim() === '')
    ) {
      violations.push(
        DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.INVALID_SYMPTOM_REFERENCE,
      )
    }
  }

  if (
    (output.requiresRuntimeEvidence &&
      output.runtimeEvidenceNeeded === 'NONE') ||
    (!output.requiresRuntimeEvidence && output.runtimeEvidenceNeeded !== 'NONE')
  ) {
    violations.push(
      DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.INCONSISTENT_RUNTIME_EVIDENCE,
    )
  }

  if (output.status === 'RESOLVED') {
    if (output.location.kind === 'UNKNOWN') {
      violations.push(
        DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.RESOLVED_INVALID_LOCATION,
      )
    }
    if (output.location.kind === 'CODE') {
      const locStart = output.location.lineStart
      const locEnd = output.location.lineEnd
      const hasSupportingCodeEvidence = output.evidenceReferences.some(
        (ref) =>
          ref.source === 'CODE' &&
          ref.lineStart !== null &&
          ref.lineEnd !== null &&
          locStart !== null &&
          locEnd !== null &&
          ref.lineStart <= locEnd &&
          ref.lineEnd >= locStart,
      )
      if (!hasSupportingCodeEvidence) {
        violations.push(
          DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.RESOLVED_UNSUPPORTED_LOCATION,
        )
      }
    }
    if (output.evidenceReferences.length === 0) {
      violations.push(
        DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.RESOLVED_WITHOUT_EVIDENCE,
      )
    }
    if (output.category === 'UNKNOWN') {
      violations.push(
        DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.RESOLVED_UNKNOWN_CATEGORY,
      )
    }
    if (output.likelyDefect === null || output.underlyingConcept === null) {
      violations.push(
        DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.RESOLVED_MISSING_CONCEPT,
      )
    }
  } else if (
    output.likelyDefect !== null ||
    output.category !== 'UNKNOWN' ||
    output.underlyingConcept !== null
  ) {
    violations.push(
      DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.UNCERTAIN_ASSERTS_DEFECT,
    )
  }

  const text = [
    output.likelyDefect,
    output.underlyingConcept,
    output.inspectionGoal,
  ]
    .filter((value): value is string => value !== null)
    .join('\n')
  if (containsSolution(text)) {
    violations.push(DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.SOLUTION_LEAK)
  }
  if (claimsExecution(text)) {
    violations.push(DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.EXECUTION_CLAIM)
  }
  if (claimsUnreportedOutput(text, input.symptom)) {
    violations.push(
      DEBUGGING_DIAGNOSIS_MODEL_VIOLATION.UNSUPPORTED_RUNTIME_CLAIM,
    )
  }

  return Object.freeze([...new Set(violations)])
}

function isValidCodeRange(
  reference: {
    readonly lineStart: number | null
    readonly lineEnd: number | null
  },
  codeLineCount: number,
): boolean {
  if (reference.lineStart === null || reference.lineEnd === null) return false
  return (
    reference.lineStart <= reference.lineEnd &&
    reference.lineStart <= codeLineCount &&
    reference.lineEnd <= codeLineCount
  )
}

function containsSolution(value: string): boolean {
  return (
    value.includes('```') ||
    /(?:^|\n)\s*(?:def|function|class)\s+\w+/mu.test(value) ||
    value.split('\n').filter((line) => /[{};=]/u.test(line)).length >= 3
  )
}

function claimsExecution(value: string): boolean {
  return /\b(?:i|we|the code)\s+(?:ran|executed|tested)|\b(?:test run|runtime output)\b/iu.test(
    value,
  )
}

function claimsUnreportedOutput(value: string, symptom: string): boolean {
  const runtimeClaimPattern =
    /\b(?:returned|printed|outputted|evaluates to|evaluates as|yielded)\s+[-+]?\d+|\b(?:returned|printed|outputted)\s+(?:True|False|None|\[|\{|"|'|NaN)\b/iu
  const claimMatch = runtimeClaimPattern.exec(value)
  return claimMatch !== null && !symptom.includes(claimMatch[0])
}
