import { Logger } from '@nestjs/common'

import {
  STRUCTURED_CHAT_ERROR_CODE,
  type FetchImplementation,
  StructuredChatTransport,
  StructuredChatTransportError,
} from '../../../platform/ai/upstream/structured-chat.transport'
import { hasAtMostCodePoints, readAbortSignalAborted } from './model-boundary'
import {
  ANALYSIS_MODEL_ERROR_CODE,
  type AnalysisModelPort,
  type AnalysisModelRequest,
  type AnalysisModelResponse,
  AnalysisModelError,
} from '../socratic-workflow/analysis/analysis-model.port'
import {
  DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
  OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
  type AnalysisModelConfiguration,
  type OpenAICompatibleAnalysisConfiguration,
  validateAnalysisModelConfiguration,
  validateOpenAICompatibleAnalysisConfiguration,
} from './analysis-model.configuration'
import { EDUCATIONAL_ANALYSIS_PROMPT_VERSION } from '../socratic-workflow/analysis/educational-analysis.prompt'
import {
  EFFORT_QUALITY,
  LEARNING_EVIDENCE_STRENGTH,
} from '../socratic-workflow/analysis/educational-analysis.types'
import {
  MessageRequestKind,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../tutoring-values'
import { TOPIC_RESOLUTION_OUTCOME } from '../socratic-workflow/topic/topic.types'

const MAX_ANALYSIS_PROVIDER_LENGTH = 80
const MAX_ANALYSIS_MODEL_LENGTH = 200
const MAX_ANALYSIS_MODEL_VERSION_LENGTH = 200
const MAX_ANALYSIS_RESPONSE_BYTES = 512 * 1_024

export type AnalysisTimeoutSignalFactory = (timeoutMs: number) => AbortSignal

export const defaultAnalysisTimeoutSignalFactory: AnalysisTimeoutSignalFactory =
  (timeoutMs) => AbortSignal.timeout(timeoutMs)

export function createAnalysisModelPort(
  configuration: AnalysisModelConfiguration,
  timeoutSignalFactory: AnalysisTimeoutSignalFactory = defaultAnalysisTimeoutSignalFactory,
  fetchImplementation: FetchImplementation = globalThis.fetch,
): AnalysisModelPort {
  const snapshot = validateAnalysisModelConfiguration(configuration)
  if (snapshot.provider === DETERMINISTIC_ANALYSIS_MODEL_PROVIDER) {
    return new DeterministicAnalysisModelAdapter()
  }

  return new OpenAICompatibleAnalysisModelAdapter(
    snapshot.openAICompatible,
    snapshot.timeoutMs,
    timeoutSignalFactory,
    fetchImplementation,
  )
}

export class OpenAICompatibleAnalysisModelAdapter implements AnalysisModelPort {
  private readonly logger = new Logger(
    OpenAICompatibleAnalysisModelAdapter.name,
  )
  private readonly endpoint: string
  private readonly modelName: string
  private readonly authorization: string | null
  private readonly maxCompletionTokens: number
  private readonly timeoutMs: number
  private readonly transport: StructuredChatTransport

  constructor(
    configuration: OpenAICompatibleAnalysisConfiguration,
    timeoutMs: number,
    timeoutSignalFactory: AnalysisTimeoutSignalFactory = defaultAnalysisTimeoutSignalFactory,
    fetchImplementation: FetchImplementation = globalThis.fetch,
  ) {
    const snapshot =
      validateOpenAICompatibleAnalysisConfiguration(configuration)
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

  async analyze(request: AnalysisModelRequest): Promise<AnalysisModelResponse> {
    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.CANCELLED)
    }
    assertAnalysisModelRequest(request)

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
        maxResponseBytes: MAX_ANALYSIS_RESPONSE_BYTES,
        signal: request.signal,
      })

      return validateAnalysisModelResponse({
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
      const normalized = mapStructuredChatError(error)
      this.logProviderFailure(normalized.code, normalized.status)
      throw normalized
    }
  }

  private logProviderFailure(
    category: string,
    status: number | undefined,
  ): void {
    const diagnostic = `OpenAI-compatible educational analysis failed (category=${category}, status=${status === undefined ? 'none' : String(status)}, model=${this.modelName})`

    if (category === STRUCTURED_CHAT_ERROR_CODE.CANCELLED) {
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
    const codeDiagnosis = isDeterministicCodeDiagnosisRequest(request)
    return Promise.resolve(
      Object.freeze({
        rawOutput: Object.freeze({
          requestKind: codeDiagnosis
            ? MessageRequestKind.CODE_DIAGNOSIS
            : MessageRequestKind.AMBIGUOUS,
          studentState: codeDiagnosis
            ? StudentState.DEBUGGING_ISSUE
            : StudentState.UNKNOWN,
          effortEvidence: Object.freeze({
            present: codeDiagnosis,
            quality: codeDiagnosis
              ? EFFORT_QUALITY.MEANINGFUL
              : EFFORT_QUALITY.NONE,
            type: codeDiagnosis ? 'CODE_ATTEMPT' : null,
            addressesPreviousTutorAction: false,
            isRepeated: false,
            evidenceMessageIds: codeDiagnosis
              ? Object.freeze([evidenceMessageId])
              : Object.freeze([]),
          }),
          learningEvidence: Object.freeze({
            present: false,
            strength: LEARNING_EVIDENCE_STRENGTH.NONE,
            evidenceMessageIds: Object.freeze([]),
          }),
          misconceptions: Object.freeze([]),
          topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
          recommendedStrategy: codeDiagnosis
            ? TeachingStrategy.DEBUGGING_GUIDANCE
            : TeachingStrategy.SOCRATIC_QUESTIONING,
          recommendedTechnique: codeDiagnosis
            ? TeachingTechnique.TRACE_EXECUTION
            : TeachingTechnique.ORIENTATION_QUESTION,
          recommendedGuidanceLevel: 1,
          confidence: codeDiagnosis ? 0.9 : 0.2,
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

function assertAnalysisModelRequest(request: AnalysisModelRequest): void {
  const value: unknown = request
  if (!isAnalysisModelRequest(value)) {
    throw new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE)
  }
}

function isAnalysisModelRequest(value: unknown): value is AnalysisModelRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const promptVersion: unknown = Reflect.get(value, 'promptVersion')
  const responseSchemaName: unknown = Reflect.get(value, 'responseSchemaName')
  const messages: unknown = Reflect.get(value, 'messages')

  if (
    promptVersion !== EDUCATIONAL_ANALYSIS_PROMPT_VERSION ||
    responseSchemaName !== 'EducationalAnalysisResult' ||
    !Array.isArray(messages) ||
    messages.length !== 2
  ) {
    return false
  }

  const systemMessage: unknown = messages[0]
  const userMessage: unknown = messages[1]

  return (
    isAnalysisMessage(systemMessage, 'system') &&
    isAnalysisMessage(userMessage, 'user')
  )
}

function isAnalysisMessage(value: unknown, role: 'system' | 'user'): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const messageRole: unknown = Reflect.get(value, 'role')
  const content: unknown = Reflect.get(value, 'content')

  return (
    messageRole === role && typeof content === 'string' && content.trim() !== ''
  )
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

function parseStructuredOutput(outputText: string): unknown {
  try {
    const raw = outputText.trim()
    const jsonText = raw.startsWith('```')
      ? raw
          .replace(/^```(?:json)?\s*/iu, '')
          .replace(/\s*```$/u, '')
          .trim()
      : raw
    const parsed: unknown = JSON.parse(jsonText)
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

function mapStructuredChatError(error: unknown): AnalysisModelError {
  if (error instanceof AnalysisModelError) {
    return error
  }

  if (error instanceof StructuredChatTransportError) {
    const metadata = {
      ...(error.status === undefined ? {} : { status: error.status }),
      ...(error.headers === undefined ? {} : { headers: error.headers }),
    }
    switch (error.code) {
      case STRUCTURED_CHAT_ERROR_CODE.TIMEOUT:
        return new AnalysisModelError(
          ANALYSIS_MODEL_ERROR_CODE.TIMEOUT,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.CANCELLED:
        return new AnalysisModelError(
          ANALYSIS_MODEL_ERROR_CODE.CANCELLED,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.RATE_LIMITED:
        return new AnalysisModelError(
          ANALYSIS_MODEL_ERROR_CODE.RATE_LIMITED,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.PROVIDER_UNAVAILABLE:
        return new AnalysisModelError(
          ANALYSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.MALFORMED_RESPONSE:
      case STRUCTURED_CHAT_ERROR_CODE.OVERSIZED_RESPONSE:
        return new AnalysisModelError(
          ANALYSIS_MODEL_ERROR_CODE.MALFORMED_OUTPUT,
          metadata,
        )
      case STRUCTURED_CHAT_ERROR_CODE.HTTP_STATUS:
      case STRUCTURED_CHAT_ERROR_CODE.TRANSPORT_FAILURE:
        return new AnalysisModelError(
          ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE,
          metadata,
        )
    }
  }

  return new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE)
}

function extractCurrentMessageId(request: AnalysisModelRequest): string {
  const userContent = request.messages[1].content
  const match = /"studentMessage":\{"id":"(?<messageId>[^"]+)"/u.exec(
    userContent,
  )
  return match?.groups?.messageId ?? 'analysis-context-message'
}

function isDeterministicCodeDiagnosisRequest(
  request: AnalysisModelRequest,
): boolean {
  const content = request.messages[1].content
  const containsCode =
    /```|(?:^|\s|\\n)(?:def|class|function)\s+[A-Za-z_][A-Za-z0-9_]*/u.test(
      content,
    )
  const containsDiagnosisIntent =
    /\b(?:bug|crash|debug|diagnos|error|fail(?:s|ed|ure)?|fix|issue|wrong|rewrite)\w*\b/iu.test(
      content,
    )
  return containsCode && containsDiagnosisIntent
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
