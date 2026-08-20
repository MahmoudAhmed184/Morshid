import { discardResponseBody } from './bounded-response-body'
import {
  type GeminiChatProjectPoolPort,
  GeminiChatProjectPoolUnavailableError,
  isGeminiOpenAICompatibleBaseUrl,
} from './gemini-chat-project-pool'
import {
  STRUCTURED_CHAT_ERROR_CODE,
  type FetchImplementation,
  StructuredChatTransportError,
} from './structured-chat.transport'
import { readUpstreamFailure } from './upstream-retry-policy'

interface ResolvedChatTransport {
  readonly apiKey: string | null
  readonly fetchImplementation: FetchImplementation
}

const GEMINI_MODELS_WITHOUT_SAMPLING_PARAMETERS = new Set([
  'gemini-3.6-flash',
  'gemini-3.7-flash',
])

export function resolveChatTransport(
  baseUrl: string,
  roleApiKey: string,
  geminiPooledFetch: FetchImplementation | null,
  defaultFetch: FetchImplementation = globalThis.fetch,
): ResolvedChatTransport {
  if (!isGeminiOpenAICompatibleBaseUrl(baseUrl)) {
    return Object.freeze({
      apiKey: roleApiKey,
      fetchImplementation: defaultFetch,
    })
  }
  if (geminiPooledFetch === null) {
    throw new Error('Gemini chat project pool was not composed')
  }
  return Object.freeze({
    apiKey: null,
    fetchImplementation: geminiPooledFetch,
  })
}

export function createGeminiPooledFetch(
  pool: GeminiChatProjectPoolPort,
  fetchImplementation: FetchImplementation = globalThis.fetch,
  clock: () => number = Date.now,
): FetchImplementation {
  return async (input, init) => {
    const preparedInit = removeUnsupportedSamplingParameters(init)
    const attemptedProjectIds = new Set<string>()
    let retryAfterMs: number | undefined

    while (attemptedProjectIds.size < pool.size) {
      assertNotAborted(preparedInit?.signal)

      let selection
      try {
        selection = await pool.select(attemptedProjectIds)
      } catch (error) {
        throw mapPoolFailure(error)
      }
      assertNotAborted(preparedInit?.signal)

      if (selection.kind === 'exhausted') {
        return rateLimitedResponse(selection.retryAfterMs)
      }

      attemptedProjectIds.add(selection.project.id)
      const headers = new Headers(preparedInit?.headers)
      headers.set('Authorization', `Bearer ${selection.project.apiKey}`)

      const response = await fetchImplementation(input, {
        ...preparedInit,
        headers,
      })
      if (response.status !== 429) {
        return response
      }

      const failure = readUpstreamFailure(
        { status: response.status, headers: response.headers },
        clock(),
      )
      await discardResponseBody(response)

      let appliedCooldownMs: number
      try {
        appliedCooldownMs = await pool.markRateLimited(
          selection.project.id,
          failure.retryDelayMs,
        )
      } catch (error) {
        throw mapPoolFailure(error)
      }
      retryAfterMs =
        retryAfterMs === undefined
          ? appliedCooldownMs
          : Math.min(retryAfterMs, appliedCooldownMs)
    }

    return rateLimitedResponse(retryAfterMs ?? 1)
  }
}

function removeUnsupportedSamplingParameters(
  init: RequestInit | undefined,
): RequestInit | undefined {
  if (typeof init?.body !== 'string') {
    return init
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(init.body)
  } catch {
    return init
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    !GEMINI_MODELS_WITHOUT_SAMPLING_PARAMETERS.has(
      String(Reflect.get(parsed, 'model')),
    )
  ) {
    return init
  }

  const body = { ...parsed } as Record<string, unknown>
  delete body.temperature
  delete body.top_p

  return {
    ...init,
    body: JSON.stringify(body),
  }
}

function rateLimitedResponse(retryAfterMs: number): Response {
  return new Response(null, {
    status: 429,
    headers: { 'retry-after-ms': String(Math.max(1, retryAfterMs)) },
  })
}

function mapPoolFailure(error: unknown): StructuredChatTransportError {
  if (error instanceof GeminiChatProjectPoolUnavailableError) {
    return new StructuredChatTransportError(
      STRUCTURED_CHAT_ERROR_CODE.PROVIDER_UNAVAILABLE,
    )
  }
  return new StructuredChatTransportError(
    STRUCTURED_CHAT_ERROR_CODE.TRANSPORT_FAILURE,
  )
}

function assertNotAborted(signal: AbortSignal | null | undefined): void {
  if (signal?.aborted === true) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }
}
