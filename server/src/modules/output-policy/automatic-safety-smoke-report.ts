import type { AutomaticSafetyScenarioId } from './automatic-safety.fixtures'

export type AutomaticSafetySmokeStage =
  'configuration' | 'completion' | 'embedding' | 'validation'

export interface AutomaticSafetySmokeSuccessInput {
  readonly fixtureIdentifier: string
  readonly testedCommitSha: string
  readonly executedAt: string
  readonly qualificationMode: 'provider-boundary-only'
  readonly deterministicScenarioIds: readonly AutomaticSafetyScenarioId[]
  readonly liveCompletionScenarioIds: readonly AutomaticSafetyScenarioId[]
  readonly liveQueryEmbeddingScenarioIds: readonly AutomaticSafetyScenarioId[]
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
    !isCompleteScenarioMatrix(input.deterministicScenarioIds) ||
    !isOrderedScenarioSubset(input.liveCompletionScenarioIds) ||
    input.liveCompletionScenarioIds.length === 0 ||
    !isOrderedScenarioSubset(input.liveQueryEmbeddingScenarioIds) ||
    input.liveQueryEmbeddingScenarioIds.length === 0
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
    input.completionCount !==
      expectedAttemptCount(input.liveCompletionScenarioIds) ||
    input.embeddingCount !==
      expectedAttemptCount(input.liveQueryEmbeddingScenarioIds)
  ) {
    throw new TypeError('Automatic safety smoke counts are invalid')
  }

  return JSON.stringify({
    outcome: 'success',
    fixtureIdentifier: input.fixtureIdentifier,
    testedCommitSha: input.testedCommitSha,
    executedAt: input.executedAt,
    qualificationMode: input.qualificationMode,
    deterministicScenarioIds: input.deterministicScenarioIds,
    liveCompletionScenarioIds: input.liveCompletionScenarioIds,
    liveQueryEmbeddingScenarioIds: input.liveQueryEmbeddingScenarioIds,
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

const ALL_SCENARIO_IDS = [
  'SCN-01',
  'SCN-02',
  'SCN-03',
  'SCN-04',
  'SCN-05',
  'SCN-06',
  'SCN-07',
  'SCN-08',
] as const satisfies readonly AutomaticSafetyScenarioId[]

function isCompleteScenarioMatrix(
  ids: readonly AutomaticSafetyScenarioId[],
): boolean {
  return (
    ids.length === ALL_SCENARIO_IDS.length &&
    ids.every((id, index) => id === ALL_SCENARIO_IDS[index])
  )
}

function isOrderedScenarioSubset(
  ids: readonly AutomaticSafetyScenarioId[],
): boolean {
  let previousIndex = -1
  for (const id of ids) {
    const index = ALL_SCENARIO_IDS.indexOf(id)
    if (index <= previousIndex) return false
    previousIndex = index
  }
  return true
}

function expectedAttemptCount(
  ids: readonly AutomaticSafetyScenarioId[],
): number {
  return ids.reduce((count, id) => count + (id === 'SCN-07' ? 2 : 1), 0)
}

export function serializeAutomaticSafetySmokeFailure(
  stage: AutomaticSafetySmokeStage,
  _error: unknown,
): string {
  return JSON.stringify({ outcome: 'failure', stage })
}
