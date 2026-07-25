import type { CompletionAdapter } from './completion-adapter'
import {
  AWS_BEDROCK_COMPLETION_PROVIDER,
  DETERMINISTIC_COMPLETION_PROVIDER,
  type AwsBedrockConfiguration,
  validateAwsBedrockConfiguration,
} from './completion-configuration'
import type { CompletionProvider } from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import { ItiBedrockGatewayAdapter } from './providers/aws-bedrock/iti-bedrock-gateway.adapter'
import { DeterministicCompletionAdapter } from './providers/deterministic/deterministic-completion.adapter'
import {
  MAX_COMPLETION_TIMEOUT_MS,
  ValidatedCompletionProvider,
  defaultCompletionTimeoutSignalFactory,
} from './validated-completion.provider'
import type { CompletionTimeoutSignalFactory } from './validated-completion.provider'

export type CompletionProviderConfiguration =
  | {
      readonly provider: typeof DETERMINISTIC_COMPLETION_PROVIDER
      readonly timeoutMs: number
    }
  | {
      readonly provider: typeof AWS_BEDROCK_COMPLETION_PROVIDER
      readonly timeoutMs: number
      readonly awsBedrock: AwsBedrockConfiguration
    }

export function createCompletionProvider(
  configuration: CompletionProviderConfiguration,
  timeoutSignalFactory: CompletionTimeoutSignalFactory = defaultCompletionTimeoutSignalFactory,
): CompletionProvider {
  const snapshot = snapshotFactoryConfiguration(configuration)
  let adapter: CompletionAdapter

  switch (snapshot.provider) {
    case DETERMINISTIC_COMPLETION_PROVIDER:
      adapter = new DeterministicCompletionAdapter()
      break
    case AWS_BEDROCK_COMPLETION_PROVIDER:
      adapter = new ItiBedrockGatewayAdapter(snapshot.awsBedrock)
      break
    default:
      assertNever(snapshot)
  }

  return new ValidatedCompletionProvider(
    adapter,
    snapshot.timeoutMs,
    timeoutSignalFactory,
  )
}

function snapshotFactoryConfiguration(
  configuration: unknown,
): CompletionProviderConfiguration {
  let provider: unknown
  let timeoutMs: unknown
  let awsBedrock: unknown

  try {
    if (typeof configuration !== 'object' || configuration === null) {
      throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
    }
    const record = configuration as Record<PropertyKey, unknown>
    provider = Reflect.get(record, 'provider')
    timeoutMs = Reflect.get(record, 'timeoutMs')
    if (provider === AWS_BEDROCK_COMPLETION_PROVIDER) {
      awsBedrock = Reflect.get(record, 'awsBedrock')
    }
  } catch (error) {
    if (error instanceof CompletionProviderError) {
      throw error
    }
    throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
  }

  if (
    provider !== DETERMINISTIC_COMPLETION_PROVIDER &&
    provider !== AWS_BEDROCK_COMPLETION_PROVIDER
  ) {
    throw new CompletionProviderError('COMPLETION_PROVIDER_UNSUPPORTED')
  }

  if (
    typeof timeoutMs !== 'number' ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > MAX_COMPLETION_TIMEOUT_MS
  ) {
    throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
  }

  if (provider === DETERMINISTIC_COMPLETION_PROVIDER) {
    return Object.freeze({ provider, timeoutMs })
  }

  // The gateway configuration is validated here rather than trusted, so the
  // declared return type is honest and the adapter receives a snapshot that has
  // already been checked and normalized.
  return Object.freeze({
    provider,
    timeoutMs,
    awsBedrock: validateAwsBedrockConfiguration(awsBedrock),
  })
}

function assertNever(value: never): never {
  void value
  throw new CompletionProviderError('COMPLETION_PROVIDER_UNSUPPORTED')
}
