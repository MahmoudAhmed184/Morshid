import { Logger } from '@nestjs/common'

import {
  STRUCTURED_CHAT_ERROR_CODE,
  type FetchImplementation,
  StructuredChatTransport,
  StructuredChatTransportError,
} from '../../../platform/ai/upstream/structured-chat.transport'
import { hasAtMostCodePoints, readAbortSignalAborted } from './model-boundary'
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
  type SemanticGuardFinishReason,
  type SemanticGuardModelResponse,
  type SemanticGuardPort,
  type SemanticGuardRequest,
} from '../socratic-workflow/response-approval/semantic-guard.types'

const MAX_GUARD_PROVIDER_LENGTH = 80
const MAX_GUARD_MODEL_LENGTH = 200
const MAX_GUARD_RESPONSE_BYTES = 512 * 1_024

type GuardTimeoutSignalFactory = (timeoutMs: number) => AbortSignal

const defaultGuardTimeoutSignalFactory: GuardTimeoutSignalFactory = (
  timeoutMs,
) => AbortSignal.timeout(timeoutMs)

export function createSemanticGuardPort(
  configuration: SemanticGuardConfiguration,
  timeoutSignalFactory: GuardTimeoutSignalFactory = defaultGuardTimeoutSignalFactory,
  fetchImplementation: FetchImplementation = globalThis.fetch,
): SemanticGuardPort {
  const snapshot = validateSemanticGuardConfiguration(configuration)
  if (snapshot.provider === DETERMINISTIC_SEMANTIC_GUARD_PROVIDER) {
    return new DeterministicSemanticGuardAdapter()
  }

  return new OpenAICompatibleSemanticGuardAdapter(
    snapshot.openAICompatible,
    snapshot.timeoutMs,
    timeoutSignalFactory,
    fetchImplementation,
  )
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

    const content = candidateMessageFromRequest(request.messages[1].content)
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

function candidateMessageFromRequest(content: string): string {
  try {
    const parsed: unknown = JSON.parse(content)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return content
    }
    const candidate: unknown = Reflect.get(parsed, 'candidate')
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      return content
    }
    const message: unknown = Reflect.get(candidate, 'message')
    return typeof message === 'string' ? message : content
  } catch {
    return content
  }
}

export class OpenAICompatibleSemanticGuardAdapter implements SemanticGuardPort {
  private readonly logger = new Logger(
    OpenAICompatibleSemanticGuardAdapter.name,
  )
  private readonly endpoint: string
  private readonly modelName: string
  private readonly authorization: string | null
  private readonly maxCompletionTokens: number
  private readonly timeoutMs: number
  private readonly transport: StructuredChatTransport

  constructor(
    configuration: OpenAICompatibleSemanticGuardConfiguration,
    timeoutMs: number,
    timeoutSignalFactory: GuardTimeoutSignalFactory = defaultGuardTimeoutSignalFactory,
    fetchImplementation: FetchImplementation = globalThis.fetch,
  ) {
    const snapshot =
      validateOpenAICompatibleSemanticGuardConfiguration(configuration)
    this.endpoint = snapshot.endpoint
    this.modelName = snapshot.modelName
    this.maxCompletionTokens = snapshot.maxCompletionTokens
    this.timeoutMs = timeoutMs
    this.authorization =
      snapshot.apiKey === null ? null : `Bearer ${snapshot.apiKey}`
    this.transport = new StructuredChatTransport(
      fetchImplementation,
      timeoutSignalFactory,
    )
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
      const parsed = await this.transport.complete({
        endpoint: this.endpoint,
        authorization: this.authorization,
        model: this.modelName,
        messages: request.messages,
        temperature: 0,
        topP: 1,
        maxCompletionTokens: this.maxCompletionTokens,
        timeoutMs: this.timeoutMs,
        maxResponseBytes: MAX_GUARD_RESPONSE_BYTES,
        signal: request.signal,
      })

      return validateSemanticGuardResponse({
        rawOutput: parseStructuredOutput(parsed.content, parsed.finishReason),
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
      const normalized = mapStructuredChatError(error)
      this.logger.warn({
        event: 'semantic_guard_provider_failed',
        errorClass: normalized.name,
        errorCode: normalized.code,
        status: normalized.status ?? null,
        finishReason: normalized.finishReason ?? null,
      })
      throw normalized
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

function parseStructuredOutput(
  outputText: string,
  finishReason: string | undefined,
): unknown {
  const safeFinishReason = semanticGuardFinishReason(finishReason)
  if (safeFinishReason === 'length') {
    throw new SemanticGuardModelError(
      SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
      { finishReason: safeFinishReason },
    )
  }

  try {
    const raw = outputText.trim()
    const jsonText = raw.startsWith('```')
      ? raw
          .replace(/^```(?:json)?\s*/iu, '')
          .replace(/\s*```$/u, '')
          .trim()
      : raw
    return JSON.parse(jsonText)
  } catch {
    throw new SemanticGuardModelError(
      SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
      safeFinishReason === undefined ? {} : { finishReason: safeFinishReason },
    )
  }
}

function semanticGuardFinishReason(
  value: string | undefined,
): SemanticGuardFinishReason | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === 'length' || value === 'stop') {
    return value
  }
  return 'other'
}

function mapStructuredChatError(error: unknown): SemanticGuardModelError {
  if (error instanceof SemanticGuardModelError) {
    return error
  }

  if (error instanceof StructuredChatTransportError) {
    const metadata = {
      ...(error.status === undefined ? {} : { status: error.status }),
      ...(error.headers === undefined ? {} : { headers: error.headers }),
    }
    switch (error.code) {
      case STRUCTURED_CHAT_ERROR_CODE.TIMEOUT:
        return new SemanticGuardModelError(
          SEMANTIC_GUARD_ERROR_CODE.TIMEOUT,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.CANCELLED:
        return new SemanticGuardModelError(
          SEMANTIC_GUARD_ERROR_CODE.CANCELLED,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.RATE_LIMITED:
        return new SemanticGuardModelError(
          SEMANTIC_GUARD_ERROR_CODE.RATE_LIMITED,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.PROVIDER_UNAVAILABLE:
        return new SemanticGuardModelError(
          SEMANTIC_GUARD_ERROR_CODE.PROVIDER_UNAVAILABLE,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.MALFORMED_RESPONSE:
      case STRUCTURED_CHAT_ERROR_CODE.OVERSIZED_RESPONSE:
        return new SemanticGuardModelError(
          SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.HTTP_STATUS:
      case STRUCTURED_CHAT_ERROR_CODE.TRANSPORT_FAILURE:
        return new SemanticGuardModelError(
          SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE,
          metadata,
        )
    }
  }

  return new SemanticGuardModelError(
    SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE,
  )
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
