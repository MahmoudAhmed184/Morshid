import { Logger } from '@nestjs/common'
import { GoogleGenAI } from '@google/genai'
import type {
  CountTokensParameters,
  GoogleGenAIOptions,
  Interactions,
} from '@google/genai'

import type {
  CompletionAdapter,
  PreparedCompletionRequest,
} from '../../completion-adapter'
import { assertPreparedMessageOrder } from '../../completion-adapter'
import {
  GEMINI_COMPLETION_PROVIDER,
  isValidGeminiModelId,
} from '../../completion-configuration'
import { readAbortSignalAborted } from '../../completion-input'
import type { CompletionResult } from '../../completion-provider'
import { CompletionProviderError } from '../../completion-provider'
import { GROUNDED_COMPLETION_PROMPT_VERSION } from '../../grounded-completion-envelope'
import { MAX_COMPLETION_TIMEOUT_MS } from '../../validated-completion.provider'
import type { RetryClock, RetryDelay } from '../http-retry-policy'
import {
  MAX_UPSTREAM_ATTEMPTS,
  readUpstreamFailure,
  waitForRetry,
} from '../http-retry-policy'
import {
  GEMINI_API_VERSION,
  GEMINI_MAX_OUTPUT_TOKENS,
} from './gemini-completion.constants'
import type {
  GeminiQuotaDimension,
  GeminiQuotaUnavailableReason,
} from './gemini-quota.service'
import {
  GeminiQuotaReservationError,
  GeminiQuotaUnavailableError,
} from './gemini-quota.service'

// This adapter owns the retry policy (see `../http-retry-policy`), so the SDK
// must not add a second, invisible layer underneath it: a hidden retry would
// re-issue a generation that was never admitted by the quota guard and would
// spend the deadline this adapter is budgeting. The SDK spells the same policy
// two ways — `httpOptions.retryOptions` on the client and `retries` per
// request — so both are named once here and used everywhere.
const SDK_CLIENT_RETRIES_DISABLED = { attempts: 1 } as const
const SDK_REQUEST_RETRIES_DISABLED = { strategy: 'none' } as const

type GeminiSdkModels = Pick<GoogleGenAI['models'], 'countTokens'>
type GeminiSdkInteractions = Pick<GoogleGenAI['interactions'], 'create'>

interface GeminiSdkClient {
  readonly models: GeminiSdkModels
  readonly interactions: GeminiSdkInteractions
}

/**
 * The exact request this adapter sends, derived from the SDK's own parameter
 * type rather than re-declared beside it. `Pick` is load-bearing: if the SDK
 * renames or drops a field the compiler fails here, which a structurally
 * compatible local copy would not do.
 *
 * `input` and `store` are narrowed on top of the SDK types because this adapter
 * only ever sends a single string turn and never lets Google retain it.
 */
export type GeminiInteractionRequest = Pick<
  Interactions.CreateModelInteractionParamsNonStreaming,
  'model' | 'input' | 'system_instruction' | 'store' | 'generation_config'
> & {
  readonly api_version: string
  readonly input: string
  readonly store: false
}

/** Per-request options, likewise derived from the SDK's real options type. */
export type GeminiInteractionRequestOptions = Pick<
  NonNullable<Parameters<GeminiSdkInteractions['create']>[1]>,
  'retries' | 'signal'
> & {
  readonly signal: AbortSignal
}

// Requests are typed against the SDK; responses deliberately are not. A
// response is provider-controlled data crossing a trust boundary, so it is
// parsed reflectively out of `unknown` rather than trusted to match a
// declaration that only describes the happy path.
export interface GeminiCompletionClient {
  countTokens(params: CountTokensParameters): Promise<unknown>
  createInteraction(
    params: GeminiInteractionRequest,
    options: GeminiInteractionRequestOptions,
  ): Promise<unknown>
}

export type GeminiSdkFactory = (options: GoogleGenAIOptions) => GeminiSdkClient
export type GeminiClock = RetryClock
export type GeminiRetryDelay = RetryDelay

export interface GeminiCompletionAdapterOptions {
  readonly model: string
  readonly completionTimeoutMs: number
}

/**
 * The quota guard as this adapter needs it, owned here rather than derived from
 * the concrete service, so the port does not couple the adapter to a Redis
 * backed class and a test double stays cheap.
 *
 * Three of the four are admission control and may deny — one request unit
 * alone, one request unit plus input tokens, and input tokens alone — and
 * `complete` uses each for the debit it actually names. `recordInputTokens` is
 * the odd one out and is deliberately named apart from them: it books spend the
 * provider has already billed, so it never denies and the adapter calls it only
 * where a denial would be meaningless.
 */
export interface GeminiQuotaPort {
  reserveRequest(): Promise<void>
  reserveGeneration(inputTokens: number): Promise<void>
  reserveInputTokens(inputTokens: number): Promise<void>
  recordInputTokens(inputTokens: number): Promise<void>
}

// Unlike the gateway providers, Gemini cannot be described by plain data: the
// quota guard is Redis-backed and the SDK client is a network object, so both
// are collaborators the composition root owns. The factory therefore receives
// them already constructed and validates their shape, which keeps the
// injected-seam testability of the adapter without the factory having to reach
// for Redis itself.
export interface GeminiConfiguration {
  readonly client: GeminiCompletionClient
  readonly quota: GeminiQuotaPort
  readonly options: GeminiCompletionAdapterOptions
  readonly clock?: GeminiClock
  readonly retryDelay?: GeminiRetryDelay
}

export function validateGeminiConfiguration(
  configuration: unknown,
): GeminiConfiguration {
  try {
    if (typeof configuration !== 'object' || configuration === null) {
      throw new TypeError('Invalid configuration')
    }

    const record = configuration as Record<PropertyKey, unknown>
    const client = Reflect.get(record, 'client')
    const quota = Reflect.get(record, 'quota')
    const options = Reflect.get(record, 'options')
    const clock = Reflect.get(record, 'clock')
    const retryDelay = Reflect.get(record, 'retryDelay')

    if (
      !hasMethods<GeminiCompletionClient>(client, [
        'countTokens',
        'createInteraction',
      ]) ||
      !hasMethods<GeminiQuotaPort>(quota, [
        'reserveRequest',
        'reserveGeneration',
        'reserveInputTokens',
        'recordInputTokens',
      ]) ||
      !isGeminiAdapterOptions(options) ||
      !isOptionalClock(clock) ||
      !isOptionalRetryDelay(retryDelay)
    ) {
      throw new TypeError('Invalid configuration')
    }

    return Object.freeze({
      client,
      quota,
      options: Object.freeze({
        model: options.model,
        completionTimeoutMs: options.completionTimeoutMs,
      }),
      ...(clock === undefined ? {} : { clock }),
      ...(retryDelay === undefined ? {} : { retryDelay }),
    })
  } catch {
    throw new CompletionProviderError('COMPLETION_CONFIGURATION_INVALID')
  }
}

// A predicate rather than a boolean check, so a validated collaborator needs no
// `as` cast to be stored: the cast is exactly what would keep compiling if the
// declared shape and the checked method list ever drifted apart.
function hasMethods<T>(
  value: unknown,
  methods: readonly (keyof T & string)[],
): value is T {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return methods.every(
    (method) => typeof Reflect.get(value, method) === 'function',
  )
}

function isGeminiAdapterOptions(
  value: unknown,
): value is GeminiCompletionAdapterOptions {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const model: unknown = Reflect.get(value, 'model')
  const completionTimeoutMs: unknown = Reflect.get(value, 'completionTimeoutMs')

  // The shared predicate, not a local length check: it is the single owner of
  // Gemini model-ID vocabulary, so this runtime entry point and the startup
  // environment schema cannot drift apart and admit different model IDs.
  return (
    isValidGeminiModelId(model) &&
    typeof completionTimeoutMs === 'number' &&
    Number.isSafeInteger(completionTimeoutMs) &&
    completionTimeoutMs >= 1 &&
    completionTimeoutMs <= MAX_COMPLETION_TIMEOUT_MS
  )
}

// Narrowed per seam rather than through one generic helper, so a validated
// injection point needs no `as` cast to be stored.
function isOptionalClock(value: unknown): value is GeminiClock | undefined {
  return isOptionalFunctionValue(value)
}

function isOptionalRetryDelay(
  value: unknown,
): value is GeminiRetryDelay | undefined {
  return isOptionalFunctionValue(value)
}

function isOptionalFunctionValue(value: unknown): boolean {
  return value === undefined || typeof value === 'function'
}

export function createGeminiCompletionClient(
  apiKey: string,
  sdkFactory: GeminiSdkFactory = defaultGeminiSdkFactory,
): GeminiCompletionClient {
  const sdk = sdkFactory({
    apiKey,
    apiVersion: GEMINI_API_VERSION,
    httpOptions: {
      retryOptions: SDK_CLIENT_RETRIES_DISABLED,
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
  private readonly client: GeminiCompletionClient
  private readonly quota: GeminiQuotaPort
  private readonly model: string
  private readonly completionTimeoutMs: number
  private readonly clock: GeminiClock
  private readonly retryDelay: GeminiRetryDelay

  // Validation lives in the constructor rather than only in the factory, so no
  // construction path — the composition root, an operational script, or a test
  // — can assemble an adapter around collaborators that were never checked.
  constructor(
    client: GeminiCompletionClient,
    quota: GeminiQuotaPort,
    options: GeminiCompletionAdapterOptions,
    clock: GeminiClock = Date.now,
    retryDelay: GeminiRetryDelay = waitForRetry,
  ) {
    const snapshot = validateGeminiConfiguration({
      client,
      quota,
      options,
      clock,
      retryDelay,
    })
    this.client = snapshot.client
    this.quota = snapshot.quota
    this.model = snapshot.options.model
    this.completionTimeoutMs = snapshot.options.completionTimeoutMs
    this.clock = snapshot.clock ?? Date.now
    this.retryDelay = snapshot.retryDelay ?? waitForRetry
  }

  async complete(
    request: PreparedCompletionRequest,
  ): Promise<CompletionResult> {
    if (readAbortSignalAborted(request.signal)) {
      this.logDiagnostic({ outcome: 'cancelled', attemptCount: 0 })
      throw new CompletionProviderError('COMPLETION_CANCELLED')
    }

    // The shared trust-boundary assertion, not a local copy: the same fault has
    // to be reported with the same code by every provider, and the shared
    // helper reads the tuple reflectively because the declared type is exactly
    // what a reordering bug would keep satisfying.
    try {
      assertPreparedMessageOrder(request)
    } catch (error) {
      this.logDiagnostic({ outcome: 'invalid_request', attemptCount: 0 })
      throw error
    }
    const systemMessage = request.messages[0]
    const inputMessage = request.messages[1]

    const startedAt = this.clock()

    // One request unit is debited per real generation call, and no more. This
    // one pays for the FIRST generation call below, not for the preflight: no
    // documented Gemini quota dimension attributes RPM, TPM or RPD to
    // `countTokens` (docs/research/gemini-free-tier-quotas-2026-07-23.md), so
    // metering the preflight as well is what used to make every completion
    // cost two units and hand an operator half the throughput they configured.
    //
    // It is debited here, ahead of the preflight, rather than beside the input
    // tokens below, because an exhausted budget should stop the turn without
    // any call to Google at all — including the preflight.
    try {
      await this.quota.reserveRequest()
    } catch (error) {
      this.handleQuotaFailure(error, 0)
    }

    let countResult: unknown
    try {
      countResult = await this.client.countTokens({
        model: this.model,
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
            retryOptions: SDK_CLIENT_RETRIES_DISABLED,
          },
        },
      })
    } catch (error) {
      this.handlePreflightFailure(error)
    }

    const countedInputTokens = readCountedInputTokens(countResult)
    if (countedInputTokens === null) {
      this.logDiagnostic({ outcome: 'invalid_token_count', attemptCount: 0 })
      throw new CompletionProviderError('COMPLETION_PROVIDER_FAILURE')
    }

    // The loop has no exit condition because every path out of it returns or
    // throws; `attempt` bounds retries rather than iteration, and the only
    // `continue` is guarded by `MAX_UPSTREAM_ATTEMPTS`. Writing it this way
    // removes the trailing unreachable `throw` that used to sit after the loop
    // reading like a real policy decision when it only satisfied return
    // analysis.
    for (let attempt = 1; ; attempt += 1) {
      // The first attempt's request unit was already debited above, so only
      // its input tokens are still owed. A retry is a second genuine
      // generation call that Google bills in full, so it deliberately debits
      // its own request unit together with its own input tokens — atomically,
      // because by then there is nothing left to gate ahead of the preflight.
      try {
        await (attempt === 1
          ? this.quota.reserveInputTokens(countedInputTokens)
          : this.quota.reserveGeneration(countedInputTokens))
      } catch (error) {
        this.handleQuotaFailure(error, attempt, countedInputTokens)
      }

      let response: unknown
      try {
        response = await this.client.createInteraction(
          {
            api_version: GEMINI_API_VERSION,
            model: this.model,
            input: inputMessage.content,
            system_instruction: systemMessage.content,
            store: false,
            generation_config: {
              max_output_tokens: GEMINI_MAX_OUTPUT_TOKENS,
            },
          },
          {
            retries: SDK_REQUEST_RETRIES_DISABLED,
            signal: request.signal,
          },
        )
      } catch (error) {
        // Checked before classification so a cancelled call can never be
        // reclassified as a retryable transport blip and re-issued.
        if (readAbortSignalAborted(request.signal)) {
          this.logDiagnostic({
            outcome: 'cancelled',
            attemptCount: attempt,
            inputTokens: countedInputTokens,
          })
          throw new CompletionProviderError('COMPLETION_CANCELLED')
        }

        const now = this.clock()
        const failure = readUpstreamFailure(error, now)
        const elapsedMs = Math.max(0, now - startedAt)
        if (
          failure.retryable &&
          attempt < MAX_UPSTREAM_ATTEMPTS &&
          failure.retryDelayMs < this.completionTimeoutMs - elapsedMs
        ) {
          await this.retryDelay(failure.retryDelayMs, request.signal)
          continue
        }

        // Only genuine rate limiting is reported as rate limiting. A 5xx, a
        // 408, or an exhausted transport retry means the provider is unwell,
        // and collapsing the two would have an operator lowering caps that
        // were never the constraint.
        const rateLimited = failure.status === 429
        this.logDiagnostic({
          outcome: rateLimited ? 'upstream_rate_limited' : 'upstream_failure',
          attemptCount: attempt,
          inputTokens: countedInputTokens,
        })
        throw new CompletionProviderError(
          rateLimited
            ? 'COMPLETION_RATE_LIMITED'
            : 'COMPLETION_PROVIDER_FAILURE',
        )
      }

      const parsed = readInteractionResponse(response)
      if (parsed.kind !== 'answer') {
        this.logDiagnostic({
          outcome: parsed.kind,
          attemptCount: attempt,
          inputTokens: countedInputTokens,
        })
        throw new CompletionProviderError('COMPLETION_PROVIDER_FAILURE')
      }

      // Post-hoc bookkeeping, not admission control, which is why it is a
      // different guard call from the pre-generation token debit above. Google
      // has already billed every token the answer reports, so `record` always
      // writes and cannot deny: the token bucket goes negative if it must, and
      // that debt suppresses the next admission instead of the spend going
      // unrecorded.
      //
      // Only the guard's own infrastructure can still fail here, and even that
      // must not be able to destroy an answer that already exists: failing here
      // would mark the turn FAILED, the student would retry, and the same quota
      // would be spent a second time. It is logged and the completion is
      // returned.
      const additionalInputTokens = Math.max(
        0,
        parsed.inputTokens - countedInputTokens,
      )
      try {
        await this.quota.recordInputTokens(additionalInputTokens)
      } catch (error) {
        // Only a reason is read, never a denied dimension: there is no budget
        // this call could have been refused by.
        this.logDiagnostic({
          outcome: 'quota_reconcile_failed',
          attemptCount: attempt,
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
          ...readQuotaUnavailableDetail(error),
        })
      }

      this.logDiagnostic({
        outcome: 'success',
        attemptCount: attempt,
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
      })
      return Object.freeze({
        content: parsed.outputText,
        provider: GEMINI_COMPLETION_PROVIDER,
        model: this.model,
        promptVersion: GROUNDED_COMPLETION_PROMPT_VERSION,
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
      })
    }
  }

  private handlePreflightFailure(error: unknown): never {
    const failure = readUpstreamFailure(error, this.clock())
    const rateLimited = failure.status === 429
    this.logDiagnostic({
      outcome: rateLimited ? 'preflight_rate_limited' : 'preflight_failure',
      attemptCount: 0,
    })
    throw new CompletionProviderError(
      rateLimited ? 'COMPLETION_RATE_LIMITED' : 'COMPLETION_PROVIDER_FAILURE',
    )
  }

  // An exhausted budget and an unavailable guard are different operational
  // facts and get different public codes: the first is our own cap doing its
  // job, the second is Redis or the guard's own configuration failing. Anything
  // the guard did not classify is treated as unavailable, which keeps the
  // adapter fail-closed without mislabelling an outage as a rate limit.
  private handleQuotaFailure(
    error: unknown,
    attemptCount: number,
    inputTokens?: number,
  ): never {
    const exhausted = error instanceof GeminiQuotaReservationError
    this.logDiagnostic({
      outcome: exhausted ? 'quota_exhausted' : 'quota_unavailable',
      attemptCount,
      inputTokens,
      ...readQuotaDetail(error),
    })
    throw new CompletionProviderError(
      exhausted ? 'COMPLETION_RATE_LIMITED' : 'COMPLETION_PROVIDER_FAILURE',
    )
  }

  // Diagnostics carry only non-sensitive facts: the typed outcome, the
  // allow-listed model id, the attempt number, the guard's own classification,
  // and token counts. The api key, the prompt, the student content, and every
  // byte of a provider response or error are excluded by construction.
  private logDiagnostic(diagnostic: GeminiCompletionDiagnostic): void {
    const message = `Gemini completion (outcome=${diagnostic.outcome}, model=${this.model}, attempt=${String(diagnostic.attemptCount)}, quotaDimension=${diagnostic.quotaDimension ?? 'none'}, quotaReason=${diagnostic.quotaReason ?? 'none'}, inputTokens=${formatTokenCount(diagnostic.inputTokens)}, outputTokens=${formatTokenCount(diagnostic.outputTokens)})`

    if (diagnostic.outcome === 'success') {
      this.logger.log(message)
      return
    }
    if (DEGRADED_COMPLETION_OUTCOMES.has(diagnostic.outcome)) {
      this.logger.warn(message)
      return
    }
    this.logger.error(message)
  }
}

/**
 * Every distinguishable way a completion ends, as a closed union so log-based
 * alerting can be written against a known set of values — the same shape the
 * ITI gateway adapter uses for its failure categories.
 */
type GeminiCompletionOutcome =
  | 'success'
  | 'cancelled'
  | 'invalid_request'
  | 'invalid_token_count'
  | 'preflight_rate_limited'
  | 'preflight_failure'
  | 'quota_exhausted'
  | 'quota_unavailable'
  | 'quota_reconcile_failed'
  | 'upstream_rate_limited'
  | 'upstream_failure'
  | 'truncated_response'
  | 'missing_usage'
  | 'malformed_response'

// Expected operation or a survivable degradation, not a fault to page on: a
// cancelled turn, our own configured cap doing its job, upstream rate limiting,
// and bookkeeping that could not be recorded for a completion that succeeded.
// Everything else is a genuine failure and is logged at error severity.
const DEGRADED_COMPLETION_OUTCOMES: ReadonlySet<GeminiCompletionOutcome> =
  new Set([
    'cancelled',
    'quota_exhausted',
    'quota_reconcile_failed',
    'preflight_rate_limited',
    'upstream_rate_limited',
  ])

interface GeminiCompletionDiagnostic {
  readonly outcome: GeminiCompletionOutcome
  readonly attemptCount: number
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly quotaDimension?: GeminiQuotaDimension
  readonly quotaReason?: GeminiQuotaUnavailableReason
}

function readQuotaDetail(error: unknown): {
  readonly quotaDimension?: GeminiQuotaDimension
  readonly quotaReason?: GeminiQuotaUnavailableReason
} {
  if (error instanceof GeminiQuotaReservationError) {
    return { quotaDimension: error.dimension }
  }
  return readQuotaUnavailableDetail(error)
}

function readQuotaUnavailableDetail(error: unknown): {
  readonly quotaReason?: GeminiQuotaUnavailableReason
} {
  if (error instanceof GeminiQuotaUnavailableError) {
    return { quotaReason: error.reason }
  }
  return {}
}

function formatTokenCount(value: number | undefined): string {
  return value === undefined ? 'none' : String(value)
}

function defaultGeminiSdkFactory(options: GoogleGenAIOptions): GeminiSdkClient {
  return new GoogleGenAI(options)
}

function readCountedInputTokens(value: unknown): number | null {
  try {
    if (typeof value !== 'object' || value === null) {
      return null
    }
    const totalTokens: unknown = Reflect.get(value, 'totalTokens')
    // Zero is rejected rather than accepted as a free request: the prompt
    // always contains the non-empty grounded envelope, so a real count can
    // never be zero, and treating it as one would reserve nothing against the
    // input-token budget for a request Google does charge for.
    if (!isTokenCount(totalTokens) || totalTokens === 0) {
      return null
    }
    return totalTokens
  } catch {
    return null
  }
}

type GeminiParsedResponse =
  | {
      readonly kind: 'answer'
      readonly outputText: string
      readonly inputTokens: number
      readonly outputTokens: number
    }
  | { readonly kind: 'truncated_response' }
  | { readonly kind: 'missing_usage' }
  | { readonly kind: 'malformed_response' }

/**
 * Parses a provider-controlled response reflectively and fails closed.
 *
 * Truncation and absent usage each get their own outcome rather than
 * collapsing into "malformed". Both are answers we deliberately discard after
 * the quota was already spent: a truncated answer is not grounded to its own
 * conclusion, and an answer whose token usage is unknown cannot be reconciled
 * against the budget or reported to the caller. Keeping them distinguishable in
 * the log is what lets an operator see that the output ceiling is too tight, or
 * that the provider changed its usage payload, instead of reading a flat
 * "malformed response" rate.
 */
function readInteractionResponse(value: unknown): GeminiParsedResponse {
  try {
    if (typeof value !== 'object' || value === null) {
      return { kind: 'malformed_response' }
    }
    const status: unknown = Reflect.get(value, 'status')
    if (status === 'incomplete') {
      return { kind: 'truncated_response' }
    }

    const outputText: unknown = Reflect.get(value, 'output_text')
    const usage: unknown = Reflect.get(value, 'usage')
    if (
      status !== 'completed' ||
      typeof outputText !== 'string' ||
      outputText.trim() === ''
    ) {
      return { kind: 'malformed_response' }
    }
    if (typeof usage !== 'object' || usage === null) {
      return { kind: 'missing_usage' }
    }

    const inputTokens: unknown = Reflect.get(usage, 'total_input_tokens')
    const outputTokens: unknown = Reflect.get(usage, 'total_output_tokens')
    if (!isTokenCount(inputTokens) || !isTokenCount(outputTokens)) {
      return { kind: 'missing_usage' }
    }
    return { kind: 'answer', outputText, inputTokens, outputTokens }
  } catch {
    return { kind: 'malformed_response' }
  }
}

function isTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
