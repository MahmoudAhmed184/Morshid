import type { AppEnvironment } from '../config/env.schema'
import {
  DETERMINISTIC_COMPLETION_MODEL,
  DeterministicCompletionProvider,
} from './deterministic-completion.provider'
import type { CompletionProvider } from './completion-provider'
import { UnsupportedCompletionProviderError } from './completion-errors'
import { ValidatedCompletionProvider } from './validated-completion.provider'

export interface CompletionProviderFactoryConfig {
  readonly provider: AppEnvironment['COMPLETION_PROVIDER']
  readonly model: string
}

const completionProviderFactories = {
  deterministic: (config: CompletionProviderFactoryConfig) =>
    new DeterministicCompletionProvider({
      model: config.model || DETERMINISTIC_COMPLETION_MODEL,
    }),
} satisfies Record<
  AppEnvironment['COMPLETION_PROVIDER'],
  (config: CompletionProviderFactoryConfig) => CompletionProvider
>

export function createCompletionProvider(
  config: CompletionProviderFactoryConfig,
): CompletionProvider {
  if (!Object.hasOwn(completionProviderFactories, config.provider)) {
    throw new UnsupportedCompletionProviderError(config.provider)
  }

  return new ValidatedCompletionProvider(
    completionProviderFactories[config.provider](config),
  )
}
