import { debuggingDiagnosisModelOutputSchema } from './debugging-diagnosis-model.schema'

describe('debuggingDiagnosisModelOutputSchema', () => {
  it('accepts the bounded resolved shape and rejects backend-owned fields', () => {
    const resolved = {
      status: 'RESOLVED',
      category: 'INITIALIZATION',
      likelyDefect: 'The accumulator starts from an invalid sentinel.',
      location: { kind: 'CODE', lineStart: 2, lineEnd: 2 },
      evidenceReferences: [
        { source: 'CODE', lineStart: 2, lineEnd: 2 },
        { source: 'SYMPTOM', lineStart: null, lineEnd: null },
      ],
      underlyingConcept:
        'Accumulator initialization must match the expected value range.',
      requiresRuntimeEvidence: true,
      runtimeEvidenceNeeded: 'TRACE_VALUES',
      inspectionGoal: 'Trace the accumulator on one failing input.',
    }

    expect(
      debuggingDiagnosisModelOutputSchema.safeParse(resolved).success,
    ).toBe(true)
    expect(
      debuggingDiagnosisModelOutputSchema.safeParse({
        ...resolved,
        confidence: 'HIGH',
      }).success,
    ).toBe(false)
    expect(
      debuggingDiagnosisModelOutputSchema.safeParse({
        ...resolved,
        source: 'MODEL',
      }).success,
    ).toBe(false)
  })
})
