import type { AppEnvironment } from '../config/env.schema'
import type { CompletionAdapter } from './completion-adapter'
import type { CompletionProvider } from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import { DeterministicCompletionProvider } from './deterministic-completion.provider'
import {
  StudentBedrockGatewayCompletionProvider,
  type StudentBedrockGatewayConfiguration,
} from './student-bedrock-gateway-completion.provider'
import {
  MAX_COMPLETION_TIMEOUT_MS,
  ValidatedCompletionProvider,
  defaultCompletionTimeoutSignalFactory,
} from './validated-completion.provider'
import type { CompletionTimeoutSignalFactory } from './validated-completion.provider'

// `satisfies` makes provider selection exhaustive over the validated env enum.
// Adding a configuration value without an adapter is therefore a type error.
const completionProviderFactories = {
  deterministic: (_configuration?: StudentBedrockGatewayConfiguration) =>
    new DeterministicCompletionProvider(),
  'student-bedrock-gateway': (
    configuration?: StudentBedrockGatewayConfiguration,
  ) => {
    if (configuration === undefined) {
      throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
    }
    return new StudentBedrockGatewayCompletionProvider(configuration)
  },
} satisfies Record<
  AppEnvironment['COMPLETION_PROVIDER'],
  (configuration?: StudentBedrockGatewayConfiguration) => CompletionAdapter
>

export function createCompletionProvider(
  provider: AppEnvironment['COMPLETION_PROVIDER'],
  timeoutMs: number,
  timeoutSignalFactory: CompletionTimeoutSignalFactory = defaultCompletionTimeoutSignalFactory,
  studentBedrockGatewayConfiguration?: StudentBedrockGatewayConfiguration,
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

  const runtimeTimeout: unknown = timeoutMs
  if (
    typeof runtimeTimeout !== 'number' ||
    !Number.isSafeInteger(runtimeTimeout) ||
    runtimeTimeout < 1 ||
    runtimeTimeout > MAX_COMPLETION_TIMEOUT_MS
  ) {
    throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
  }

  // Tests represent rejection and non-cooperation with adapters at the
  // internal seam instead of adding test modes to production code.
  const inner = completionProviderFactories[
    runtimeProvider as AppEnvironment['COMPLETION_PROVIDER']
  ](studentBedrockGatewayConfiguration)
  return new ValidatedCompletionProvider(
    inner,
    runtimeTimeout,
    timeoutSignalFactory,
  )
}
