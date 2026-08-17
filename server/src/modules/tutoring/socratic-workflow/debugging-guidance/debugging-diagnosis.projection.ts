import type { PersistedDebuggingDiagnosis } from './debugging-diagnosis.repository'
import type { DebuggingGuidanceContext } from './debugging-guidance.output-validator'

export function debuggingGuidanceContextFromDiagnosis(input: {
  diagnosis: PersistedDebuggingDiagnosis
  rewriteRequested: boolean
}): DebuggingGuidanceContext {
  const diagnosis = input.diagnosis
  return Object.freeze({
    likelyIssue:
      diagnosis.likelyDefect ??
      'Static inspection does not establish a specific defect yet.',
    relevantLocation: locationText(diagnosis),
    concept:
      diagnosis.underlyingConcept ??
      'Use one trace to compare the actual values with the expected result.',
    nextInspectionStep: diagnosis.inspectionGoal,
    evidenceQuery: debuggingRetrievalQuery(diagnosis),
    rewriteRequested: input.rewriteRequested,
  })
}

export function debuggingRetrievalQuery(
  diagnosis: PersistedDebuggingDiagnosis,
): string {
  if (diagnosis.status === 'UNCERTAIN') {
    return buildUncertainRetrievalQuery(diagnosis)
  }

  return buildResolvedRetrievalQuery(diagnosis)
}

const CATEGORY_RETRIEVAL_LABEL: Record<
  PersistedDebuggingDiagnosis['category'],
  string
> = {
  SYNTAX: 'syntax delimiter issue',
  NAME_REFERENCE: 'name lookup or reference issue',
  COLLECTION_INDEX: 'collection access or index issue',
  NESTED_CONTROL_FLOW: 'control-flow or indentation issue',
  CALL_SIGNATURE: 'function call or parameter issue',
  TYPE_COMPATIBILITY: 'type compatibility issue',
  INITIALIZATION: 'initialization issue',
  BOUNDARY: 'boundary issue',
  CONDITION: 'condition issue',
  COMPARISON: 'comparison issue',
  STATE_UPDATE: 'state update issue',
  RETURN_VALUE: 'return value issue',
  UNKNOWN: 'debugging issue',
}

const MAX_RETRIEVAL_QUERY_LENGTH = 600
const MAX_SIGNAL_LENGTH = 200

function buildResolvedRetrievalQuery(
  diagnosis: PersistedDebuggingDiagnosis,
): string {
  const signals: string[] = []

  // Priority 1: underlyingConcept — strongest semantic signal
  if (diagnosis.underlyingConcept !== null) {
    signals.push(boundSignal(diagnosis.underlyingConcept))
  }

  // Priority 2: category label
  signals.push(CATEGORY_RETRIEVAL_LABEL[diagnosis.category])

  // Priority 3: likelyDefect — validated by DebuggingDiagnosisService
  if (diagnosis.likelyDefect !== null) {
    signals.push(boundSignal(diagnosis.likelyDefect))
  }

  // Priority 4: inspectionGoal
  signals.push(boundSignal(diagnosis.inspectionGoal))

  // Priority 5: language context
  if (diagnosis.language !== null) {
    signals.push(`${diagnosis.language} programming`)
  }

  // Priority 6: validated location reference
  signals.push(locationText(diagnosis))

  return boundQuery(signals)
}

function buildUncertainRetrievalQuery(
  diagnosis: PersistedDebuggingDiagnosis,
): string {
  const signals: string[] = []

  // Safe signals only — no fabricated defect category or symptom text
  signals.push(boundSignal(diagnosis.inspectionGoal))

  if (diagnosis.language !== null) {
    signals.push(`${diagnosis.language} programming`)
  }

  if (diagnosis.requiresRuntimeEvidence) {
    signals.push('tracing values and comparing actual and expected behavior')
  }

  return boundQuery(signals)
}

function boundSignal(value: string): string {
  if (value.length <= MAX_SIGNAL_LENGTH) {
    return value
  }
  return value.slice(0, MAX_SIGNAL_LENGTH)
}

function boundQuery(signals: readonly string[]): string {
  let query = signals.join('; ')
  if (query.length > MAX_RETRIEVAL_QUERY_LENGTH) {
    query = query.slice(0, MAX_RETRIEVAL_QUERY_LENGTH)
  }
  return query
}

function locationText(diagnosis: PersistedDebuggingDiagnosis): string {
  if (diagnosis.location.lineStart !== null) {
    return `line ${String(diagnosis.location.lineStart)}`
  }
  return diagnosis.location.kind === 'SYMPTOM'
    ? 'the submitted symptom and the smallest related code block'
    : 'the smallest related code block'
}
