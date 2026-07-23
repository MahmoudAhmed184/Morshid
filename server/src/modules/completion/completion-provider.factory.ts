import type { AppEnvironment } from '../config/env.schema'
import type { CompletionAdapter } from './completion-adapter'
import type { CompletionProvider } from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import { DeterministicCompletionProvider } from './deterministic-completion.provider'
import {
  MAX_COMPLETION_TIMEOUT_MS,
  ValidatedCompletionProvider,
  defaultCompletionTimeoutSignalFactory,
} from './validated-completion.provider'
import type { CompletionTimeoutSignalFactory } from './validated-completion.provider'

export interface CompletionAdapterFactories {
  readonly deterministic?: () => CompletionAdapter
  readonly gemini?: () => CompletionAdapter
}

const SUPPORTED_COMPLETION_PROVIDERS = {
  deterministic: true,
  gemini: true,
} satisfies Record<AppEnvironment['COMPLETION_PROVIDER'], true>

export function createCompletionProvider(
  provider: AppEnvironment['COMPLETION_PROVIDER'],
  timeoutMs: number,
  timeoutSignalFactory: CompletionTimeoutSignalFactory = defaultCompletionTimeoutSignalFactory,
  adapterFactories: CompletionAdapterFactories = {},
): CompletionProvider {
  // Startup validation is the first guard; this runtime check remains because
  // JavaScript callers and deployment tooling can still violate static types.
  const runtimeProvider: unknown = provider
  if (
    typeof runtimeProvider !== 'string' ||
    !Object.hasOwn(SUPPORTED_COMPLETION_PROVIDERS, runtimeProvider)
  ) {
    throw new CompletionProviderError('COMPLETION_PROVIDER_UNSUPPORTED')
  }

  const runtimeTimeout: unknown = timeoutMs
  if (
    typeof runtimeTimeout !== 'number' ||
    !Number.isSafeInteger(runtimeTimeout) ||
    runtimeTimeout < 1 ||
    runtimeTimeout > MAX_COMPLETION_TIMEOUT_MS
  ) {
    throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
  }

  const adapterFactory =
    runtimeProvider === 'deterministic'
      ? (adapterFactories.deterministic ??
        (() => new DeterministicCompletionProvider()))
      : adapterFactories.gemini
  if (adapterFactory === undefined) {
    throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
  }

  let inner: CompletionAdapter
  try {
    inner = adapterFactory()
  } catch {
    throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
  }
  return new ValidatedCompletionProvider(
    inner,
    runtimeTimeout,
    timeoutSignalFactory,
  )
}
