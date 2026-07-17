import type { AppEnvironment } from '../config/env.schema'
import { DeterministicEmbeddingProvider } from './deterministic-embedding.provider'
import type { EmbeddingProvider } from './embedding-provider'
import { UnsupportedEmbeddingProviderError } from './embedding-provider'
import { ValidatedEmbeddingProvider } from './validated-embedding.provider'

// `satisfies` keeps this map exhaustive over the env schema's provider enum:
// adding an enum value without a wired implementation fails to compile.
const embeddingProviderFactories = {
  deterministic: () => new DeterministicEmbeddingProvider(),
} satisfies Record<
  AppEnvironment['EMBEDDING_PROVIDER'],
  () => EmbeddingProvider
>

// Every selected provider is wrapped in ValidatedEmbeddingProvider so results
// are contract-checked before any persistence or query use.
export function createEmbeddingProvider(
  provider: AppEnvironment['EMBEDDING_PROVIDER'],
): EmbeddingProvider {
  // The runtime value can drift from the compile-time enum, and an unknown
  // provider must fail at startup instead of at the first embedding call.
  // Object.hasOwn keeps prototype members (e.g. `constructor`) from
  // satisfying the lookup.
  if (!Object.hasOwn(embeddingProviderFactories, provider)) {
    throw new UnsupportedEmbeddingProviderError(provider)
  }

  return new ValidatedEmbeddingProvider(embeddingProviderFactories[provider]())
}
