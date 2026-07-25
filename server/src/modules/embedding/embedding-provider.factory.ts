import type { AppEnvironment } from '../config/env.schema'
import { DeterministicEmbeddingProvider } from './deterministic-embedding.provider'
import {
  DETERMINISTIC_EMBEDDING_PROVIDER,
  type EmbeddingConfiguration,
} from './embedding-configuration'
import type { EmbeddingProvider } from './embedding-provider'
import { UnsupportedEmbeddingProviderError } from './embedding-provider'
import { ValidatedEmbeddingProvider } from './validated-embedding.provider'

/**
 * Reads the configuration for the selected provider out of an untrusted record.
 *
 * Reflective rather than typed destructuring for the same reason the completion
 * factory is: the environment is validated at startup, but the factory is also
 * reachable from scripts and tests that construct a configuration by hand, and
 * a missing field must fail here rather than reach an adapter as `undefined`.
 */
export function snapshotEmbeddingConfiguration(
  environment: Pick<AppEnvironment, 'EMBEDDING_PROVIDER'>,
): EmbeddingConfiguration {
  // Widened deliberately: the runtime value can drift from the compile-time
  // enum, and an unknown provider must fail at startup rather than reach an
  // adapter as `undefined`.
  const provider: string = environment.EMBEDDING_PROVIDER

  switch (provider) {
    case DETERMINISTIC_EMBEDDING_PROVIDER:
      return { provider: DETERMINISTIC_EMBEDDING_PROVIDER }
    default:
      throw new UnsupportedEmbeddingProviderError(provider)
  }
}

/**
 * Builds the configured provider, always wrapped so results are contract-checked
 * before any persistence or query use.
 */
// `satisfies` keeps this map exhaustive over the configuration union: adding a
// provider to the union without a wired implementation fails to compile.
const embeddingAdapterFactories = {
  [DETERMINISTIC_EMBEDDING_PROVIDER]: () =>
    new DeterministicEmbeddingProvider(),
} satisfies Record<EmbeddingConfiguration['provider'], () => EmbeddingProvider>

/**
 * Builds the configured provider, always wrapped so results are contract-checked
 * before any persistence or query use.
 */
export function createEmbeddingProviderFrom(
  configuration: EmbeddingConfiguration,
): EmbeddingProvider {
  return new ValidatedEmbeddingProvider(
    embeddingAdapterFactories[configuration.provider](),
  )
}

export function createEmbeddingProvider(
  provider: AppEnvironment['EMBEDDING_PROVIDER'],
): EmbeddingProvider {
  return createEmbeddingProviderFrom(
    snapshotEmbeddingConfiguration({ EMBEDDING_PROVIDER: provider }),
  )
}
