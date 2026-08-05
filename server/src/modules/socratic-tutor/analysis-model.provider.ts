import { Logger } from '@nestjs/common'

import {
  type BoundedResponseBodyRejection,
  discardResponseBody,
  readBoundedResponseBody,
} from '../../common/upstream/bounded-response-body'
import {
  hasAtMostCodePoints,
  readAbortSignalAborted,
} from '../completion/completion-input'
import {
  ANALYSIS_MODEL_ERROR_CODE,
  type AnalysisModelPort,
  type AnalysisModelRequest,
  type AnalysisModelResponse,
  AnalysisModelError,
} from './analysis-model.port'
import {
  DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
  OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
  type AnalysisModelConfiguration,
  type OpenAICompatibleAnalysisConfiguration,
  validateOpenAICompatibleAnalysisConfiguration,
  validateAnalysisModelConfiguration,
} from './analysis-model.configuration'
import { EDUCATIONAL_ANALYSIS_PROMPT_VERSION } from './educational-analysis.prompt'
import {
  EFFORT_QUALITY,
  LEARNING_EVIDENCE_STRENGTH,
} from './educational-analysis.types'
import {
  MessageRequestKind,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../generated/prisma/client'
import { TOPIC_RESOLUTION_OUTCOME } from './topic.types'

const MAX_ANALYSIS_PROVIDER_LENGTH = 80
const MAX_ANALYSIS_MODEL_LENGTH = 200
const MAX_ANALYSIS_MODEL_VERSION_LENGTH = 200
const MAX_ANALYSIS_RESPONSE_BYTES = 512 * 1_024
const STRUCTURED_OUTPUT_TEMPERATURE = 0
const STRUCTURED_OUTPUT_TOP_P = 1

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

type OpenAICompatibleFailureCategory =
  | 'http_status'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'transport'
  | 'oversized_response'
  | 'malformed_response'
  | 'blank_output'
  | 'cancelled'

class OpenAICompatibleFailure extends Error {
  readonly category: OpenAICompatibleFailureCategory
  readonly status: number | undefined

  constructor(category: OpenAICompatibleFailureCategory, status?: number) {
    super('OpenAI-compatible analysis provider failure')
    this.category = category
    this.status = status
  }
}

export type AnalysisTimeoutSignalFactory = (timeoutMs: number) => AbortSignal

export const defaultAnalysisTimeoutSignalFactory: AnalysisTimeoutSignalFactory =
  (timeoutMs) => AbortSignal.timeout(timeoutMs)

export function createAnalysisModelPort(
  configuration: AnalysisModelConfiguration,
  timeoutSignalFactory: AnalysisTimeoutSignalFactory = defaultAnalysisTimeoutSignalFactory,
): AnalysisModelPort {
  const snapshot = validateAnalysisModelConfiguration(configuration)
  const adapter =
    snapshot.provider === DETERMINISTIC_ANALYSIS_MODEL_PROVIDER
      ? new DeterministicAnalysisModelAdapter()
      : new OpenAICompatibleAnalysisModelAdapter(snapshot.openAICompatible)

  return new ValidatedAnalysisModelPort(
    adapter,
    snapshot.timeoutMs,
    timeoutSignalFactory,
  )
}

export class ValidatedAnalysisModelPort implements AnalysisModelPort {
  constructor(
    private readonly inner: AnalysisModelPort,
    private readonly timeoutMs: number,
    private readonly timeoutSignalFactory: AnalysisTimeoutSignalFactory = defaultAnalysisTimeoutSignalFactory,
  ) {}

  async analyze(request: AnalysisModelRequest): Promise<AnalysisModelResponse> {
    assertAnalysisModelRequest(request)

    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.CANCELLED)
    }

    let timeoutSignal: AbortSignal
    try {
      timeoutSignal = this.timeoutSignalFactory(this.timeoutMs)
      if (!(timeoutSignal instanceof AbortSignal)) {
        throw new TypeError('Invalid timeout signal')
      }
    } catch {
      throw new AnalysisModelError(
        ANALYSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
      )
    }

    const signal =
      request.signal === undefined
        ? timeoutSignal
        : AbortSignal.any([request.signal, timeoutSignal])
    const requestWithTimeout = Object.freeze({
      ...request,
      signal,
    })

    const startedAt = Date.now()
    try {
      const response = await this.executeInner(
        requestWithTimeout,
        request.signal,
        timeoutSignal,
      )
      return validateAnalysisModelResponse({
        ...response,
        latencyMs: response.latencyMs ?? Date.now() - startedAt,
      })
    } catch (error) {
      if (readAbortSignalAborted(timeoutSignal)) {
        throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.TIMEOUT)
      }
      if (
        request.signal !== undefined &&
        readAbortSignalAborted(request.signal)
      ) {
        throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.CANCELLED)
      }
      throw normalizeAnalysisModelError(error)
    }
  }

  private executeInner(
    request: AnalysisModelRequest,
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): Promise<AnalysisModelResponse> {
    return new Promise((resolve, reject) => {
      let settled = false
      let callerListenerInstalled = false
      let timeoutListenerInstalled = false

      const finish = (settle: () => void) => {
        if (settled) {
          return
        }
        settled = true
        if (callerSignal !== undefined && callerListenerInstalled) {
          removeAbortListenerSafely(callerSignal, onCallerAbort)
        }
        if (timeoutListenerInstalled) {
          removeAbortListenerSafely(timeoutSignal, onTimeout)
        }
        settle()
      }
      const onCallerAbort = () => {
        finish(() => {
          reject(new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.CANCELLED))
        })
      }
      const onTimeout = () => {
        finish(() => {
          reject(new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.TIMEOUT))
        })
      }

      try {
        if (
          callerSignal !== undefined &&
          readAbortSignalAborted(callerSignal)
        ) {
          onCallerAbort()
          return
        }
        if (readAbortSignalAborted(timeoutSignal)) {
          onTimeout()
          return
        }

        if (callerSignal !== undefined) {
          EventTarget.prototype.addEventListener.call(
            callerSignal,
            'abort',
            onCallerAbort,
            { once: true },
          )
          callerListenerInstalled = true
        }
        EventTarget.prototype.addEventListener.call(
          timeoutSignal,
          'abort',
          onTimeout,
          { once: true },
        )
        timeoutListenerInstalled = true
      } catch {
        finish(() => {
          reject(
            new AnalysisModelError(
              ANALYSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
            ),
          )
        })
        return
      }

      let pending: Promise<AnalysisModelResponse>
      try {
        pending = Promise.resolve(this.inner.analyze(request))
      } catch {
        finish(() => {
          reject(
            new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE),
          )
        })
        return
      }

      void pending.then(
        (response) => {
          finish(() => {
            resolve(response)
          })
        },
        (error: unknown) => {
          finish(() => {
            reject(normalizeAnalysisModelError(error))
          })
        },
      )
    })
  }
}

export class OpenAICompatibleAnalysisModelAdapter implements AnalysisModelPort {
  private readonly logger = new Logger(
    OpenAICompatibleAnalysisModelAdapter.name,
  )
  private readonly endpoint: string
  private readonly modelName: string
  private readonly authorization: string | null

  constructor(
    configuration: OpenAICompatibleAnalysisConfiguration,
    private readonly fetchImplementation: FetchImplementation = globalThis.fetch,
  ) {
    const snapshot =
      validateOpenAICompatibleAnalysisConfiguration(configuration)
    this.endpoint = snapshot.endpoint
    this.modelName = snapshot.modelName
    this.authorization =
      snapshot.apiKey === null ? null : `Bearer ${snapshot.apiKey}`
  }

  async analyze(request: AnalysisModelRequest): Promise<AnalysisModelResponse> {
    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.CANCELLED)
    }
    assertAnalysisModelRequest(request)

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
          response_format: {
            type: 'json_object',
          },
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
        MAX_ANALYSIS_RESPONSE_BYTES,
        toProviderFailure,
      )
      const parsed = parseChatCompletionResponse(responseBody)

      return Object.freeze({
        rawOutput: parseStructuredOutput(parsed.content),
        provider: OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
        model: parsed.model ?? this.modelName,
        ...(parsed.systemFingerprint === undefined
          ? {}
          : { modelVersion: parsed.systemFingerprint }),
        promptVersion: request.promptVersion,
        ...(parsed.inputTokens === undefined
          ? {}
          : { inputTokens: parsed.inputTokens }),
        ...(parsed.outputTokens === undefined
          ? {}
          : { outputTokens: parsed.outputTokens }),
      })
    } catch (error) {
      if (
        request.signal !== undefined &&
        readAbortSignalAborted(request.signal)
      ) {
        this.logProviderFailure('cancelled', undefined)
        throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.CANCELLED)
      }
      if (error instanceof OpenAICompatibleFailure) {
        this.logProviderFailure(error.category, error.status)
        throw mapProviderFailure(error)
      }
      if (error instanceof AnalysisModelError) {
        throw error
      }

      this.logProviderFailure('transport', undefined)
      throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE)
    }
  }

  private logProviderFailure(
    category: OpenAICompatibleFailureCategory,
    status: number | undefined,
  ): void {
    const diagnostic = `OpenAI-compatible educational analysis failed (category=${category}, status=${status === undefined ? 'none' : String(status)}, model=${this.modelName})`

    if (category === 'cancelled') {
      this.logger.warn(diagnostic)
      return
    }
    this.logger.error(diagnostic)
  }
}

export class DeterministicAnalysisModelAdapter implements AnalysisModelPort {
  analyze(request: AnalysisModelRequest): Promise<AnalysisModelResponse> {
    assertAnalysisModelRequest(request)

    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.CANCELLED)
    }

    const evidenceMessageId = extractCurrentMessageId(request)

    return Promise.resolve(
      Object.freeze({
        rawOutput: Object.freeze({
          requestKind: MessageRequestKind.AMBIGUOUS,
          studentState: StudentState.UNKNOWN,
          effortEvidence: Object.freeze({
            present: false,
            quality: EFFORT_QUALITY.NONE,
            type: null,
            addressesPreviousTutorAction: false,
            isRepeated: false,
            evidenceMessageIds: Object.freeze([]),
          }),
          learningEvidence: Object.freeze({
            present: false,
            strength: LEARNING_EVIDENCE_STRENGTH.NONE,
            evidenceMessageIds: Object.freeze([]),
          }),
          misconceptions: Object.freeze([]),
          topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
          recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
          recommendedTechnique: TeachingTechnique.ORIENTATION_QUESTION,
          recommendedGuidanceLevel: 1,
          confidence: 0.2,
          evidenceReferences: Object.freeze([evidenceMessageId]),
        }),
        provider: DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
        model: 'deterministic-analysis-v1',
        modelVersion: 'deterministic-analysis-v1',
        promptVersion: request.promptVersion,
      }),
    )
  }
}

interface ParsedChatCompletionResponse {
  readonly content: string
  readonly model?: string
  readonly systemFingerprint?: string
  readonly inputTokens?: number
  readonly outputTokens?: number
}

function assertAnalysisModelRequest(request: AnalysisModelRequest): void {
  if (
    request.promptVersion !== EDUCATIONAL_ANALYSIS_PROMPT_VERSION ||
    request.responseSchemaName !== 'EducationalAnalysisResult' ||
    request.messages.length !== 2 ||
    request.messages[0].role !== 'system' ||
    request.messages[1].role !== 'user' ||
    request.messages[0].content.trim() === '' ||
    request.messages[1].content.trim() === ''
  ) {
    throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE)
  }
}

function validateAnalysisModelResponse(
  response: AnalysisModelResponse,
): AnalysisModelResponse {
  if (
    !isBoundedMetadata(response.provider, MAX_ANALYSIS_PROVIDER_LENGTH) ||
    !isBoundedMetadata(response.model, MAX_ANALYSIS_MODEL_LENGTH) ||
    !isOptionalBoundedMetadata(
      response.modelVersion,
      MAX_ANALYSIS_MODEL_VERSION_LENGTH,
    ) ||
    response.promptVersion !== EDUCATIONAL_ANALYSIS_PROMPT_VERSION ||
    !isOptionalTokenCount(response.inputTokens) ||
    !isOptionalTokenCount(response.outputTokens) ||
    !isOptionalLatency(response.latencyMs)
  ) {
    throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE)
  }

  return Object.freeze({
    rawOutput: response.rawOutput,
    provider: response.provider,
    model: response.model,
    ...(response.modelVersion === undefined
      ? {}
      : { modelVersion: response.modelVersion }),
    promptVersion: response.promptVersion,
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

function normalizeAnalysisModelError(error: unknown): AnalysisModelError {
  if (error instanceof AnalysisModelError) {
    return new AnalysisModelError(error.code)
  }
  return new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE)
}

function removeAbortListenerSafely(
  signal: AbortSignal,
  listener: EventListener,
): void {
  try {
    EventTarget.prototype.removeEventListener.call(signal, 'abort', listener)
  } catch {
    // Listener cleanup cannot change the fixed operation outcome.
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

function parseChatCompletionResponse(
  body: string,
): ParsedChatCompletionResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new OpenAICompatibleFailure('malformed_response')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new OpenAICompatibleFailure('malformed_response')
  }

  const choices = Reflect.get(parsed, 'choices')
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new OpenAICompatibleFailure('malformed_response')
  }

  const firstChoice: unknown = choices[0]
  if (
    typeof firstChoice !== 'object' ||
    firstChoice === null ||
    Array.isArray(firstChoice)
  ) {
    throw new OpenAICompatibleFailure('malformed_response')
  }

  const message: unknown = Reflect.get(firstChoice, 'message')
  if (
    typeof message !== 'object' ||
    message === null ||
    Array.isArray(message)
  ) {
    throw new OpenAICompatibleFailure('malformed_response')
  }

  const content: unknown = Reflect.get(message, 'content')
  if (typeof content !== 'string' || content.trim() === '') {
    throw new OpenAICompatibleFailure('blank_output')
  }

  const model = optionalString(Reflect.get(parsed, 'model'))
  const systemFingerprint = optionalString(
    Reflect.get(parsed, 'system_fingerprint'),
  )
  const usage = Reflect.get(parsed, 'usage')
  const inputTokens =
    typeof usage === 'object' && usage !== null
      ? optionalTokenCount(Reflect.get(usage, 'prompt_tokens'))
      : undefined
  const outputTokens =
    typeof usage === 'object' && usage !== null
      ? optionalTokenCount(Reflect.get(usage, 'completion_tokens'))
      : undefined

  return Object.freeze({
    content,
    ...(model === undefined ? {} : { model }),
    ...(systemFingerprint === undefined ? {} : { systemFingerprint }),
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
  })
}

function parseStructuredOutput(outputText: string): unknown {
  try {
    const parsed: unknown = JSON.parse(outputText)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new TypeError('Structured output must be an object')
    }
    return parsed
  } catch {
    throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.MALFORMED_OUTPUT)
  }
}

function httpStatusFailure(status: number): OpenAICompatibleFailure {
  if (status === 429) {
    return new OpenAICompatibleFailure('rate_limited', status)
  }
  if (status === 502 || status === 503 || status === 504) {
    return new OpenAICompatibleFailure('provider_unavailable', status)
  }
  return new OpenAICompatibleFailure('http_status', status)
}

function mapProviderFailure(
  failure: OpenAICompatibleFailure,
): AnalysisModelError {
  switch (failure.category) {
    case 'rate_limited':
      return new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.RATE_LIMITED)
    case 'provider_unavailable':
      return new AnalysisModelError(
        ANALYSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
      )
    case 'malformed_response':
    case 'oversized_response':
    case 'blank_output':
      return new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.MALFORMED_OUTPUT)
    case 'cancelled':
      return new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.CANCELLED)
    case 'http_status':
    case 'transport':
      return new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE)
  }
}

function toProviderFailure(
  rejection: BoundedResponseBodyRejection,
): OpenAICompatibleFailure {
  return new OpenAICompatibleFailure(
    rejection === 'oversized_body'
      ? 'oversized_response'
      : 'malformed_response',
  )
}

function extractCurrentMessageId(request: AnalysisModelRequest): string {
  const userContent = request.messages[1].content
  const match = /"studentMessage":\{"id":"(?<messageId>[^"]+)"/u.exec(
    userContent,
  )
  return match?.groups?.messageId ?? 'analysis-context-message'
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

function isOptionalBoundedMetadata(
  value: unknown,
  maximum: number,
): value is string | undefined {
  return value === undefined || isBoundedMetadata(value, maximum)
}

function isOptionalTokenCount(value: unknown): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= Number.MAX_SAFE_INTEGER)
  )
}

function isOptionalLatency(value: unknown): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= Number.MAX_SAFE_INTEGER)
  )
}
