import { Logger } from '@nestjs/common'
import {
  GoogleGenAI,
  type CountTokensParameters,
  type GoogleGenAIOptions,
  type Interactions,
} from '@google/genai'

import type {
  CompletionAdapter,
  PreparedCompletionRequest,
} from './completion-adapter'
import type { CompletionResult } from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import {
  GEMINI_API_VERSION,
  GEMINI_COMPLETION_PROVIDER,
} from './gemini-completion.constants'
import {
  type GeminiQuotaDimension,
  GeminiQuotaReservationError,
  type GeminiQuotaService,
} from './gemini-quota.service'
import { GROUNDED_COMPLETION_PROMPT_VERSION } from './grounded-completion-envelope'

const MAX_GENERATION_ATTEMPTS = 2
const DEFAULT_RETRY_DELAY_MS = 250
const MAX_PROVIDER_RETRY_DELAY_MS = 30_000

interface GeminiInteractionRequest {
  readonly api_version: string
  readonly model: string
  readonly input: string
  readonly system_instruction: string
  readonly store: false
}

interface GeminiInteractionRequestOptions {
  readonly retries: { readonly strategy: 'none' }
  readonly signal: AbortSignal
}

export interface GeminiCompletionClient {
  countTokens(params: CountTokensParameters): Promise<unknown>
  createInteraction(
    params: GeminiInteractionRequest,
    options: GeminiInteractionRequestOptions,
  ): Promise<unknown>
}

interface GeminiSdkClient {
  readonly models: {
    countTokens(params: CountTokensParameters): Promise<unknown>
  }
  readonly interactions: {
    create(
      params: Interactions.InteractionCreateParams,
      options?: {
        readonly retries?: { readonly strategy: 'none' }
        readonly signal?: AbortSignal
      },
    ): Promise<unknown>
  }
}

export type GeminiSdkFactory = (options: GoogleGenAIOptions) => GeminiSdkClient
export type GeminiClock = () => number
export type GeminiRetryDelay = (
  delayMs: number,
  signal: AbortSignal,
) => Promise<void>

export interface GeminiCompletionAdapterOptions {
  readonly model: string
  readonly completionTimeoutMs: number
}

export function createGeminiCompletionClient(
  apiKey: string,
  sdkFactory: GeminiSdkFactory = defaultGeminiSdkFactory,
): GeminiCompletionClient {
  const sdk = sdkFactory({
    apiKey,
    apiVersion: GEMINI_API_VERSION,
    httpOptions: {
      retryOptions: {
        attempts: 1,
      },
    },
  })

  return {
    countTokens: (params) => sdk.models.countTokens(params),
    createInteraction: (params, options) =>
      sdk.interactions.create(params, options),
  }
}

export class GeminiCompletionAdapter implements CompletionAdapter {
  private readonly logger = new Logger(GeminiCompletionAdapter.name)

  constructor(
    private readonly client: GeminiCompletionClient,
    private readonly quota: Pick<
      GeminiQuotaService,
      'reserveRequest' | 'reserveGeneration' | 'reconcileInputTokens'
    >,
    private readonly options: GeminiCompletionAdapterOptions,
    private readonly clock: GeminiClock = Date.now,
    private readonly retryDelay: GeminiRetryDelay = waitForRetry,
  ) {}

  async complete(
    request: PreparedCompletionRequest,
  ): Promise<CompletionResult> {
    const startedAt = this.clock()
    const systemMessage = request.messages[0]
    const inputMessage = request.messages[1]
    if (systemMessage.role !== 'system' || inputMessage.role !== 'user') {
      this.logDiagnostic('malformed_request', 0)
      throw new CompletionProviderError('COMPLETION_PROVIDER_FAILURE')
    }

    let countedInputTokens: number
    try {
      await this.quota.reserveRequest()
      const countResult = await this.client.countTokens({
        model: this.options.model,
        // The Gemini Developer API countTokens endpoint does not accept
        // systemInstruction through @google/genai. Preserve both exact texts
        // as separate parts so preflight still counts the full request input;
        // response usage is reconciled below if provider framing costs more.
        contents: {
          role: 'user',
          parts: [
            { text: systemMessage.content },
            { text: inputMessage.content },
          ],
        },
        config: {
          abortSignal: request.signal,
          httpOptions: {
            retryOptions: {
              attempts: 1,
            },
          },
        },
      })
      countedInputTokens = readCountedInputTokens(countResult)
    } catch (error) {
      this.handlePreflightFailure(error)
    }

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        await this.quota.reserveGeneration(countedInputTokens)
      } catch (error) {
        this.handleQuotaFailure(error, attempt, countedInputTokens)
      }

      let response: unknown
      try {
        response = await this.client.createInteraction(
          {
            api_version: GEMINI_API_VERSION,
            model: this.options.model,
            input: inputMessage.content,
            system_instruction: systemMessage.content,
            store: false,
          },
          {
            retries: { strategy: 'none' },
            signal: request.signal,
          },
        )
      } catch (error) {
        const failure = readUpstreamFailure(error)
        if (
          failure.retryable &&
          attempt < MAX_GENERATION_ATTEMPTS &&
          this.retryFitsDeadline(failure.retryDelayMs, startedAt)
        ) {
          await this.retryDelay(failure.retryDelayMs, request.signal)
          continue
        }

        const errorCode =
          failure.status === 429 || failure.retryable
            ? 'COMPLETION_RATE_LIMITED'
            : 'COMPLETION_PROVIDER_FAILURE'
        this.logDiagnostic(
          errorCode === 'COMPLETION_RATE_LIMITED'
            ? 'retry_exhausted'
            : 'upstream_failure',
          attempt,
          countedInputTokens,
        )
        throw new CompletionProviderError(errorCode)
      }

      const parsed = readInteractionResponse(response)
      if (parsed === null) {
        this.logDiagnostic('invalid_response', attempt, countedInputTokens)
        throw new CompletionProviderError('COMPLETION_PROVIDER_FAILURE')
      }

      const additionalInputTokens = Math.max(
        0,
        parsed.inputTokens - countedInputTokens,
      )
      try {
        await this.quota.reconcileInputTokens(additionalInputTokens)
      } catch (error) {
        this.handleQuotaFailure(
          error,
          attempt,
          parsed.inputTokens,
          parsed.outputTokens,
        )
      }

      this.logDiagnostic(
        'success',
        attempt,
        parsed.inputTokens,
        parsed.outputTokens,
      )
      return Object.freeze({
        content: parsed.outputText,
        provider: GEMINI_COMPLETION_PROVIDER,
        model: this.options.model,
        promptVersion: GROUNDED_COMPLETION_PROMPT_VERSION,
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
      })
    }

    throw new CompletionProviderError('COMPLETION_RATE_LIMITED')
  }

  private retryFitsDeadline(delayMs: number, startedAt: number): boolean {
    const elapsedMs = Math.max(0, this.clock() - startedAt)
    return delayMs < this.options.completionTimeoutMs - elapsedMs
  }

  private handlePreflightFailure(error: unknown): never {
    if (error instanceof GeminiQuotaReservationError) {
      this.logDiagnostic(
        'rate_limited',
        0,
        undefined,
        undefined,
        error.dimension,
      )
      throw new CompletionProviderError('COMPLETION_RATE_LIMITED')
    }

    const upstream = readUpstreamFailure(error)
    const rateLimited = upstream.status === 429
    this.logDiagnostic(rateLimited ? 'rate_limited' : 'preflight_failure', 0)
    throw new CompletionProviderError(
      rateLimited ? 'COMPLETION_RATE_LIMITED' : 'COMPLETION_PROVIDER_FAILURE',
    )
  }

  private handleQuotaFailure(
    error: unknown,
    attemptCount: number,
    inputTokens?: number,
    outputTokens?: number,
  ): never {
    const dimension =
      error instanceof GeminiQuotaReservationError
        ? error.dimension
        : ('redis' as const)
    this.logDiagnostic(
      'rate_limited',
      attemptCount,
      inputTokens,
      outputTokens,
      dimension,
    )
    throw new CompletionProviderError('COMPLETION_RATE_LIMITED')
  }

  private logDiagnostic(
    outcome: string,
    attemptCount: number,
    inputTokens?: number,
    outputTokens?: number,
    quotaDimension?: GeminiQuotaDimension,
  ): void {
    const diagnostic = {
      event: 'gemini_completion',
      outcome,
      provider: GEMINI_COMPLETION_PROVIDER,
      model: this.options.model,
      attemptCount,
      quotaDimension: quotaDimension ?? null,
      inputTokens: inputTokens ?? null,
      outputTokens: outputTokens ?? null,
    }

    if (outcome === 'success') {
      this.logger.log(diagnostic)
    } else {
      this.logger.warn(diagnostic)
    }
  }
}

function defaultGeminiSdkFactory(options: GoogleGenAIOptions): GeminiSdkClient {
  return new GoogleGenAI(options)
}

function readCountedInputTokens(value: unknown): number {
  try {
    if (typeof value !== 'object' || value === null) {
      throw new TypeError('Invalid token count response')
    }
    const totalTokens: unknown = Reflect.get(value, 'totalTokens')
    if (!isTokenCount(totalTokens) || totalTokens === 0) {
      throw new TypeError('Invalid token count')
    }
    return totalTokens
  } catch {
    throw new CompletionProviderError('COMPLETION_PROVIDER_FAILURE')
  }
}

function readInteractionResponse(value: unknown): {
  readonly outputText: string
  readonly inputTokens: number
  readonly outputTokens: number
} | null {
  try {
    if (typeof value !== 'object' || value === null) {
      return null
    }
    const status: unknown = Reflect.get(value, 'status')
    const outputText: unknown = Reflect.get(value, 'output_text')
    const usage: unknown = Reflect.get(value, 'usage')
    if (
      status !== 'completed' ||
      typeof outputText !== 'string' ||
      outputText.trim() === '' ||
      typeof usage !== 'object' ||
      usage === null
    ) {
      return null
    }

    const inputTokens: unknown = Reflect.get(usage, 'total_input_tokens')
    const outputTokens: unknown = Reflect.get(usage, 'total_output_tokens')
    if (!isTokenCount(inputTokens) || !isTokenCount(outputTokens)) {
      return null
    }
    return { outputText, inputTokens, outputTokens }
  } catch {
    return null
  }
}

function isTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function readUpstreamFailure(value: unknown): {
  readonly status?: number
  readonly retryable: boolean
  readonly retryDelayMs: number
} {
  try {
    if (typeof value !== 'object' || value === null) {
      return { retryable: false, retryDelayMs: DEFAULT_RETRY_DELAY_MS }
    }
    const statusCode: unknown = Reflect.get(value, 'statusCode')
    const status: unknown = Reflect.get(value, 'status')
    const headers: unknown = Reflect.get(value, 'headers')
    const normalizedStatus = isHttpStatus(statusCode)
      ? statusCode
      : isHttpStatus(status)
        ? status
        : undefined
    const retryable =
      normalizedStatus === 408 ||
      normalizedStatus === 429 ||
      (normalizedStatus !== undefined && normalizedStatus >= 500)

    return {
      ...(normalizedStatus === undefined ? {} : { status: normalizedStatus }),
      retryable,
      retryDelayMs: readRetryDelayMs(headers),
    }
  } catch {
    return { retryable: false, retryDelayMs: DEFAULT_RETRY_DELAY_MS }
  }
}

function isHttpStatus(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 100 &&
    value <= 599
  )
}

function readRetryDelayMs(headers: unknown): number {
  try {
    if (!(headers instanceof Headers)) {
      return DEFAULT_RETRY_DELAY_MS
    }
    const milliseconds = headers.get('retry-after-ms')
    if (milliseconds !== null) {
      const parsed = Number(milliseconds)
      if (
        Number.isSafeInteger(parsed) &&
        parsed >= 0 &&
        parsed <= MAX_PROVIDER_RETRY_DELAY_MS
      ) {
        return parsed
      }
    }

    const retryAfter = headers.get('retry-after')
    if (retryAfter === null) {
      return DEFAULT_RETRY_DELAY_MS
    }
    const seconds = Number(retryAfter)
    if (Number.isSafeInteger(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_PROVIDER_RETRY_DELAY_MS)
    }
    const date = Date.parse(retryAfter)
    if (Number.isFinite(date)) {
      return Math.min(
        Math.max(0, date - Date.now()),
        MAX_PROVIDER_RETRY_DELAY_MS,
      )
    }
  } catch {
    // Malformed provider metadata cannot alter the bounded retry policy.
  }
  return DEFAULT_RETRY_DELAY_MS
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new CompletionProviderError('COMPLETION_CANCELLED'))
      return
    }

    let settled = false
    const finish = (settle: () => void) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      signal.removeEventListener('abort', onAbort)
      settle()
    }
    const onAbort = () => {
      finish(() => {
        reject(new CompletionProviderError('COMPLETION_CANCELLED'))
      })
    }
    const timeout = setTimeout(() => {
      finish(resolve)
    }, delayMs)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
