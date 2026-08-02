import {
  serializeAutomaticSafetySmokeFailure,
  serializeAutomaticSafetySmokeSuccess,
} from './automatic-safety-smoke-report'

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
    const serialized = serializeAutomaticSafetySmokeSuccess({
      scenarioIds: ['SCN-01', 'SCN-08'],
      completionProvider: 'aws-bedrock',
      completionModel: 'approved-model',
      promptVersion: 'grounded-completion-v1',
      embeddingProvider: 'gemini',
      embeddingModel: 'approved-embedding-model',
      embeddingProtocol: 'query-protocol-v1',
      fixtureHash: 'sha256:fixture',
      completionCount: 2,
      embeddingCount: 2,
    })
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
        'fixtureHash',
        'outcome',
        'promptVersion',
        'scenarioIds',
      ].sort(),
    )
    for (const forbidden of forbiddenSentinels) {
      expect(serialized).not.toContain(forbidden)
    }
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
