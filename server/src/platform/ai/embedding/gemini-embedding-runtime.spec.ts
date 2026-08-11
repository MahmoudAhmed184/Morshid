import type { GoogleGenAIOptions } from '@google/genai'

import { createEmbeddingProvider } from './embedding-provider.factory'
import {
  composeGeminiEmbeddingConfiguration,
  type GeminiEmbeddingSdk,
} from './gemini-embedding-runtime'

describe('composeGeminiEmbeddingConfiguration', () => {
  it('pins the SDK version and retry policy for every composition root', () => {
    let observedOptions: GoogleGenAIOptions | undefined
    const sdk: GeminiEmbeddingSdk = {
      models: {
        embedContent: () => Promise.resolve({ embeddings: [] }),
      },
    }

    const gemini = composeGeminiEmbeddingConfiguration(
      {
        apiKey: 'gemini-embedding-test-key',
        quotaProjectId: 'embedding-project-01',
        quotaCaps: {
          requestsPerMinute: 10,
          inputTokensPerMinute: 100_000,
          requestsPerHour: 200,
          requestsPerDay: 500,
          requestsPerMonth: 5_000,
        },
        redis: {
          eval: () => Promise.resolve([]),
        },
        options: {
          queryTimeoutMs: 10_000,
          documentTimeoutMs: 120_000,
          requestTimeoutMs: 30_000,
        },
      },
      (options) => {
        observedOptions = options
        return sdk
      },
    )

    expect(observedOptions).toEqual({
      apiKey: 'gemini-embedding-test-key',
      httpOptions: {
        apiVersion: 'v1beta',
        retryOptions: { attempts: 1 },
      },
    })
    expect(createEmbeddingProvider('gemini', { gemini }).model).toBe(
      'gemini/gemini-embedding-2/1536/document-v1',
    )
  })
})
