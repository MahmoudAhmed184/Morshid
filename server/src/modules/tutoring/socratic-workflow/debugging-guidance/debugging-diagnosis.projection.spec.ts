import { DEBUGGING_DIAGNOSIS_SCHEMA_VERSION } from './debugging-diagnosis.contract'
import type { PersistedDebuggingDiagnosis } from './debugging-diagnosis.repository'
import {
  debuggingGuidanceContextFromDiagnosis,
  debuggingRetrievalQuery,
} from './debugging-diagnosis.projection'

const messageId = '11111111-1111-4111-8111-111111111111'
const attemptId = '22222222-2222-4222-8222-222222222222'

function resolvedDiagnosis(
  patch: Partial<PersistedDebuggingDiagnosis> = {},
): PersistedDebuggingDiagnosis {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    tutoringAttemptId: attemptId,
    schemaVersion: DEBUGGING_DIAGNOSIS_SCHEMA_VERSION,
    status: 'RESOLVED',
    source: 'MODEL',
    language: 'python',
    category: 'INITIALIZATION',
    confidence: 'MEDIUM',
    likelyDefect:
      'The running maximum starts at 0, so all-negative inputs never replace it.',
    location: {
      messageId,
      lineStart: 2,
      lineEnd: 2,
      kind: 'CODE',
    },
    evidence: [
      { messageId, lineStart: 2, lineEnd: 2, kind: 'CODE' },
      { messageId, lineStart: null, lineEnd: null, kind: 'SYMPTOM' },
    ],
    underlyingConcept:
      'A running maximum must be initialized from the data or a valid lower bound.',
    requiresRuntimeEvidence: true,
    runtimeEvidenceNeeded: 'TRACE_VALUES',
    inspectionGoal: 'Trace the tracked maximum on an all-negative input.',
    fallbackReason: null,
    provider: 'fake-provider',
    model: 'fake-diagnosis-model',
    promptVersion: 'debugging-diagnosis.v1',
    inputTokens: 100,
    outputTokens: 80,
    infrastructureRetryCount: 0,
    createdAt: new Date('2026-08-16T00:00:00.000Z'),
    ...patch,
  }
}

function deterministicDiagnosis(
  patch: Partial<PersistedDebuggingDiagnosis> = {},
): PersistedDebuggingDiagnosis {
  return resolvedDiagnosis({
    source: 'DETERMINISTIC',
    confidence: 'HIGH',
    category: 'NAME_REFERENCE',
    likelyDefect: 'The name `num` does not match the visible `nums` name.',
    underlyingConcept:
      'Name lookup searches the active scope, where `nums` exists but `num` does not.',
    inspectionGoal:
      'Compare every name in the return expression with the function parameters and local variables.',
    location: { messageId, lineStart: 4, lineEnd: 4, kind: 'CODE' },
    evidence: [{ messageId, lineStart: 4, lineEnd: 4, kind: 'CODE' }],
    provider: null,
    model: null,
    promptVersion: null,
    inputTokens: null,
    outputTokens: null,
    ...patch,
  })
}

function uncertainDiagnosis(
  patch: Partial<PersistedDebuggingDiagnosis> = {},
): PersistedDebuggingDiagnosis {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    tutoringAttemptId: attemptId,
    schemaVersion: DEBUGGING_DIAGNOSIS_SCHEMA_VERSION,
    status: 'UNCERTAIN',
    source: 'FALLBACK',
    language: 'python',
    category: 'UNKNOWN',
    confidence: 'LOW',
    likelyDefect: null,
    location: {
      messageId,
      lineStart: null,
      lineEnd: null,
      kind: 'SYMPTOM',
    },
    evidence: [{ messageId, lineStart: null, lineEnd: null, kind: 'SYMPTOM' }],
    underlyingConcept: null,
    requiresRuntimeEvidence: true,
    runtimeEvidenceNeeded: 'TRACE_VALUES',
    inspectionGoal:
      'Trace one input that shows the reported behavior and identify the first value that differs from the expected result.',
    fallbackReason: 'MODEL_UNAVAILABLE',
    provider: null,
    model: null,
    promptVersion: null,
    inputTokens: null,
    outputTokens: null,
    infrastructureRetryCount: 0,
    createdAt: new Date('2026-08-16T00:00:00.000Z'),
    ...patch,
  }
}

describe('debuggingRetrievalQuery — diagnosis-aware retrieval', () => {
  // A. RESOLVED deterministic diagnosis
  it('uses underlyingConcept and category for a RESOLVED deterministic diagnosis', () => {
    const query = debuggingRetrievalQuery(deterministicDiagnosis())

    expect(query).toContain('Name lookup')
    expect(query).toContain('name lookup or reference issue')
    expect(query).toContain('Compare every name')
  })

  // B. RESOLVED model diagnosis
  it('uses underlyingConcept and category for a RESOLVED model diagnosis', () => {
    const query = debuggingRetrievalQuery(resolvedDiagnosis())

    expect(query).toContain('running maximum')
    expect(query).toContain('initialization issue')
    expect(query).toContain('Trace the tracked maximum')
  })

  // C. INITIALIZATION semantic bug — concept-based query
  it('produces initialization-relevant query signals for INITIALIZATION category', () => {
    const query = debuggingRetrievalQuery(resolvedDiagnosis())

    expect(query).toMatch(/initial|lower bound|running maximum/iu)
    expect(query).toContain('initialization issue')
    // Must not degrade into generic syntax
    expect(query).not.toMatch(/syntax delimiter/iu)
    expect(query).not.toMatch(/missing colon/iu)
    expect(query).not.toMatch(/indentation/iu)
  })

  // D. Non-initialization category — proves generality
  it('uses the category label for a BOUNDARY diagnosis', () => {
    const query = debuggingRetrievalQuery(
      resolvedDiagnosis({
        category: 'BOUNDARY',
        underlyingConcept:
          'Loop boundaries decide whether every collection element is visited.',
        likelyDefect:
          'The loop stops before the last item, so one item is never counted.',
        inspectionGoal: 'Trace which indexes the loop visits.',
      }),
    )

    expect(query).toContain('boundary issue')
    expect(query).toContain('Loop boundaries')
    expect(query).not.toContain('initialization')
  })

  it('uses the category label for a CONDITION diagnosis', () => {
    const query = debuggingRetrievalQuery(
      resolvedDiagnosis({
        category: 'CONDITION',
        underlyingConcept:
          'A conditional expression must compare the intended operands to branch correctly.',
        likelyDefect: 'The comparison uses the wrong operand.',
        inspectionGoal:
          'Compare the conditional expression with the intended test.',
      }),
    )

    expect(query).toContain('condition issue')
    expect(query).toContain('conditional expression')
    expect(query).not.toContain('initialization')
  })

  it('uses the category label for a RETURN_VALUE diagnosis', () => {
    const query = debuggingRetrievalQuery(
      resolvedDiagnosis({
        category: 'RETURN_VALUE',
        underlyingConcept:
          'A function must return the accumulated result, not the input parameter.',
        likelyDefect:
          'The return statement returns the input instead of the result.',
        inspectionGoal: 'Inspect which variable the return statement returns.',
      }),
    )

    expect(query).toContain('return value issue')
    expect(query).toContain('accumulated result')
    expect(query).not.toContain('initialization')
  })

  it('uses the category label for a STATE_UPDATE diagnosis', () => {
    const query = debuggingRetrievalQuery(
      resolvedDiagnosis({
        category: 'STATE_UPDATE',
        underlyingConcept:
          'A counter must be incremented on every relevant iteration.',
        likelyDefect: 'The counter is not updated inside the loop body.',
        inspectionGoal: 'Trace the counter value across iterations.',
      }),
    )

    expect(query).toContain('state update issue')
    expect(query).toContain('counter')
    expect(query).not.toContain('initialization')
  })

  // E. UNCERTAIN diagnosis
  it('does not fabricate a defect-specific query for UNCERTAIN diagnosis', () => {
    const query = debuggingRetrievalQuery(uncertainDiagnosis())

    // Must not contain category-specific labels
    expect(query).not.toContain('initialization issue')
    expect(query).not.toContain('syntax delimiter')
    expect(query).not.toContain('boundary issue')
    // Must contain safe investigation signals
    expect(query).toContain('Trace one input')
    expect(query).toContain('tracing values')
  })

  // F. requiresRuntimeEvidence = true
  it('includes runtime-evidence signals when requiresRuntimeEvidence is true', () => {
    const query = debuggingRetrievalQuery(
      uncertainDiagnosis({ requiresRuntimeEvidence: true }),
    )

    expect(query).toContain('tracing values')
    expect(query).toContain('comparing actual and expected behavior')
  })

  // G. Missing underlyingConcept
  it('produces a valid query when underlyingConcept is null', () => {
    const query = debuggingRetrievalQuery(
      resolvedDiagnosis({ underlyingConcept: null }),
    )

    expect(query.length).toBeGreaterThan(0)
    expect(query).toContain('initialization issue')
    expect(query).toContain('Trace the tracked maximum')
  })

  // H. Missing likelyDefect — uncertain diagnoses always have null likelyDefect
  it('produces a valid query when likelyDefect is null (uncertain)', () => {
    const query = debuggingRetrievalQuery(uncertainDiagnosis())

    expect(query.length).toBeGreaterThan(0)
    expect(query).not.toContain('null')
  })

  // I. Validated CODE location
  it('includes code line reference for validated CODE location', () => {
    const query = debuggingRetrievalQuery(
      resolvedDiagnosis({
        location: { messageId, lineStart: 5, lineEnd: 5, kind: 'CODE' },
      }),
    )

    expect(query).toContain('line 5')
  })

  // J. UNCERTAIN location — does not fabricate symptom text from location.kind enum
  it('does not fabricate symptom or code-block text from location.kind for UNCERTAIN diagnosis', () => {
    const query = debuggingRetrievalQuery(
      uncertainDiagnosis({
        location: {
          messageId,
          lineStart: null,
          lineEnd: null,
          kind: 'SYMPTOM',
        },
      }),
    )

    // location.kind is an enum, not student text — query must not infer symptom content
    expect(query).not.toContain('investigating the reported symptom')
    expect(query).not.toContain('investigating the related code block')
    expect(query).not.toMatch(/line \d+/u)
  })

  // K. No fabricated syntax terms
  it('does not fabricate syntax terms for INITIALIZATION diagnosis', () => {
    const query = debuggingRetrievalQuery(resolvedDiagnosis())

    expect(query).not.toMatch(/MISSING_BLOCK_COLON/iu)
    expect(query).not.toMatch(/delimiter/iu)
    expect(query).not.toMatch(/indentation mismatch/iu)
  })

  // L. Bounded output — total query and individual signals
  it('produces a bounded query under 600 characters', () => {
    const longDiagnosis = resolvedDiagnosis({
      underlyingConcept: 'A'.repeat(400),
      likelyDefect: 'B'.repeat(400),
      inspectionGoal: 'C'.repeat(400),
    })
    const query = debuggingRetrievalQuery(longDiagnosis)

    expect(query.length).toBeLessThanOrEqual(600)
  })

  it('limits individual signal length to prevent one field from dominating', () => {
    const longDiagnosis = resolvedDiagnosis({
      underlyingConcept: 'A'.repeat(300),
    })
    const query = debuggingRetrievalQuery(longDiagnosis)

    // underlyingConcept is 300 chars but signal limit is 200
    const firstSignal = query.split('; ')[0]
    expect(firstSignal.length).toBeLessThanOrEqual(200)
  })

  it('includes language context when available', () => {
    const query = debuggingRetrievalQuery(
      resolvedDiagnosis({ language: 'python' }),
    )

    expect(query).toContain('python programming')
  })

  it('omits language context when null', () => {
    const query = debuggingRetrievalQuery(resolvedDiagnosis({ language: null }))

    expect(query).not.toContain('programming')
  })

  it('does not contain persistence metadata', () => {
    const query = debuggingRetrievalQuery(resolvedDiagnosis())

    expect(query).not.toContain('fake-provider')
    expect(query).not.toContain('fake-diagnosis-model')
    expect(query).not.toContain(attemptId)
    expect(query).not.toContain(messageId)
  })
})

describe('debuggingGuidanceContextFromDiagnosis', () => {
  it('projects canonical diagnosis fields for generation context', () => {
    const context = debuggingGuidanceContextFromDiagnosis({
      diagnosis: resolvedDiagnosis(),
      rewriteRequested: false,
    })

    expect(context.likelyIssue).toContain('running maximum starts at 0')
    expect(context.relevantLocation).toContain('line 2')
    expect(context.concept).toContain('running maximum')
    expect(context.nextInspectionStep).toContain('Trace the tracked maximum')
    expect(context.evidenceQuery.length).toBeGreaterThan(0)
    expect(context.rewriteRequested).toBe(false)
  })

  it('projects uncertain diagnosis with safe fallback values', () => {
    const context = debuggingGuidanceContextFromDiagnosis({
      diagnosis: uncertainDiagnosis(),
      rewriteRequested: false,
    })

    expect(context.likelyIssue).toContain(
      'Static inspection does not establish a specific defect yet.',
    )
    expect(context.concept).toContain('trace')
    expect(context.rewriteRequested).toBe(false)
    // Must not contain fabricated defect categories
    expect(context.evidenceQuery).not.toContain('initialization issue')
    expect(context.evidenceQuery).not.toContain('syntax delimiter')
  })

  it('carries the rewriteRequested flag through the projection', () => {
    const context = debuggingGuidanceContextFromDiagnosis({
      diagnosis: resolvedDiagnosis(),
      rewriteRequested: true,
    })

    expect(context.rewriteRequested).toBe(true)
  })

  it('does not expose provider/model metadata in generation context', () => {
    const context = debuggingGuidanceContextFromDiagnosis({
      diagnosis: resolvedDiagnosis(),
      rewriteRequested: false,
    })

    const json = JSON.stringify(context)
    expect(json).not.toContain('fake-provider')
    expect(json).not.toContain('fake-diagnosis-model')
    expect(json).not.toContain(attemptId)
  })

  it('derives retrieval query from the same canonical diagnosis', () => {
    const diagnosis = resolvedDiagnosis()
    const context = debuggingGuidanceContextFromDiagnosis({
      diagnosis,
      rewriteRequested: false,
    })

    expect(context.evidenceQuery).toBe(debuggingRetrievalQuery(diagnosis))
  })
})
