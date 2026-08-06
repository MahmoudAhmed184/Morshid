import { Logger } from '@nestjs/common'

import {
  discardResponseBody,
  readBoundedResponseBody,
  type BoundedResponseBodyRejection,
} from '../../common/upstream/bounded-response-body'
import {
  hasAtMostCodePoints,
  readAbortSignalAborted,
} from '../completion/completion-input'
import {
  DETERMINISTIC_SEMANTIC_GUARD_PROVIDER,
  OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
  type OpenAICompatibleSemanticGuardConfiguration,
  type SemanticGuardConfiguration,
  validateOpenAICompatibleSemanticGuardConfiguration,
  validateSemanticGuardConfiguration,
} from './semantic-guard.configuration'
import {
  SEMANTIC_GUARD_ERROR_CODE,
  SEMANTIC_GUARD_PROMPT_VERSION,
  SemanticGuardModelError,
  type SemanticGuardModelResponse,
  type SemanticGuardPort,
  type SemanticGuardRequest,
} from './semantic-guard.types'

const MAX_GUARD_PROVIDER_LENGTH = 80
const MAX_GUARD_MODEL_LENGTH = 200
const MAX_GUARD_RESPONSE_BYTES = 512 * 1_024
const STRUCTURED_OUTPUT_TEMPERATURE = 0
const STRUCTURED_OUTPUT_TOP_P = 1

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

type GuardTimeoutSignalFactory = (timeoutMs: number) => AbortSignal

const defaultGuardTimeoutSignalFactory: GuardTimeoutSignalFactory = (
  timeoutMs,
) => AbortSignal.timeout(timeoutMs)

export function createSemanticGuardPort(
  configuration: SemanticGuardConfiguration,
  timeoutSignalFactory: GuardTimeoutSignalFactory = defaultGuardTimeoutSignalFactory,
): SemanticGuardPort {
  const snapshot = validateSemanticGuardConfiguration(configuration)
  const adapter =
    snapshot.provider === DETERMINISTIC_SEMANTIC_GUARD_PROVIDER
      ? new DeterministicSemanticGuardAdapter()
      : new OpenAICompatibleSemanticGuardAdapter(snapshot.openAICompatible)

  return new ValidatedSemanticGuardPort(
    adapter,
    snapshot.timeoutMs,
    timeoutSignalFactory,
  )
}

export class ValidatedSemanticGuardPort implements SemanticGuardPort {
  constructor(
    private readonly inner: SemanticGuardPort,
    private readonly timeoutMs: number,
    private readonly timeoutSignalFactory: GuardTimeoutSignalFactory = defaultGuardTimeoutSignalFactory,
  ) {}

  async evaluate(
    request: SemanticGuardRequest,
  ): Promise<SemanticGuardModelResponse> {
    assertSemanticGuardRequest(request)
    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.CANCELLED)
    }

    let timeoutSignal: AbortSignal
    try {
      timeoutSignal = this.timeoutSignalFactory(this.timeoutMs)
      if (!(timeoutSignal instanceof AbortSignal)) {
        throw new TypeError('Invalid timeout signal')
      }
    } catch {
      throw new SemanticGuardModelError(
        SEMANTIC_GUARD_ERROR_CODE.PROVIDER_UNAVAILABLE,
      )
    }

    const signal =
      request.signal === undefined
        ? timeoutSignal
        : AbortSignal.any([request.signal, timeoutSignal])
    const startedAt = Date.now()

    try {
      const response = await this.inner.evaluate({ ...request, signal })
      if (readAbortSignalAborted(timeoutSignal)) {
        throw new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.TIMEOUT)
      }
      return validateSemanticGuardResponse({
        ...response,
        latencyMs: response.latencyMs ?? Date.now() - startedAt,
      })
    } catch (error) {
      if (readAbortSignalAborted(timeoutSignal)) {
        throw new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.TIMEOUT)
      }
      if (
        request.signal !== undefined &&
        readAbortSignalAborted(request.signal)
      ) {
        throw new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.CANCELLED)
      }
      throw normalizeSemanticGuardError(error)
    }
  }
}

export class DeterministicSemanticGuardAdapter implements SemanticGuardPort {
  evaluate(request: SemanticGuardRequest): Promise<SemanticGuardModelResponse> {
    assertSemanticGuardRequest(request)
    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.CANCELLED)
    }

    const content = request.messages[1].content
    const approved =
      !/\b(?:final answer|the answer is|complete solution|submission-ready)\b/iu.test(
        content,
      )

    return Promise.resolve(
      Object.freeze({
        rawOutput: approved
          ? Object.freeze({ approved: true, violations: Object.freeze([]) })
          : Object.freeze({
              approved: false,
              violations: Object.freeze([
                Object.freeze({
                  type: 'SEMANTIC_POLICY_VIOLATION',
                  severity: 'HIGH',
                  field: 'message',
                  evidence:
                    'Candidate appears semantically too direct for the guard policy.',
                  regenerationInstruction:
                    'Remove direct answer disclosure and ask for one student reasoning step.',
                }),
              ]),
            }),
        provider: DETERMINISTIC_SEMANTIC_GUARD_PROVIDER,
        model: 'deterministic-semantic-guard-v1',
        promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
      }),
    )
  }
}

export class OpenAICompatibleSemanticGuardAdapter implements SemanticGuardPort {
  private readonly logger = new Logger(
    OpenAICompatibleSemanticGuardAdapter.name,
  )
  private readonly endpoint: string
  private readonly modelName: string
  private readonly authorization: string | null

  constructor(
    configuration: OpenAICompatibleSemanticGuardConfiguration,
    private readonly fetchImplementation: FetchImplementation = globalThis.fetch,
  ) {
    const snapshot =
      validateOpenAICompatibleSemanticGuardConfiguration(configuration)
    this.endpoint = snapshot.endpoint
    this.modelName = snapshot.modelName
    this.authorization =
      snapshot.apiKey === null ? null : `Bearer ${snapshot.apiKey}`
  }

  async evaluate(
    request: SemanticGuardRequest,
  ): Promise<SemanticGuardModelResponse> {
    assertSemanticGuardRequest(request)
    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.CANCELLED)
    }

    try {
      const response = await this.fetchImplementation(this.endpoint, {
        method: 'POST',
        headers: requestHeaders(this.authorization),
        body: JSON.stringify({
          model: this.modelName,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          temperature: STRUCTURED_OUTPUT_TEMPERATURE,
          top_p: STRUCTURED_OUTPUT_TOP_P,
          response_format: { type: 'json_object' },
        }),
        redirect: 'error',
        signal: request.signal,
      })

      if (!response.ok) {
        await discardResponseBody(response)
        throw httpStatusFailure(response.status)
      }

      const responseBody = await readBoundedResponseBody(
        response,
        MAX_GUARD_RESPONSE_BYTES,
        toProviderFailure,
      )
      const parsed = parseChatCompletionResponse(responseBody)

      return Object.freeze({
        rawOutput: parseStructuredOutput(parsed.content),
        provider: OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
        model: parsed.model ?? this.modelName,
        promptVersion: request.promptVersion,
        ...(parsed.inputTokens === undefined
          ? {}
          : { inputTokens: parsed.inputTokens }),
        ...(parsed.outputTokens === undefined
          ? {}
          : { outputTokens: parsed.outputTokens }),
      })
    } catch (error) {
      this.logger.warn({
        event: 'semantic_guard_provider_failed',
        errorClass: error instanceof Error ? error.name : 'UnknownError',
      })
      throw normalizeSemanticGuardError(error)
    }
  }
}

function assertSemanticGuardRequest(
  request: unknown,
): asserts request is SemanticGuardRequest {
  if (
    typeof request !== 'object' ||
    request === null ||
    Array.isArray(request)
  ) {
    throw new SemanticGuardModelError(
      SEMANTIC_GUARD_ERROR_CODE.UNSUPPORTED_RESPONSE,
    )
  }

  const promptVersion: unknown = Reflect.get(request, 'promptVersion')
  const responseSchemaName: unknown = Reflect.get(request, 'responseSchemaName')
  const messages: unknown = Reflect.get(request, 'messages')
  if (
    promptVersion !== SEMANTIC_GUARD_PROMPT_VERSION ||
    responseSchemaName !== 'SemanticGuardResult' ||
    !Array.isArray(messages) ||
    messages.length !== 2 ||
    !isGuardMessage(messages[0], 'system') ||
    !isGuardMessage(messages[1], 'user')
  ) {
    throw new SemanticGuardModelError(
      SEMANTIC_GUARD_ERROR_CODE.UNSUPPORTED_RESPONSE,
    )
  }
}

function isGuardMessage(value: unknown, role: 'system' | 'user'): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  return (
    Reflect.get(value, 'role') === role &&
    typeof Reflect.get(value, 'content') === 'string' &&
    (Reflect.get(value, 'content') as string).trim() !== ''
  )
}

function validateSemanticGuardResponse(
  response: SemanticGuardModelResponse,
): SemanticGuardModelResponse {
  if (
    !isBoundedMetadata(response.provider, MAX_GUARD_PROVIDER_LENGTH) ||
    !isBoundedMetadata(response.model, MAX_GUARD_MODEL_LENGTH) ||
    !isOptionalTokenCount(response.inputTokens) ||
    !isOptionalTokenCount(response.outputTokens) ||
    !isOptionalLatency(response.latencyMs)
  ) {
    throw new SemanticGuardModelError(
      SEMANTIC_GUARD_ERROR_CODE.UNSUPPORTED_RESPONSE,
    )
  }

  return Object.freeze({
    rawOutput: response.rawOutput,
    provider: response.provider,
    model: response.model,
    promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
    ...(response.inputTokens === undefined
      ? {}
      : { inputTokens: response.inputTokens }),
    ...(response.outputTokens === undefined
      ? {}
      : { outputTokens: response.outputTokens }),
    ...(response.latencyMs === undefined
      ? {}
      : { latencyMs: response.latencyMs }),
  })
}

function normalizeSemanticGuardError(error: unknown): SemanticGuardModelError {
  if (error instanceof SemanticGuardModelError) {
    return new SemanticGuardModelError(error.code)
  }
  return new SemanticGuardModelError(
    SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE,
  )
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

function parseChatCompletionResponse(body: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new SemanticGuardModelError(
      SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
    )
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new SemanticGuardModelError(
      SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
    )
  }

  const choices: unknown = Reflect.get(parsed, 'choices')
  const choiceList: readonly unknown[] = Array.isArray(choices) ? choices : []
  const firstChoice: unknown = choiceList[0] ?? null
  const message: unknown =
    typeof firstChoice === 'object' && firstChoice !== null
      ? Reflect.get(firstChoice, 'message')
      : null
  const content: unknown =
    typeof message === 'object' && message !== null
      ? Reflect.get(message, 'content')
      : null
  if (typeof content !== 'string' || content.trim() === '') {
    throw new SemanticGuardModelError(
      SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
    )
  }

  const usage: unknown = Reflect.get(parsed, 'usage')
  return {
    content,
    model: optionalString(Reflect.get(parsed, 'model')),
    inputTokens:
      typeof usage === 'object' && usage !== null
        ? optionalTokenCount(Reflect.get(usage, 'prompt_tokens'))
        : undefined,
    outputTokens:
      typeof usage === 'object' && usage !== null
        ? optionalTokenCount(Reflect.get(usage, 'completion_tokens'))
        : undefined,
  }
}

function parseStructuredOutput(outputText: string): unknown {
  try {
    return JSON.parse(outputText)
  } catch {
    throw new SemanticGuardModelError(
      SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
    )
  }
}

function httpStatusFailure(status: number): SemanticGuardModelError {
  if (status === 429) {
    return new SemanticGuardModelError(SEMANTIC_GUARD_ERROR_CODE.RATE_LIMITED)
  }
  if (status === 502 || status === 503 || status === 504) {
    return new SemanticGuardModelError(
      SEMANTIC_GUARD_ERROR_CODE.PROVIDER_UNAVAILABLE,
    )
  }
  return new SemanticGuardModelError(
    SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE,
  )
}

function toProviderFailure(
  rejection: BoundedResponseBodyRejection,
): SemanticGuardModelError {
  return new SemanticGuardModelError(
    rejection === 'oversized_body'
      ? SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT
      : SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE,
  )
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function optionalTokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined
}

function isBoundedMetadata(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    hasAtMostCodePoints(value, maximum)
  )
}

function isOptionalTokenCount(value: unknown): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
  )
}

function isOptionalLatency(value: unknown): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
  )
}
