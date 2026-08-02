import type { AutomaticSafetyScenarioId } from './automatic-safety.fixtures'

export type AutomaticSafetySmokeStage =
  'configuration' | 'completion' | 'embedding' | 'validation'

export interface AutomaticSafetySmokeSuccessInput {
  readonly fixtureIdentifier: string
  readonly testedCommitSha: string
  readonly executedAt: string
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
  const executedAt = new Date(input.executedAt)
  if (
    !/^automatic-safety-[a-z0-9-]+-v\d+$/u.test(input.fixtureIdentifier) ||
    !/^[0-9a-f]{40}$/u.test(input.testedCommitSha) ||
    Number.isNaN(executedAt.valueOf()) ||
    executedAt.toISOString() !== input.executedAt ||
    input.scenarioIds.length !== 8 ||
    input.scenarioIds.some((id, index) => id !== `SCN-0${String(index + 1)}`)
  ) {
    throw new TypeError('Automatic safety smoke identity is invalid')
  }
  for (const identifier of [
    input.completionProvider,
    input.completionModel,
    input.promptVersion,
    input.embeddingProvider,
    input.embeddingModel,
    input.embeddingProtocol,
  ]) {
    if (!/^[a-z0-9][a-z0-9._:/-]{0,159}$/iu.test(identifier)) {
      throw new TypeError('Automatic safety smoke provider metadata is invalid')
    }
  }
  if (!/^sha256:[0-9a-f]{64}$/u.test(input.fixtureHash)) {
    throw new TypeError('Automatic safety smoke fixture hash is invalid')
  }
  if (
    !Number.isSafeInteger(input.completionCount) ||
    input.completionCount < 1 ||
    !Number.isSafeInteger(input.embeddingCount) ||
    input.embeddingCount < 1
  ) {
    throw new TypeError('Automatic safety smoke counts are invalid')
  }

  return JSON.stringify({
    outcome: 'success',
    fixtureIdentifier: input.fixtureIdentifier,
    testedCommitSha: input.testedCommitSha,
    executedAt: input.executedAt,
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
