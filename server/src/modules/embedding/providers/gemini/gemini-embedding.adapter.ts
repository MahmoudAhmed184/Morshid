import { Logger } from '@nestjs/common'
import type { EmbedContentConfig, EmbedContentParameters } from '@google/genai'

import {
  type RetryClock,
  readUpstreamFailure,
} from '../../../../common/upstream/upstream-retry-policy'
import type {
  Embedding,
  EmbeddingDocument,
  EmbeddingProvider,
} from '../../embedding-provider'
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingErrorCode,
  EmbeddingConfigurationError,
  EmbeddingUpstreamError,
} from '../../embedding-provider'
import {
  createGroupAbortError,
  mapBoundedConcurrency,
  planEmbeddingBatches,
} from '../embedding-batching'
import {
  buildGeminiDocumentInput,
  buildGeminiQueryInput,
} from './gemini-embedding-input'
import {
  GEMINI_EMBEDDING_API_VERSION,
  GEMINI_EMBEDDING_BATCH_SIZE,
  GEMINI_EMBEDDING_CONCURRENCY,
  GEMINI_EMBEDDING_DOCUMENT_PROFILE,
  GEMINI_EMBEDDING_MODEL,
  GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY,
  GEMINI_EMBEDDING_QUERY_PROTOCOL,
} from './gemini-embedding.constants'

/**
 * The config this adapter sends, derived from the SDK's own type.
 *
 * `Omit<..., 'taskType'>` is load-bearing: `gemini-embedding-2` does not support
 * `taskType`, and the SDK types it as a loose `string`, so without this the
 * compiler would happily accept a value the model rejects. Making it unnameable
 * is stronger than validating it.
 */
type GeminiEmbeddingConfig = Pick<
  Omit<EmbedContentConfig, 'taskType'>,
  'outputDimensionality' | 'abortSignal' | 'httpOptions'
>

export type GeminiEmbeddingRequest = Pick<
  EmbedContentParameters,
  'model' | 'contents'
> & {
  readonly config: GeminiEmbeddingConfig
}

/**
 * Requests are typed against the SDK; responses deliberately are not. A response
 * is provider-controlled data crossing a trust boundary, so it is parsed
 * reflectively out of `unknown`.
 */
export interface GeminiEmbeddingClient {
  embedContent(request: GeminiEmbeddingRequest): Promise<unknown>
}

/**
 * The quota guard as this adapter needs it.
 *
 * One method, because the reservation must be atomic: request unit and
 * estimated input units are debited in a single Redis operation *before* the
 * upstream call, so an exhausted budget makes zero calls to Google and a denial
 * debits nothing.
 */
export interface GeminiEmbeddingQuotaPort {
  reserveGeneration(estimatedInputUnits: number): Promise<void>
}

export interface GeminiEmbeddingAdapterOptions {
  readonly queryTimeoutMs: number
  readonly documentTimeoutMs: number
  readonly requestTimeoutMs: number
}

export interface GeminiEmbeddingConfiguration {
  readonly client: GeminiEmbeddingClient
  readonly quota: GeminiEmbeddingQuotaPort
  readonly options: GeminiEmbeddingAdapterOptions
  readonly clock?: RetryClock
  readonly createTimeoutSignal?: (timeoutMs: number) => AbortSignal
}

type GeminiEmbeddingOutcome =
  | 'ok'
  | 'quota_denied'
  | 'aggregated_response'
  | 'malformed_response'
  | 'invalid_vector'
  | 'count_mismatch'
  | 'timeout'
  | 'cancelled'
  | 'rate_limited'
  | 'upstream_failure'

export function validateGeminiEmbeddingConfiguration(
  configuration: unknown,
): GeminiEmbeddingConfiguration {
  try {
    if (typeof configuration !== 'object' || configuration === null) {
      throw new TypeError('Invalid configuration')
    }

    const record = configuration as Record<PropertyKey, unknown>
    const client = Reflect.get(record, 'client')
    const quota = Reflect.get(record, 'quota')
    const options = Reflect.get(record, 'options')
    const clock = Reflect.get(record, 'clock')
    const createTimeoutSignal = Reflect.get(record, 'createTimeoutSignal')

    if (
      !hasMethods<GeminiEmbeddingClient>(client, ['embedContent']) ||
      !hasMethods<GeminiEmbeddingQuotaPort>(quota, ['reserveGeneration']) ||
      !isAdapterOptions(options) ||
      !isOptionalFunction(clock) ||
      !isOptionalFunction(createTimeoutSignal)
    ) {
      throw new TypeError('Invalid configuration')
    }

    return Object.freeze({
      client,
      quota,
      options: Object.freeze({
        queryTimeoutMs: options.queryTimeoutMs,
        documentTimeoutMs: options.documentTimeoutMs,
        requestTimeoutMs: options.requestTimeoutMs,
      }),
      ...(clock === undefined ? {} : { clock: clock as RetryClock }),
      ...(createTimeoutSignal === undefined
        ? {}
        : {
            createTimeoutSignal: createTimeoutSignal as (
              timeoutMs: number,
            ) => AbortSignal,
          }),
    })
  } catch {
    throw new EmbeddingConfigurationError()
  }
}

/**
 * Gemini embedding through the Developer API.
 *
 * The SDK's `abortSignal` is client-side only: it stops us waiting, but does
 * not necessarily stop provider-side processing or billing. That is still the
 * right behaviour — a deadline exists so a caller stops waiting — but it must
 * not be read as a guarantee that a timed-out request costs nothing.
 */
export class GeminiEmbeddingAdapter implements EmbeddingProvider {
  readonly model = GEMINI_EMBEDDING_DOCUMENT_PROFILE
  readonly queryProtocol = GEMINI_EMBEDDING_QUERY_PROTOCOL

  private readonly logger = new Logger(GeminiEmbeddingAdapter.name)
  private readonly client: GeminiEmbeddingClient
  private readonly quota: GeminiEmbeddingQuotaPort
  private readonly options: GeminiEmbeddingAdapterOptions
  private readonly clock: RetryClock
  private readonly createTimeoutSignal: (timeoutMs: number) => AbortSignal

  constructor(configuration: GeminiEmbeddingConfiguration) {
    const snapshot = validateGeminiEmbeddingConfiguration(configuration)
    this.client = snapshot.client
    this.quota = snapshot.quota
    this.options = snapshot.options
    this.clock = snapshot.clock ?? (() => Date.now())
    this.createTimeoutSignal =
      snapshot.createTimeoutSignal ??
      ((timeoutMs) => AbortSignal.timeout(timeoutMs))
  }

  async embedQuery(query: string): Promise<Embedding> {
    const deadlineMs = this.clock() + this.options.queryTimeoutMs
    const [vector] = await this.requestBatch(
      [buildGeminiQueryInput(query)],
      deadlineMs,
    )
    return vector
  }

  async embedDocuments(
    documents: readonly EmbeddingDocument[],
  ): Promise<readonly Embedding[]> {
    const deadlineMs = this.clock() + this.options.documentTimeoutMs
    const inputs = documents.map((document) =>
      buildGeminiDocumentInput(document.text, document.title),
    )
    const ranges = planEmbeddingBatches(
      inputs.length,
      GEMINI_EMBEDDING_BATCH_SIZE,
    )

    const batches = await mapBoundedConcurrency(
      ranges,
      GEMINI_EMBEDDING_CONCURRENCY,
      (range, _index, signal) =>
        signal.aborted
          ? Promise.reject(createGroupAbortError())
          : this.requestBatch(inputs.slice(range.start, range.end), deadlineMs),
    )

    return batches.flat()
  }

  /**
   * One upstream request, bounded by both the per-request budget and whatever
   * remains of the whole-call budget.
   *
   * Checking the whole-call budget only *between* sub-batches would leave the
   * final request unbounded, so the remaining budget caps this request too.
   */
  private async requestBatch(
    inputs: readonly string[],
    wholeCallDeadlineMs: number,
  ): Promise<Embedding[]> {
    const remainingMs = wholeCallDeadlineMs - this.clock()
    if (remainingMs <= 0) {
      this.logDiagnostic('timeout', inputs.length)
      throw new EmbeddingUpstreamError('EMBEDDING_TIMEOUT')
    }

    // Atomic, estimate-only: request unit and estimated input units are
    // reserved in one operation before the upstream call, so an exhausted
    // budget makes zero calls to Google. The estimate is never reconciled —
    // see `estimateInputUnits`.
    try {
      await this.quota.reserveGeneration(estimateInputUnits(inputs))
    } catch (error) {
      this.logDiagnostic('quota_denied', inputs.length)
      throw new EmbeddingUpstreamError(
        isQuotaExhausted(error)
          ? 'EMBEDDING_RATE_LIMITED'
          : 'EMBEDDING_PROVIDER_FAILURE',
      )
    }

    const requestTimeoutMs = Math.min(
      this.options.requestTimeoutMs,
      remainingMs,
    )

    let response: unknown
    try {
      response = await this.client.embedContent({
        model: GEMINI_EMBEDDING_MODEL,
        // Never a bare `string[]`: the SDK's `tContents()` folds a string array
        // into ONE `Content` with several parts and returns a single aggregated
        // vector. Each input must be its own `Content`.
        contents: inputs.map((text) => ({ parts: [{ text }] })),
        config: {
          outputDimensionality: GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY,
          abortSignal: this.createTimeoutSignal(requestTimeoutMs),
          httpOptions: {
            apiVersion: GEMINI_EMBEDDING_API_VERSION,
            // This adapter owns its own deadline arithmetic; an invisible SDK
            // retry would re-issue a request the quota guard never admitted.
            retryOptions: { attempts: 1 },
          },
        },
      })
    } catch (error) {
      const outcome =
        this.clock() >= wholeCallDeadlineMs
          ? 'timeout'
          : classifyUpstream(error)
      this.logDiagnostic(outcome, inputs.length)
      throw new EmbeddingUpstreamError(UPSTREAM_ERROR_CODES[outcome])
    }

    return this.readEmbeddings(response, inputs.length)
  }

  private readEmbeddings(response: unknown, inputCount: number): Embedding[] {
    if (typeof response !== 'object' || response === null) {
      this.logDiagnostic('malformed_response', inputCount)
      throw new EmbeddingUpstreamError('EMBEDDING_PROVIDER_FAILURE')
    }

    const embeddings: unknown = Reflect.get(response, 'embeddings')
    if (!Array.isArray(embeddings)) {
      this.logDiagnostic('malformed_response', inputCount)
      throw new EmbeddingUpstreamError('EMBEDDING_PROVIDER_FAILURE')
    }

    // One embedding for one input is valid; one embedding for MANY inputs is
    // the SDK's aggregation trap, and would silently persist a single averaged
    // vector against every chunk.
    if (inputCount > 1 && embeddings.length === 1) {
      this.logDiagnostic('aggregated_response', inputCount)
      throw new EmbeddingUpstreamError('EMBEDDING_PROVIDER_FAILURE')
    }

    if (embeddings.length !== inputCount) {
      this.logDiagnostic('count_mismatch', inputCount)
      throw new EmbeddingUpstreamError('EMBEDDING_PROVIDER_FAILURE')
    }

    const vectors: Embedding[] = []
    for (const embedding of embeddings) {
      const values: unknown =
        typeof embedding === 'object' && embedding !== null
          ? Reflect.get(embedding, 'values')
          : undefined

      if (
        !Array.isArray(values) ||
        values.length !== EMBEDDING_DIMENSIONS ||
        !values.every(
          (component) =>
            typeof component === 'number' && Number.isFinite(component),
        )
      ) {
        this.logDiagnostic('invalid_vector', inputCount)
        throw new EmbeddingUpstreamError('EMBEDDING_PROVIDER_FAILURE')
      }

      vectors.push(values as number[])
    }

    this.logDiagnostic('ok', inputCount)
    return vectors
  }

  /**
   * One fixed single-line diagnostic with a closed outcome union.
   *
   * Counts and identifiers only: no credential, prompt, title, text, or vector
   * component may reach a log. `queryProtocol` is carried because it is
   * observable nowhere else — there is no column for it.
   */
  private logDiagnostic(
    outcome: GeminiEmbeddingOutcome,
    inputCount: number,
  ): void {
    const diagnostic = `Gemini embedding request (outcome=${outcome}, inputs=${String(inputCount)}, model=${this.model}, queryProtocol=${this.queryProtocol})`

    if (outcome === 'ok') {
      this.logger.debug(diagnostic)
      return
    }
    if (outcome === 'cancelled' || outcome === 'rate_limited') {
      this.logger.warn(diagnostic)
      return
    }
    this.logger.error(diagnostic)
  }
}

/**
 * A deterministic, deliberately conservative local proxy for input size.
 *
 * It debits UTF-8 byte length of the **final formatted input**, prefix and
 * framing included. It is NOT a documented upper bound on Google's tokenizer
 * count, and it is never reconciled against actual usage: the pinned SDK's
 * Developer-API conversion discards `usageMetadata` entirely, so no actual
 * token count is available to reconcile with. See the pinned-SDK contract test.
 */
export function estimateInputUnits(inputs: readonly string[]): number {
  return inputs.reduce(
    (total, input) => total + Buffer.byteLength(input, 'utf8'),
    0,
  )
}

function isQuotaExhausted(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    Reflect.get(error, 'kind') === 'quota_exhausted'
  )
}

// Only the outcomes `classifyUpstream` can return. Declared as a map rather
// than a nested ternary so adding an outcome without deciding its public code
// fails to compile.
const UPSTREAM_ERROR_CODES = {
  timeout: 'EMBEDDING_TIMEOUT',
  cancelled: 'EMBEDDING_CANCELLED',
  rate_limited: 'EMBEDDING_RATE_LIMITED',
  upstream_failure: 'EMBEDDING_PROVIDER_FAILURE',
} as const satisfies Partial<Record<GeminiEmbeddingOutcome, EmbeddingErrorCode>>

type ThrownOutcome = keyof typeof UPSTREAM_ERROR_CODES

function classifyUpstream(error: unknown): ThrownOutcome {
  if (typeof error !== 'object' || error === null) {
    return 'upstream_failure'
  }

  const name: unknown = Reflect.get(error, 'name')
  if (name === 'AbortError') {
    return 'cancelled'
  }
  if (name === 'TimeoutError') {
    return 'timeout'
  }

  // A provider-side throttle is not a provider failure: it tells the caller to
  // back off, which a generic failure does not. The shared classifier reads a
  // status reflectively when the SDK carries one.
  const { status } = readUpstreamFailure(error, 0)
  if (status === 429) {
    return 'rate_limited'
  }
  if (status !== undefined) {
    return 'upstream_failure'
  }

  // The pinned SDK throws a plain `Error` carrying the status only in its
  // message, so message shape is the *only* signal available. It is used for
  // classification and never retained: the thrown error keeps its fixed
  // message, so no provider text reaches a caller or a log.
  return isRateLimitMessage(Reflect.get(error, 'message'))
    ? 'rate_limited'
    : 'upstream_failure'
}

function isRateLimitMessage(message: unknown): boolean {
  if (typeof message !== 'string') {
    return false
  }
  const normalized = message.toLowerCase()
  return (
    normalized.includes('too many requests') ||
    normalized.includes('429') ||
    normalized.includes('resource_exhausted')
  )
}

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

function isAdapterOptions(
  value: unknown,
): value is GeminiEmbeddingAdapterOptions {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return (
    isPositiveInteger(Reflect.get(value, 'queryTimeoutMs')) &&
    isPositiveInteger(Reflect.get(value, 'documentTimeoutMs')) &&
    isPositiveInteger(Reflect.get(value, 'requestTimeoutMs'))
  )
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isOptionalFunction(value: unknown): boolean {
  return value === undefined || typeof value === 'function'
}
