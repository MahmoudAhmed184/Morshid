import type { AppEnvironment } from '../config/env.schema'
import type { CompletionProvider } from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import { DeterministicCompletionProvider } from './deterministic-completion.provider'
import {
  ValidatedCompletionProvider,
  defaultCompletionTimeoutSignalFactory,
} from './validated-completion.provider'
import type { CompletionTimeoutSignalFactory } from './validated-completion.provider'

// `satisfies` makes provider selection exhaustive over the validated env enum.
// Adding a configuration value without an adapter is therefore a type error.
const completionProviderFactories = {
  deterministic: () => new DeterministicCompletionProvider(),
} satisfies Record<
  AppEnvironment['COMPLETION_PROVIDER'],
  () => CompletionProvider
>

export function createCompletionProvider(
  provider: AppEnvironment['COMPLETION_PROVIDER'],
  timeoutMs: number,
  timeoutSignalFactory: CompletionTimeoutSignalFactory = defaultCompletionTimeoutSignalFactory,
): CompletionProvider {
  // Startup validation is the first guard; this runtime check remains because
  // JavaScript callers and deployment tooling can still violate static types.
  const runtimeProvider: unknown = provider
  if (
    typeof runtimeProvider !== 'string' ||
    !Object.hasOwn(completionProviderFactories, runtimeProvider)
  ) {
    throw new CompletionProviderError('COMPLETION_PROVIDER_UNSUPPORTED')
  }

  // The production selection always constructs the adapter in normal mode.
  // Controlled failure and wait modes are reachable only by explicitly
  // constructing DeterministicCompletionProvider in a test.
  const inner =
    completionProviderFactories[
      runtimeProvider as AppEnvironment['COMPLETION_PROVIDER']
    ]()
  return new ValidatedCompletionProvider(inner, timeoutMs, timeoutSignalFactory)
}
