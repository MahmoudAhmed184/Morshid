import type { AutomaticSafetyScenarioId } from './automatic-safety.fixtures'

export type AutomaticSafetySmokeStage =
  'configuration' | 'completion' | 'embedding' | 'validation'

export interface AutomaticSafetySmokeSuccessInput {
  readonly scenarioIds: readonly AutomaticSafetyScenarioId[]
  readonly completionProvider: string
  readonly completionModel: string
  readonly promptVersion: string
  readonly embeddingProvider: string
  readonly embeddingModel: string
  readonly embeddingProtocol: string
  readonly fixtureHash: string
  readonly completionCount: number
  readonly embeddingCount: number
}

export function serializeAutomaticSafetySmokeSuccess(
  input: AutomaticSafetySmokeSuccessInput,
): string {
  return JSON.stringify({
    outcome: 'success',
    scenarioIds: input.scenarioIds,
    completionProvider: input.completionProvider,
    completionModel: input.completionModel,
    promptVersion: input.promptVersion,
    embeddingProvider: input.embeddingProvider,
    embeddingModel: input.embeddingModel,
    embeddingProtocol: input.embeddingProtocol,
    fixtureHash: input.fixtureHash,
    completionCount: input.completionCount,
    embeddingCount: input.embeddingCount,
  })
}

export function serializeAutomaticSafetySmokeFailure(
  stage: AutomaticSafetySmokeStage,
  _error: unknown,
): string {
  return JSON.stringify({ outcome: 'failure', stage })
}
