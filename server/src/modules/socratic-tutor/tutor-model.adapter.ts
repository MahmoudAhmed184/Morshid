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
  DETERMINISTIC_TUTOR_MODEL_PROVIDER,
  OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
  type OpenAICompatibleTutorConfiguration,
  type TutorModelConfiguration,
  validateOpenAICompatibleTutorConfiguration,
  validateTutorModelConfiguration,
} from './tutor-model.configuration'
import {
  TUTOR_GENERATION_FAILURE_CODE,
  type TutorGenerationFailureCode,
  TUTOR_MODEL_ERROR_CODE,
  type TutorModelErrorCode,
  TutorModelError,
  type TutorModelPort,
  type TutorModelRequest,
  type TutorModelResponse,
} from './tutor-generation.types'
import { TUTOR_GENERATION_PROMPT_VERSION } from './tutor-prompt.registry'
import {
  TeachingStrategy,
  TeachingTechnique,
} from '../../generated/prisma/client'

const MAX_TUTOR_PROVIDER_LENGTH = 80
const MAX_TUTOR_MODEL_LENGTH = 200
const MAX_TUTOR_RESPONSE_BYTES = 512 * 1_024
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

class OpenAICompatibleTutorFailure extends Error {
  readonly category: OpenAICompatibleFailureCategory
  readonly status: number | undefined

  constructor(category: OpenAICompatibleFailureCategory, status?: number) {
    super('OpenAI-compatible tutor provider failure')
    this.category = category
    this.status = status
  }
}

interface ParsedChatCompletionResponse {
  readonly content: string
  readonly model?: string
  readonly inputTokens?: number
  readonly outputTokens?: number
}

export type TutorTimeoutSignalFactory = (timeoutMs: number) => AbortSignal

export const defaultTutorTimeoutSignalFactory: TutorTimeoutSignalFactory = (
  timeoutMs,
) => AbortSignal.timeout(timeoutMs)

export function createTutorModelPort(
  configuration: TutorModelConfiguration,
  timeoutSignalFactory: TutorTimeoutSignalFactory = defaultTutorTimeoutSignalFactory,
): TutorModelPort {
  const snapshot = validateTutorModelConfiguration(configuration)
  const adapter =
    snapshot.provider === DETERMINISTIC_TUTOR_MODEL_PROVIDER
      ? new DeterministicTutorModelAdapter()
      : new OpenAICompatibleTutorModelAdapter(snapshot.openAICompatible)

  return new ValidatedTutorModelPort(
    adapter,
    snapshot.timeoutMs,
    timeoutSignalFactory,
  )
}

export class ValidatedTutorModelPort implements TutorModelPort {
  constructor(
    private readonly inner: TutorModelPort,
    private readonly timeoutMs: number,
    private readonly timeoutSignalFactory: TutorTimeoutSignalFactory = defaultTutorTimeoutSignalFactory,
  ) {}

  async generate(request: TutorModelRequest): Promise<TutorModelResponse> {
    assertTutorModelRequest(request)

    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.CANCELLED)
    }

    let timeoutSignal: AbortSignal
    try {
      timeoutSignal = this.timeoutSignalFactory(this.timeoutMs)
      if (!(timeoutSignal instanceof AbortSignal)) {
        throw new TypeError('Invalid timeout signal')
      }
    } catch {
      throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE)
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
      return validateTutorModelResponse({
        ...response,
        latencyMs: response.latencyMs ?? Date.now() - startedAt,
      })
    } catch (error) {
      if (readAbortSignalAborted(timeoutSignal)) {
        throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.TIMEOUT)
      }
      if (
        request.signal !== undefined &&
        readAbortSignalAborted(request.signal)
      ) {
        throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.CANCELLED)
      }
      throw normalizeTutorModelError(error)
    }
  }

  private executeInner(
    request: TutorModelRequest,
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): Promise<TutorModelResponse> {
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
          reject(new TutorModelError(TUTOR_MODEL_ERROR_CODE.CANCELLED))
        })
      }
      const onTimeout = () => {
        finish(() => {
          reject(new TutorModelError(TUTOR_MODEL_ERROR_CODE.TIMEOUT))
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
            new TutorModelError(TUTOR_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE),
          )
        })
        return
      }

      let pending: Promise<TutorModelResponse>
      try {
        pending = Promise.resolve(this.inner.generate(request))
      } catch {
        finish(() => {
          reject(new TutorModelError(TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE))
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
            reject(normalizeTutorModelError(error))
          })
        },
      )
    })
  }
}

export class OpenAICompatibleTutorModelAdapter implements TutorModelPort {
  private readonly logger = new Logger(OpenAICompatibleTutorModelAdapter.name)
  private readonly endpoint: string
  private readonly modelName: string
  private readonly authorization: string | null

  constructor(
    configuration: OpenAICompatibleTutorConfiguration,
    private readonly fetchImplementation: FetchImplementation = globalThis.fetch,
  ) {
    const snapshot = validateOpenAICompatibleTutorConfiguration(configuration)
    this.endpoint = snapshot.endpoint
    this.modelName = snapshot.modelName
    this.authorization =
      snapshot.apiKey === null ? null : `Bearer ${snapshot.apiKey}`
  }

  async generate(request: TutorModelRequest): Promise<TutorModelResponse> {
    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.CANCELLED)
    }
    assertTutorModelRequest(request)

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
        MAX_TUTOR_RESPONSE_BYTES,
        toProviderFailure,
      )
      const parsed = parseChatCompletionResponse(responseBody)

      return Object.freeze({
        rawOutput: parseStructuredOutput(parsed.content),
        provider: OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
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
      if (
        request.signal !== undefined &&
        readAbortSignalAborted(request.signal)
      ) {
        this.logProviderFailure('cancelled', undefined)
        throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.CANCELLED)
      }
      if (error instanceof OpenAICompatibleTutorFailure) {
        this.logProviderFailure(error.category, error.status)
        throw mapProviderFailure(error)
      }
      if (error instanceof TutorModelError) {
        throw error
      }

      this.logProviderFailure('transport', undefined)
      throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE)
    }
  }

  private logProviderFailure(
    category: OpenAICompatibleFailureCategory,
    status: number | undefined,
  ): void {
    const diagnostic = `OpenAI-compatible tutor generation failed (category=${category}, status=${status === undefined ? 'none' : String(status)}, model=${this.modelName})`

    if (category === 'cancelled') {
      this.logger.warn(diagnostic)
      return
    }
    this.logger.error(diagnostic)
  }
}

export class DeterministicTutorModelAdapter implements TutorModelPort {
  generate(request: TutorModelRequest): Promise<TutorModelResponse> {
    assertTutorModelRequest(request)

    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.CANCELLED)
    }

    return Promise.resolve(
      Object.freeze({
        rawOutput: Object.freeze({
          message:
            'What is one small step you can try next using the cited course evidence?',
          responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
          usedCitationIds: Object.freeze(extractAllowedCitationIds(request)),
          requiresStudentAction: true,
          studentAction: Object.freeze({
            type: TeachingTechnique.ORIENTATION_QUESTION,
            description: 'Ask the student to identify the next reasoning step.',
          }),
          reflectionIncluded: false,
          selfReportedCompliance: Object.freeze({
            finalAnswerRevealed: false,
            completeSolutionRevealed: false,
          }),
        }),
        provider: DETERMINISTIC_TUTOR_MODEL_PROVIDER,
        model: 'deterministic-tutor-generation-v1',
        promptVersion: request.promptVersion,
      }),
    )
  }
}

export function tutorFailureFromModelError(
  error: unknown,
): TutorGenerationFailureCode {
  if (!(error instanceof TutorModelError)) {
    return TUTOR_GENERATION_FAILURE_CODE.TUTOR_PROVIDER_TRANSPORT
  }

  return tutorFailureFromTutorCode(error.code)
}

function tutorFailureFromTutorCode(
  code: TutorModelErrorCode,
): TutorGenerationFailureCode {
  switch (code) {
    case TUTOR_MODEL_ERROR_CODE.TIMEOUT:
      return TUTOR_GENERATION_FAILURE_CODE.TUTOR_PROVIDER_TIMEOUT
    case TUTOR_MODEL_ERROR_CODE.RATE_LIMITED:
      return TUTOR_GENERATION_FAILURE_CODE.TUTOR_PROVIDER_RATE_LIMIT
    case TUTOR_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE:
    case TUTOR_MODEL_ERROR_CODE.CONFIGURATION_INVALID:
    case TUTOR_MODEL_ERROR_CODE.CANCELLED:
      return TUTOR_GENERATION_FAILURE_CODE.TUTOR_PROVIDER_UNAVAILABLE
    case TUTOR_MODEL_ERROR_CODE.MALFORMED_OUTPUT:
      return TUTOR_GENERATION_FAILURE_CODE.TUTOR_MALFORMED_OUTPUT
    case TUTOR_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE:
      return TUTOR_GENERATION_FAILURE_CODE.TUTOR_INVALID_OUTPUT
    case TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE:
      return TUTOR_GENERATION_FAILURE_CODE.TUTOR_PROVIDER_TRANSPORT
  }
}

function assertTutorModelRequest(request: TutorModelRequest): void {
  const value: unknown = request
  if (!isTutorModelRequest(value)) {
    throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE)
  }
}

function isTutorModelRequest(value: unknown): value is TutorModelRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const promptVersion: unknown = Reflect.get(value, 'promptVersion')
  const responseSchemaName: unknown = Reflect.get(value, 'responseSchemaName')
  const messages: unknown = Reflect.get(value, 'messages')

  if (
    promptVersion !== TUTOR_GENERATION_PROMPT_VERSION ||
    responseSchemaName !== 'CandidateResponse' ||
    !Array.isArray(messages) ||
    messages.length !== 2
  ) {
    return false
  }

  const systemMessage: unknown = messages[0]
  const userMessage: unknown = messages[1]

  return (
    isTutorMessage(systemMessage, 'system') &&
    isTutorMessage(userMessage, 'user')
  )
}

function isTutorMessage(value: unknown, role: 'system' | 'user'): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const messageRole: unknown = Reflect.get(value, 'role')
  const content: unknown = Reflect.get(value, 'content')

  return (
    messageRole === role && typeof content === 'string' && content.trim() !== ''
  )
}

function validateTutorModelResponse(
  response: TutorModelResponse,
): TutorModelResponse {
  const promptVersion: unknown = Reflect.get(response, 'promptVersion')

  if (
    !isBoundedMetadata(response.provider, MAX_TUTOR_PROVIDER_LENGTH) ||
    !isBoundedMetadata(response.model, MAX_TUTOR_MODEL_LENGTH) ||
    promptVersion !== TUTOR_GENERATION_PROMPT_VERSION ||
    !isOptionalTokenCount(response.inputTokens) ||
    !isOptionalTokenCount(response.outputTokens) ||
    !isOptionalLatency(response.latencyMs)
  ) {
    throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE)
  }

  return Object.freeze({
    rawOutput: response.rawOutput,
    provider: response.provider,
    model: response.model,
    promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
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

function normalizeTutorModelError(error: unknown): TutorModelError {
  if (error instanceof TutorModelError) {
    return new TutorModelError(error.code)
  }
  return new TutorModelError(TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE)
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
    throw new OpenAICompatibleTutorFailure('malformed_response')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new OpenAICompatibleTutorFailure('malformed_response')
  }

  const choices: unknown = Reflect.get(parsed, 'choices')
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new OpenAICompatibleTutorFailure('malformed_response')
  }

  const firstChoice: unknown = choices[0]
  if (
    typeof firstChoice !== 'object' ||
    firstChoice === null ||
    Array.isArray(firstChoice)
  ) {
    throw new OpenAICompatibleTutorFailure('malformed_response')
  }

  const message: unknown = Reflect.get(firstChoice, 'message')
  if (
    typeof message !== 'object' ||
    message === null ||
    Array.isArray(message)
  ) {
    throw new OpenAICompatibleTutorFailure('malformed_response')
  }

  const content: unknown = Reflect.get(message, 'content')
  if (typeof content !== 'string' || content.trim() === '') {
    throw new OpenAICompatibleTutorFailure('blank_output')
  }

  const model = optionalString(Reflect.get(parsed, 'model'))
  const usage: unknown = Reflect.get(parsed, 'usage')
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
    throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.MALFORMED_OUTPUT)
  }
}

function httpStatusFailure(status: number): OpenAICompatibleTutorFailure {
  if (status === 429) {
    return new OpenAICompatibleTutorFailure('rate_limited', status)
  }
  if (status === 502 || status === 503 || status === 504) {
    return new OpenAICompatibleTutorFailure('provider_unavailable', status)
  }
  return new OpenAICompatibleTutorFailure('http_status', status)
}

function mapProviderFailure(
  failure: OpenAICompatibleTutorFailure,
): TutorModelError {
  switch (failure.category) {
    case 'rate_limited':
      return new TutorModelError(TUTOR_MODEL_ERROR_CODE.RATE_LIMITED)
    case 'provider_unavailable':
      return new TutorModelError(TUTOR_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE)
    case 'malformed_response':
    case 'oversized_response':
    case 'blank_output':
      return new TutorModelError(TUTOR_MODEL_ERROR_CODE.MALFORMED_OUTPUT)
    case 'cancelled':
      return new TutorModelError(TUTOR_MODEL_ERROR_CODE.CANCELLED)
    case 'http_status':
    case 'transport':
      return new TutorModelError(TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE)
  }
}

function toProviderFailure(
  rejection: BoundedResponseBodyRejection,
): OpenAICompatibleTutorFailure {
  return new OpenAICompatibleTutorFailure(
    rejection === 'oversized_body'
      ? 'oversized_response'
      : 'malformed_response',
  )
}

function extractAllowedCitationIds(
  request: TutorModelRequest,
): readonly string[] {
  const userContent = request.messages[1].content
  const match = /"allowedCitationIds":\[(?<ids>(?:"[^"]*"(?:,)?)*)\]/u.exec(
    userContent,
  )
  if (match?.groups?.ids === undefined || match.groups.ids.trim() === '') {
    return Object.freeze([])
  }

  try {
    const parsed: unknown = JSON.parse(`[${match.groups.ids}]`)
    return Array.isArray(parsed)
      ? Object.freeze(
          parsed.filter((value): value is string => typeof value === 'string'),
        )
      : Object.freeze([])
  } catch {
    return Object.freeze([])
  }
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
