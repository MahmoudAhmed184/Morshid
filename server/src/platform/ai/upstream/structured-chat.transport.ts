import {
  discardResponseBody,
  readBoundedResponseBody,
  type BoundedResponseBodyRejection,
} from './bounded-response-body'

export const STRUCTURED_CHAT_ERROR_CODE = {
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
  RATE_LIMITED: 'rate_limited',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  HTTP_STATUS: 'http_status',
  TRANSPORT_FAILURE: 'transport_failure',
  MALFORMED_RESPONSE: 'malformed_response',
  OVERSIZED_RESPONSE: 'oversized_response',
} as const

export type StructuredChatErrorCode =
  (typeof STRUCTURED_CHAT_ERROR_CODE)[keyof typeof STRUCTURED_CHAT_ERROR_CODE]

export interface StructuredChatTransportMessage {
  readonly role: 'system' | 'user'
  readonly content: string
}

export interface StructuredChatTransportRequest {
  readonly endpoint: string
  readonly authorization: string | null
  readonly model: string
  readonly messages: readonly StructuredChatTransportMessage[]
  readonly temperature: number
  readonly topP: number
  readonly maxCompletionTokens: number
  readonly timeoutMs: number
  readonly maxResponseBytes: number
  readonly signal?: AbortSignal
}

export interface StructuredChatTransportResponse {
  readonly content: string
  readonly finishReason?: string
  readonly model?: string
  readonly systemFingerprint?: string
  readonly inputTokens?: number
  readonly outputTokens?: number
}

export interface StructuredChatTransportFailureMetadata {
  readonly status?: number
  readonly headers?: Headers
}

export class StructuredChatTransportError extends Error {
  readonly code: StructuredChatErrorCode
  readonly status: number | undefined
  readonly headers: Headers | undefined

  constructor(
    code: StructuredChatErrorCode,
    metadata: StructuredChatTransportFailureMetadata = {},
  ) {
    super('Structured chat transport failed')
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'StructuredChatTransportError',
    })
    this.code = code
    this.status = metadata.status
    this.headers = metadata.headers
  }
}

export type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export type StructuredChatTimeoutSignalFactory = (
  timeoutMs: number,
) => AbortSignal

/**
 * The only implementation of the OpenAI-compatible chat-completions wire
 * contract. Domain adapters keep their own ports and response vocabularies;
 * this module owns request limits, per-call deadlines, bounded body reads,
 * parsing, and retry metadata.
 */
export class StructuredChatTransport {
  constructor(
    private readonly fetchImplementation: FetchImplementation = globalThis.fetch,
    private readonly timeoutSignalFactory: StructuredChatTimeoutSignalFactory = (
      timeoutMs,
    ) => AbortSignal.timeout(timeoutMs),
  ) {}

  async complete(
    request: StructuredChatTransportRequest,
  ): Promise<StructuredChatTransportResponse> {
    assertStructuredChatRequest(request)

    let timeoutSignal: AbortSignal
    try {
      timeoutSignal = this.timeoutSignalFactory(request.timeoutMs)
      if (!(timeoutSignal instanceof AbortSignal)) {
        throw new TypeError('Invalid timeout signal')
      }
    } catch {
      throw new StructuredChatTransportError(
        STRUCTURED_CHAT_ERROR_CODE.PROVIDER_UNAVAILABLE,
      )
    }
    const signal =
      request.signal === undefined
        ? timeoutSignal
        : AbortSignal.any([request.signal, timeoutSignal])

    try {
      const response = await awaitWithSignal(
        () =>
          this.fetchImplementation(request.endpoint, {
            method: 'POST',
            headers: requestHeaders(request.authorization),
            body: JSON.stringify({
              model: request.model,
              messages: request.messages,
              temperature: request.temperature,
              top_p: request.topP,
              max_completion_tokens: request.maxCompletionTokens,
              response_format: { type: 'json_object' },
            }),
            redirect: 'error',
            signal,
          }),
        signal,
        () =>
          new StructuredChatTransportError(
            timeoutSignal.aborted
              ? STRUCTURED_CHAT_ERROR_CODE.TIMEOUT
              : STRUCTURED_CHAT_ERROR_CODE.CANCELLED,
          ),
      )

      if (!response.ok) {
        await discardResponseBody(response)
        throw httpStatusFailure(response)
      }

      const responseBody = await readBoundedResponseBody(
        response,
        request.maxResponseBytes,
        structuredChatBodyFailure,
      )
      return parseChatCompletionResponse(responseBody)
    } catch (error) {
      if (error instanceof StructuredChatTransportError) {
        throw error
      }
      if (timeoutSignal.aborted) {
        throw new StructuredChatTransportError(
          STRUCTURED_CHAT_ERROR_CODE.TIMEOUT,
        )
      }
      if (request.signal?.aborted === true) {
        throw new StructuredChatTransportError(
          STRUCTURED_CHAT_ERROR_CODE.CANCELLED,
        )
      }
      throw new StructuredChatTransportError(
        STRUCTURED_CHAT_ERROR_CODE.TRANSPORT_FAILURE,
      )
    }
  }
}

function assertStructuredChatRequest(
  request: StructuredChatTransportRequest,
): void {
  if (
    request.endpoint.trim() === '' ||
    request.model.trim() === '' ||
    request.messages.length === 0 ||
    !Number.isFinite(request.temperature) ||
    !Number.isFinite(request.topP) ||
    !Number.isSafeInteger(request.maxCompletionTokens) ||
    request.maxCompletionTokens < 1 ||
    !Number.isSafeInteger(request.timeoutMs) ||
    request.timeoutMs < 1 ||
    !Number.isSafeInteger(request.maxResponseBytes) ||
    request.maxResponseBytes < 1
  ) {
    throw new TypeError('Invalid structured chat transport request')
  }
}

function requestHeaders(authorization: string | null): HeadersInit {
  return authorization === null
    ? {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }
    : {
        Accept: 'application/json',
        Authorization: authorization,
        'Content-Type': 'application/json',
      }
}

function httpStatusFailure(response: Response): StructuredChatTransportError {
  const code =
    response.status === 429
      ? STRUCTURED_CHAT_ERROR_CODE.RATE_LIMITED
      : response.status === 502 ||
          response.status === 503 ||
          response.status === 504
        ? STRUCTURED_CHAT_ERROR_CODE.PROVIDER_UNAVAILABLE
        : STRUCTURED_CHAT_ERROR_CODE.HTTP_STATUS

  return new StructuredChatTransportError(code, {
    status: response.status,
    headers: response.headers,
  })
}

function structuredChatBodyFailure(
  rejection: BoundedResponseBodyRejection,
): StructuredChatTransportError {
  return new StructuredChatTransportError(
    rejection === 'oversized_body'
      ? STRUCTURED_CHAT_ERROR_CODE.OVERSIZED_RESPONSE
      : STRUCTURED_CHAT_ERROR_CODE.MALFORMED_RESPONSE,
  )
}

function parseChatCompletionResponse(
  body: string,
): StructuredChatTransportResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new StructuredChatTransportError(
      STRUCTURED_CHAT_ERROR_CODE.MALFORMED_RESPONSE,
    )
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new StructuredChatTransportError(
      STRUCTURED_CHAT_ERROR_CODE.MALFORMED_RESPONSE,
    )
  }

  const choices: unknown = Reflect.get(parsed, 'choices')
  const firstChoice: unknown = Array.isArray(choices) ? choices[0] : undefined
  const finishReason: unknown =
    typeof firstChoice === 'object' && firstChoice !== null
      ? Reflect.get(firstChoice, 'finish_reason')
      : undefined
  const message: unknown =
    typeof firstChoice === 'object' && firstChoice !== null
      ? Reflect.get(firstChoice, 'message')
      : undefined
  const content: unknown =
    typeof message === 'object' && message !== null
      ? Reflect.get(message, 'content')
      : undefined

  if (typeof content !== 'string' || content.trim() === '') {
    throw new StructuredChatTransportError(
      STRUCTURED_CHAT_ERROR_CODE.MALFORMED_RESPONSE,
    )
  }

  const usage: unknown = Reflect.get(parsed, 'usage')
  return Object.freeze({
    content,
    ...optionalMetadata('finishReason', finishReason),
    ...optionalMetadata('model', Reflect.get(parsed, 'model')),
    ...optionalMetadata(
      'systemFingerprint',
      Reflect.get(parsed, 'system_fingerprint'),
    ),
    ...optionalTokenMetadata('inputTokens', usage, 'prompt_tokens'),
    ...optionalTokenMetadata('outputTokens', usage, 'completion_tokens'),
  })
}

function optionalMetadata(
  key: 'finishReason' | 'model' | 'systemFingerprint',
  value: unknown,
): Partial<Pick<StructuredChatTransportResponse, typeof key>> {
  return typeof value === 'string' && value.trim() !== ''
    ? { [key]: value }
    : {}
}

function optionalTokenMetadata(
  key: 'inputTokens' | 'outputTokens',
  usage: unknown,
  usageKey: 'prompt_tokens' | 'completion_tokens',
): Partial<Pick<StructuredChatTransportResponse, typeof key>> {
  const value: unknown =
    typeof usage === 'object' && usage !== null
      ? (Reflect.get(usage, usageKey) as unknown)
      : undefined
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? { [key]: value }
    : {}
}

function awaitWithSignal<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
  createAbortError: () => Error,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false

    const finish = (settle: () => void) => {
      if (settled) {
        return
      }
      settled = true
      signal.removeEventListener('abort', onAbort)
      settle()
    }

    const onAbort = () => {
      finish(() => {
        reject(createAbortError())
      })
    }

    if (signal.aborted) {
      onAbort()
      return
    }

    signal.addEventListener('abort', onAbort, { once: true })
    void Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          finish(() => {
            resolve(value)
          })
        },
        (error: unknown) => {
          finish(() => {
            reject(
              error instanceof Error ? error : new Error('Transport failed'),
            )
          })
        },
      )
  })
}
