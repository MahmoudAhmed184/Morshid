import {
  serializeAutomaticSafetySmokeFailure,
  serializeAutomaticSafetySmokeSuccess,
} from './automatic-safety-smoke-report'

const AUTOMATIC_SCENARIO_IDS = [
  'SCN-01',
  'SCN-02',
  'SCN-03',
  'SCN-04',
  'SCN-05',
  'SCN-06',
  'SCN-07',
  'SCN-08',
] as const

const forbiddenSentinels = [
  'prompt-sentinel',
  'response-sentinel',
  'excerpt-sentinel',
  'vector-sentinel',
  'https://private.example/sentinel',
  'credential-sentinel',
  'raw-error-sentinel',
  'stack-trace-sentinel',
] as const

describe('automatic safety live-smoke report', () => {
  it('emits only the allowlisted success schema', () => {
    const serialized = serializeAutomaticSafetySmokeSuccess(validInput())
    const parsed = JSON.parse(serialized) as Record<string, unknown>

    expect(Object.keys(parsed).sort()).toEqual(
      [
        'completionCount',
        'completionModel',
        'completionProvider',
        'embeddingCount',
        'embeddingModel',
        'embeddingProtocol',
        'embeddingProvider',
        'executedAt',
        'fixtureHash',
        'fixtureIdentifier',
        'deterministicScenarioIds',
        'liveCompletionScenarioIds',
        'liveQueryEmbeddingScenarioIds',
        'outcome',
        'promptVersion',
        'qualificationMode',
        'testedCommitSha',
      ].sort(),
    )
    for (const forbidden of forbiddenSentinels) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it('rejects non-allowlisted provider metadata before serialization', () => {
    expect(() =>
      serializeAutomaticSafetySmokeSuccess({
        ...validInput(),
        completionModel: 'response-sentinel\nprivate output',
      }),
    ).toThrow('provider metadata is invalid')
  })

  it('rejects a report that omits the declared retry attempt', () => {
    expect(() =>
      serializeAutomaticSafetySmokeSuccess({
        ...validInput(),
        embeddingCount: 7,
      }),
    ).toThrow('counts are invalid')
  })

  it.each(forbiddenSentinels)(
    'ignores a raw failure containing %s',
    (sentinel) => {
      const serialized = serializeAutomaticSafetySmokeFailure(
        'completion',
        new Error(`${sentinel}\nstack-trace-sentinel`),
      )
      expect(serialized).toBe('{"outcome":"failure","stage":"completion"}')
      expect(serialized).not.toContain(sentinel)
    },
  )
})

function validInput() {
  return {
    fixtureIdentifier: 'automatic-safety-scn-01-08-v1',
    testedCommitSha: 'a'.repeat(40),
    executedAt: '2026-08-02T12:00:00.000Z',
    qualificationMode: 'provider-boundary-only' as const,
    deterministicScenarioIds: AUTOMATIC_SCENARIO_IDS,
    liveCompletionScenarioIds: ['SCN-01', 'SCN-04', 'SCN-08'] as const,
    liveQueryEmbeddingScenarioIds: [
      'SCN-01',
      'SCN-02',
      'SCN-03',
      'SCN-04',
      'SCN-06',
      'SCN-07',
      'SCN-08',
    ] as const,
    completionProvider: 'aws-bedrock',
    completionModel: 'approved-model',
    promptVersion: 'grounded-completion-v1',
    embeddingProvider: 'gemini',
    embeddingModel: 'approved-embedding-model',
    embeddingProtocol: 'query-protocol-v1',
    fixtureHash: `sha256:${'b'.repeat(64)}`,
    completionCount: 3,
    embeddingCount: 8,
  } as const
}
