import type { AppEnvironment } from '../config/env.schema'
import { DeterministicEmbeddingProvider } from './deterministic-embedding.provider'
import {
  DETERMINISTIC_EMBEDDING_PROVIDER,
  GEMINI_EMBEDDING_PROVIDER,
  type EmbeddingConfiguration,
  validateGeminiEmbeddingConfiguration,
} from './embedding-configuration'
import type { EmbeddingProvider } from './embedding-provider'
import { UnsupportedEmbeddingProviderError } from './embedding-provider'
import { GeminiEmbeddingAdapter } from './providers/gemini/gemini-embedding.adapter'
import { ValidatedEmbeddingProvider } from './validated-embedding.provider'

/**
 * Collaborators the composition root owns, keyed by the provider that needs
 * them.
 *
 * Gemini cannot be described by plain environment data — its quota guard is
 * Redis-backed and its client is a network object — so the module constructs
 * those and hands them in already built. The factory still validates their
 * shape, which keeps every seam injectable without the factory reaching for
 * Redis itself.
 */
export interface EmbeddingProviderCollaborators {
  readonly gemini?: unknown
}

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
  collaborators: EmbeddingProviderCollaborators = {},
): EmbeddingConfiguration {
  // Widened deliberately: the runtime value can drift from the compile-time
  // enum, and an unknown provider must fail at startup rather than reach an
  // adapter as `undefined`.
  const provider: string = environment.EMBEDDING_PROVIDER

  switch (provider) {
    case DETERMINISTIC_EMBEDDING_PROVIDER:
      return { provider: DETERMINISTIC_EMBEDDING_PROVIDER }
    case GEMINI_EMBEDDING_PROVIDER:
      return {
        provider: GEMINI_EMBEDDING_PROVIDER,
        gemini: validateGeminiEmbeddingConfiguration(collaborators.gemini),
      }
    default:
      throw new UnsupportedEmbeddingProviderError(provider)
  }
}

/**
 * Builds the configured provider, always wrapped so results are contract-checked
 * before any persistence or query use.
 *
 * Every adapter validates its configuration again in its own constructor: the
 * factory is not the only construction path, and a collaborator reaching an
 * adapter unvalidated is exactly the failure this pair of checks exists for.
 */
export function createEmbeddingProviderFrom(
  configuration: EmbeddingConfiguration,
): EmbeddingProvider {
  switch (configuration.provider) {
    case DETERMINISTIC_EMBEDDING_PROVIDER:
      return new ValidatedEmbeddingProvider(
        new DeterministicEmbeddingProvider(),
      )
    case GEMINI_EMBEDDING_PROVIDER:
      return new ValidatedEmbeddingProvider(
        new GeminiEmbeddingAdapter(configuration.gemini),
      )
    default:
      return assertNever(configuration)
  }
}

export function createEmbeddingProvider(
  provider: AppEnvironment['EMBEDDING_PROVIDER'],
  collaborators: EmbeddingProviderCollaborators = {},
): EmbeddingProvider {
  return createEmbeddingProviderFrom(
    snapshotEmbeddingConfiguration(
      { EMBEDDING_PROVIDER: provider },
      collaborators,
    ),
  )
}

// Local, mirroring the completion factory: the exhaustiveness guard has to
// raise this module's own error, not another module's.
function assertNever(value: never): never {
  void value
  throw new UnsupportedEmbeddingProviderError('unreachable')
}
