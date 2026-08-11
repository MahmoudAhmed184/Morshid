import { Logger } from '@nestjs/common'

import {
  STRUCTURED_CHAT_ERROR_CODE,
  StructuredChatTransport,
  StructuredChatTransportError,
} from '../../common/upstream/structured-chat.transport'
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
import {
  DEBUGGING_GUIDANCE_FULL_REWRITE_REFUSAL,
  type DebuggingGuidanceContext,
} from './debugging-guidance.contract'

const MAX_TUTOR_PROVIDER_LENGTH = 80
const MAX_TUTOR_MODEL_LENGTH = 200
const MAX_TUTOR_RESPONSE_BYTES = 512 * 1_024

export type TutorTimeoutSignalFactory = (timeoutMs: number) => AbortSignal

export const defaultTutorTimeoutSignalFactory: TutorTimeoutSignalFactory = (
  timeoutMs,
) => AbortSignal.timeout(timeoutMs)

export function createTutorModelPort(
  configuration: TutorModelConfiguration,
  timeoutSignalFactory: TutorTimeoutSignalFactory = defaultTutorTimeoutSignalFactory,
): TutorModelPort {
  const snapshot = validateTutorModelConfiguration(configuration)
  if (snapshot.provider === DETERMINISTIC_TUTOR_MODEL_PROVIDER) {
    return new DeterministicTutorModelAdapter()
  }

  return new OpenAICompatibleTutorModelAdapter(
    snapshot.openAICompatible,
    snapshot.timeoutMs,
    timeoutSignalFactory,
  )
}

export class OpenAICompatibleTutorModelAdapter implements TutorModelPort {
  private readonly logger = new Logger(OpenAICompatibleTutorModelAdapter.name)
  private readonly endpoint: string
  private readonly modelName: string
  private readonly authorization: string | null
  private readonly maxCompletionTokens: number
  private readonly timeoutMs: number
  private readonly transport: StructuredChatTransport

  constructor(
    configuration: OpenAICompatibleTutorConfiguration,
    timeoutMs: number,
    timeoutSignalFactory: TutorTimeoutSignalFactory = defaultTutorTimeoutSignalFactory,
    fetchImplementation: (
      input: string | URL | Request,
      init?: RequestInit,
    ) => Promise<Response> = globalThis.fetch,
  ) {
    const snapshot = validateOpenAICompatibleTutorConfiguration(configuration)
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

  async generate(request: TutorModelRequest): Promise<TutorModelResponse> {
    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new TutorModelError(TUTOR_MODEL_ERROR_CODE.CANCELLED)
    }
    assertTutorModelRequest(request)

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
        maxResponseBytes: MAX_TUTOR_RESPONSE_BYTES,
        signal: request.signal,
      })

      return validateTutorModelResponse({
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
      const normalized = mapStructuredChatError(error)
      this.logProviderFailure(normalized.code, normalized.status)
      throw normalized
    }
  }

  private logProviderFailure(
    category: string,
    status: number | undefined,
  ): void {
    const diagnostic = `OpenAI-compatible tutor generation failed (category=${category}, status=${status === undefined ? 'none' : String(status)}, model=${this.modelName})`

    if (category === STRUCTURED_CHAT_ERROR_CODE.CANCELLED) {
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

    const allowedCitationIds = extractAllowedCitationIds(request)
    const debuggingGuidance = extractDebuggingGuidance(request)
    const debugging = request.messages[1].content.includes(
      '"strategy":"DEBUGGING_GUIDANCE"',
    )

    return Promise.resolve(
      Object.freeze({
        rawOutput: Object.freeze(
          debugging
            ? debuggingCandidate(
                debuggingGuidance ?? defaultDebuggingGuidance(),
                allowedCitationIds,
              )
            : {
                message:
                  'What is one small step you can try next using the cited course evidence?',
                responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
                usedCitationIds: Object.freeze(allowedCitationIds),
                requiresStudentAction: true,
                studentAction: Object.freeze({
                  type: TeachingTechnique.ORIENTATION_QUESTION,
                  description:
                    'Ask the student to identify the next reasoning step.',
                }),
                reflectionIncluded: false,
                selfReportedCompliance: Object.freeze({
                  finalAnswerRevealed: false,
                  completeSolutionRevealed: false,
                }),
              },
        ),
        provider: DETERMINISTIC_TUTOR_MODEL_PROVIDER,
        model: 'deterministic-tutor-generation-v1',
        promptVersion: request.promptVersion,
      }),
    )
  }
}

function defaultDebuggingGuidance(): DebuggingGuidanceContext {
  return {
    likelyIssue: 'The submitted code needs one focused trace of its state.',
    relevantLocation:
      'The first expression whose value differs from expectation.',
    concept:
      'Trace each value through the relevant operation before changing the code.',
    nextInspectionStep:
      'Trace the first relevant value and write down what it becomes.',
    evidenceQuery: '',
    rewriteRequested: false,
  }
}

function debuggingCandidate(
  guidance: DebuggingGuidanceContext,
  allowedCitationIds: readonly string[],
): Record<string, unknown> {
  const citation = allowedCitationIds.at(0)
  const concept =
    citation === undefined
      ? guidance.concept
      : `${guidance.concept} [${citation}]`
  const message = [
    ...(guidance.rewriteRequested
      ? [DEBUGGING_GUIDANCE_FULL_REWRITE_REFUSAL, '']
      : []),
    'Likely defect',
    guidance.likelyIssue,
    '',
    'Relevant location',
    guidance.relevantLocation,
    '',
    'Concept',
    concept,
    '',
    'Next inspection step',
    guidance.nextInspectionStep,
  ].join('\n')

  return {
    message,
    responseIntent: TeachingStrategy.DEBUGGING_GUIDANCE,
    usedCitationIds:
      citation === undefined ? Object.freeze([]) : Object.freeze([citation]),
    requiresStudentAction: true,
    studentAction: Object.freeze({
      type: TeachingTechnique.TRACE_EXECUTION,
      description: guidance.nextInspectionStep,
    }),
    reflectionIncluded: false,
    selfReportedCompliance: Object.freeze({
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    }),
  }
}

function extractDebuggingGuidance(
  request: TutorModelRequest,
): DebuggingGuidanceContext | null {
  const match = /debuggingGuidance\n(?<json>\{[^\n]+\})/u.exec(
    request.messages[1].content,
  )
  if (match?.groups?.json === undefined) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(match.groups.json)
    if (!isDebuggingGuidanceContext(parsed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function isDebuggingGuidanceContext(
  value: unknown,
): value is DebuggingGuidanceContext {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.likelyIssue === 'string' &&
    typeof record.relevantLocation === 'string' &&
    typeof record.concept === 'string' &&
    typeof record.nextInspectionStep === 'string' &&
    typeof record.evidenceQuery === 'string' &&
    typeof record.rewriteRequested === 'boolean'
  )
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

function mapStructuredChatError(error: unknown): TutorModelError {
  if (error instanceof TutorModelError) {
    return error
  }

  if (error instanceof StructuredChatTransportError) {
    const metadata = {
      ...(error.status === undefined ? {} : { status: error.status }),
      ...(error.headers === undefined ? {} : { headers: error.headers }),
    }
    switch (error.code) {
      case STRUCTURED_CHAT_ERROR_CODE.TIMEOUT:
        return new TutorModelError(TUTOR_MODEL_ERROR_CODE.TIMEOUT, metadata)
      case STRUCTURED_CHAT_ERROR_CODE.CANCELLED:
        return new TutorModelError(TUTOR_MODEL_ERROR_CODE.CANCELLED, metadata)
      case STRUCTURED_CHAT_ERROR_CODE.RATE_LIMITED:
        return new TutorModelError(
          TUTOR_MODEL_ERROR_CODE.RATE_LIMITED,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.PROVIDER_UNAVAILABLE:
        return new TutorModelError(
          TUTOR_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.MALFORMED_RESPONSE:
      case STRUCTURED_CHAT_ERROR_CODE.OVERSIZED_RESPONSE:
        return new TutorModelError(
          TUTOR_MODEL_ERROR_CODE.MALFORMED_OUTPUT,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.HTTP_STATUS:
      case STRUCTURED_CHAT_ERROR_CODE.TRANSPORT_FAILURE:
        return new TutorModelError(
          TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE,
          metadata,
        )
    }
  }

  return new TutorModelError(TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE)
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
