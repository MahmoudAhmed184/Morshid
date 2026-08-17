import { Logger } from '@nestjs/common'

import {
  STRUCTURED_CHAT_ERROR_CODE,
  type FetchImplementation,
  StructuredChatTransport,
  StructuredChatTransportError,
} from '../../../platform/ai/upstream/structured-chat.transport'
import { hasAtMostCodePoints, readAbortSignalAborted } from './model-boundary'
import {
  DETERMINISTIC_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER,
  OPENAI_COMPATIBLE_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER,
  type DebuggingDiagnosisModelConfiguration,
  type OpenAICompatibleDebuggingDiagnosisConfiguration,
  validateDebuggingDiagnosisModelConfiguration,
  validateOpenAICompatibleDebuggingDiagnosisConfiguration,
} from './debugging-diagnosis-model.configuration'
import {
  DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE,
  DEBUGGING_DIAGNOSIS_MODEL_PROMPT_VERSION,
  DebuggingDiagnosisModelError,
  type DebuggingDiagnosisModelPort,
  type DebuggingDiagnosisModelRequest,
  type DebuggingDiagnosisModelResponse,
} from '../socratic-workflow/debugging-guidance/debugging-diagnosis-model.port'

const MAX_DIAGNOSIS_PROVIDER_LENGTH = 80
const MAX_DIAGNOSIS_MODEL_LENGTH = 200
const MAX_DIAGNOSIS_RESPONSE_BYTES = 128 * 1_024

export type DebuggingDiagnosisTimeoutSignalFactory = (
  timeoutMs: number,
) => AbortSignal

export const defaultDebuggingDiagnosisTimeoutSignalFactory: DebuggingDiagnosisTimeoutSignalFactory =
  (timeoutMs) => AbortSignal.timeout(timeoutMs)

export function createDebuggingDiagnosisModelPort(
  configuration: DebuggingDiagnosisModelConfiguration,
  timeoutSignalFactory: DebuggingDiagnosisTimeoutSignalFactory = defaultDebuggingDiagnosisTimeoutSignalFactory,
  fetchImplementation: FetchImplementation = globalThis.fetch,
): DebuggingDiagnosisModelPort {
  const snapshot = validateDebuggingDiagnosisModelConfiguration(configuration)
  if (snapshot.provider === DETERMINISTIC_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER) {
    return new DeterministicDebuggingDiagnosisModelAdapter()
  }

  return new OpenAICompatibleDebuggingDiagnosisModelAdapter(
    snapshot.openAICompatible,
    snapshot.timeoutMs,
    timeoutSignalFactory,
    fetchImplementation,
  )
}

export class OpenAICompatibleDebuggingDiagnosisModelAdapter implements DebuggingDiagnosisModelPort {
  private readonly logger = new Logger(
    OpenAICompatibleDebuggingDiagnosisModelAdapter.name,
  )
  private readonly endpoint: string
  private readonly modelName: string
  private readonly authorization: string | null
  private readonly maxCompletionTokens: number
  private readonly timeoutMs: number
  private readonly transport: StructuredChatTransport

  constructor(
    configuration: OpenAICompatibleDebuggingDiagnosisConfiguration,
    timeoutMs: number,
    timeoutSignalFactory: DebuggingDiagnosisTimeoutSignalFactory = defaultDebuggingDiagnosisTimeoutSignalFactory,
    fetchImplementation: FetchImplementation = globalThis.fetch,
  ) {
    const snapshot =
      validateOpenAICompatibleDebuggingDiagnosisConfiguration(configuration)
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

  async diagnose(
    request: DebuggingDiagnosisModelRequest,
  ): Promise<DebuggingDiagnosisModelResponse> {
    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new DebuggingDiagnosisModelError(
        DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.CANCELLED,
      )
    }
    assertDebuggingDiagnosisModelRequest(request)

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
        maxResponseBytes: MAX_DIAGNOSIS_RESPONSE_BYTES,
        signal: request.signal,
      })

      return validateDebuggingDiagnosisModelResponse({
        rawOutput: parseStructuredOutput(parsed.content),
        provider: OPENAI_COMPATIBLE_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER,
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
      const normalized = this.mapStructuredChatError(error)
      this.logProviderFailure(normalized.code, normalized.status)
      throw normalized
    }
  }

  private logProviderFailure(
    category: string,
    status: number | undefined,
  ): void {
    const diagnostic = `OpenAI-compatible debugging diagnosis failed (category=${category}, status=${status === undefined ? 'none' : String(status)}, model=${this.modelName})`

    if (category === STRUCTURED_CHAT_ERROR_CODE.CANCELLED) {
      this.logger.warn(diagnostic)
      return
    }
    this.logger.error(diagnostic)
  }

  private mapStructuredChatError(error: unknown): DebuggingDiagnosisModelError {
    if (error instanceof DebuggingDiagnosisModelError) {
      return error
    }

    const metadata = {
      provider: OPENAI_COMPATIBLE_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER,
      model: this.modelName,
      ...(error instanceof StructuredChatTransportError &&
      error.status !== undefined
        ? { status: error.status }
        : {}),
      ...(error instanceof StructuredChatTransportError &&
      error.headers !== undefined
        ? { headers: error.headers }
        : {}),
    }

    if (error instanceof StructuredChatTransportError) {
      switch (error.code) {
        case STRUCTURED_CHAT_ERROR_CODE.TIMEOUT:
          return new DebuggingDiagnosisModelError(
            DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.TIMEOUT,
            metadata,
          )
        case STRUCTURED_CHAT_ERROR_CODE.CANCELLED:
          return new DebuggingDiagnosisModelError(
            DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.CANCELLED,
            metadata,
          )
        case STRUCTURED_CHAT_ERROR_CODE.RATE_LIMITED:
          return new DebuggingDiagnosisModelError(
            DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.RATE_LIMITED,
            metadata,
          )
        case STRUCTURED_CHAT_ERROR_CODE.PROVIDER_UNAVAILABLE:
          return new DebuggingDiagnosisModelError(
            DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
            metadata,
          )
        case STRUCTURED_CHAT_ERROR_CODE.MALFORMED_RESPONSE:
        case STRUCTURED_CHAT_ERROR_CODE.OVERSIZED_RESPONSE:
          return new DebuggingDiagnosisModelError(
            DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.MALFORMED_OUTPUT,
            metadata,
          )
        case STRUCTURED_CHAT_ERROR_CODE.HTTP_STATUS:
        case STRUCTURED_CHAT_ERROR_CODE.TRANSPORT_FAILURE:
          return new DebuggingDiagnosisModelError(
            DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE,
            metadata,
          )
      }
    }

    return new DebuggingDiagnosisModelError(
      DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE,
      metadata,
    )
  }
}

export class DeterministicDebuggingDiagnosisModelAdapter implements DebuggingDiagnosisModelPort {
  diagnose(
    request: DebuggingDiagnosisModelRequest,
  ): Promise<DebuggingDiagnosisModelResponse> {
    assertDebuggingDiagnosisModelRequest(request)

    if (
      request.signal !== undefined &&
      readAbortSignalAborted(request.signal)
    ) {
      throw new DebuggingDiagnosisModelError(
        DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.CANCELLED,
      )
    }

    return Promise.resolve(
      Object.freeze({
        rawOutput: Object.freeze({
          status: 'RESOLVED',
          category: 'INITIALIZATION',
          likelyDefect:
            'The running maximum starts at 0, so all-negative inputs never replace it.',
          location: Object.freeze({
            lineStart: 2,
            lineEnd: 2,
            kind: 'CODE',
          }),
          evidenceReferences: Object.freeze([
            Object.freeze({ source: 'CODE', lineStart: 2, lineEnd: 2 }),
            Object.freeze({
              source: 'SYMPTOM',
              lineStart: null,
              lineEnd: null,
            }),
          ]),
          underlyingConcept:
            'A running maximum must be initialized from the data or a valid lower bound.',
          requiresRuntimeEvidence: true,
          runtimeEvidenceNeeded: 'TRACE_VALUES',
          inspectionGoal: 'Trace the tracked maximum on an all-negative input.',
        }),
        provider: DETERMINISTIC_DEBUGGING_DIAGNOSIS_MODEL_PROVIDER,
        model: 'deterministic-diagnosis-v1',
        promptVersion: request.promptVersion,
      }),
    )
  }
}

function validateDebuggingDiagnosisModelResponse(
  response: DebuggingDiagnosisModelResponse,
): DebuggingDiagnosisModelResponse {
  if (
    !isBoundedMetadata(response.provider, MAX_DIAGNOSIS_PROVIDER_LENGTH) ||
    !isBoundedMetadata(response.model, MAX_DIAGNOSIS_MODEL_LENGTH) ||
    (response.promptVersion as string) !==
      DEBUGGING_DIAGNOSIS_MODEL_PROMPT_VERSION ||
    !isOptionalTokenCount(response.inputTokens) ||
    !isOptionalTokenCount(response.outputTokens)
  ) {
    throw new DebuggingDiagnosisModelError(
      DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE,
    )
  }

  return Object.freeze({
    rawOutput: response.rawOutput,
    provider: response.provider,
    model: response.model,
    promptVersion: response.promptVersion,
    ...(response.inputTokens === undefined
      ? {}
      : { inputTokens: response.inputTokens }),
    ...(response.outputTokens === undefined
      ? {}
      : { outputTokens: response.outputTokens }),
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
    throw new DebuggingDiagnosisModelError(
      DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.MALFORMED_OUTPUT,
    )
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

function assertDebuggingDiagnosisModelRequest(
  request: DebuggingDiagnosisModelRequest,
): void {
  const req = request as unknown as {
    promptVersion?: string
    messages?: readonly unknown[]
  }
  if (
    req.promptVersion !== DEBUGGING_DIAGNOSIS_MODEL_PROMPT_VERSION ||
    !Array.isArray(req.messages) ||
    req.messages.length !== 2
  ) {
    throw new DebuggingDiagnosisModelError(
      DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.CONFIGURATION_INVALID,
    )
  }
}
