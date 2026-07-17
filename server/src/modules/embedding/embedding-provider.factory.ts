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
  // The lookup goes through a partial view because the runtime value can
  // drift from the compile-time enum; an unknown provider must fail at
  // startup instead of at the first embedding call.
  const factories: Partial<Record<string, () => EmbeddingProvider>> =
    embeddingProviderFactories
  const createInnerProvider = factories[provider]

  if (createInnerProvider === undefined) {
    throw new UnsupportedEmbeddingProviderError(provider)
  }

  return new ValidatedEmbeddingProvider(createInnerProvider())
}
