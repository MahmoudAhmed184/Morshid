import { GoogleGenAI, type GoogleGenAIOptions } from '@google/genai'

import {
  GeminiQuotaService,
  type GeminiQuotaCaps,
  type GeminiQuotaRedisClient,
} from '../gemini/gemini-quota.service'
import type {
  GeminiEmbeddingAdapterOptions,
  GeminiEmbeddingConfiguration,
  GeminiEmbeddingRequest,
} from './providers/gemini/gemini-embedding.adapter'
import {
  GEMINI_EMBEDDING_API_VERSION,
  GEMINI_EMBEDDING_QUOTA_NAMESPACE,
} from './providers/gemini/gemini-embedding.constants'

export interface GeminiEmbeddingRuntimeConfiguration {
  readonly apiKey: string
  readonly quotaProjectId: string
  readonly quotaCaps: GeminiQuotaCaps
  readonly redis: GeminiQuotaRedisClient
  readonly options: GeminiEmbeddingAdapterOptions
}

export interface GeminiEmbeddingSdk {
  readonly models: {
    embedContent(request: GeminiEmbeddingRequest): Promise<unknown>
  }
}

export type GeminiEmbeddingSdkFactory = (
  options: GoogleGenAIOptions,
) => GeminiEmbeddingSdk

const createDefaultSdk: GeminiEmbeddingSdkFactory = (options) =>
  new GoogleGenAI(options)

/**
 * Composes the live Gemini collaborator once for every application entrypoint.
 *
 * Runtime startup and the maintenance-mode migration command must use the same
 * SDK version/retry policy, quota namespace, identity, caps, and timeout
 * mapping. Keeping that wiring here prevents one path from silently drifting
 * into a different document profile protocol while both still report the same
 * `EmbeddingProvider.model`.
 */
export function composeGeminiEmbeddingConfiguration(
  configuration: GeminiEmbeddingRuntimeConfiguration,
  createSdk: GeminiEmbeddingSdkFactory = createDefaultSdk,
): GeminiEmbeddingConfiguration {
  const sdk = createSdk({
    apiKey: configuration.apiKey,
    httpOptions: {
      apiVersion: GEMINI_EMBEDDING_API_VERSION,
      // The adapter owns retry/deadline accounting. An SDK retry would issue a
      // request that the local quota guard did not admit.
      retryOptions: { attempts: 1 },
    },
  })
  const quota = new GeminiQuotaService(
    configuration.redis,
    configuration.quotaCaps,
    { project: configuration.quotaProjectId },
    GEMINI_EMBEDDING_QUOTA_NAMESPACE,
  )

  return {
    client: {
      embedContent: (request) => sdk.models.embedContent(request),
    },
    quota: {
      reserveGeneration: (estimatedInputUnits) =>
        quota.reserveGeneration(estimatedInputUnits),
    },
    options: configuration.options,
  }
}
