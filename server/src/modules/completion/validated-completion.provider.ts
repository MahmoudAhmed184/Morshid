import type {
  CompletionContextEntry,
  CompletionProvider,
  CompletionRequest,
  CompletionResult,
  NonEmptyCompletionContext,
} from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import { GROUNDED_COMPLETION_PROMPT_VERSION } from './grounded-completion-envelope'

export const DEFAULT_COMPLETION_TIMEOUT_MS = 30_000

const MAX_PROVIDER_LENGTH = 80
const MAX_MODEL_LENGTH = 120
const MAX_PROMPT_VERSION_LENGTH = 80
const CONTEXT_ENTRY_KEYS = ['sourceTitle', 'chunkIndex', 'content'] as const
const RESULT_KEYS = [
  'content',
  'provider',
  'model',
  'promptVersion',
  'inputTokens',
  'outputTokens',
] as const

export type CompletionTimeoutSignalFactory = (timeoutMs: number) => AbortSignal

export const defaultCompletionTimeoutSignalFactory: CompletionTimeoutSignalFactory =
  (timeoutMs) => AbortSignal.timeout(timeoutMs)

// The sole boundary around provider adapters. It validates and minimizes both
// directions, composes cancellation with a deadline, and converts every
// adapter failure into the fixed public error model without retaining causes.
export class ValidatedCompletionProvider implements CompletionProvider {
  constructor(
    private readonly inner: CompletionProvider,
    private readonly timeoutMs = DEFAULT_COMPLETION_TIMEOUT_MS,
    private readonly timeoutSignalFactory: CompletionTimeoutSignalFactory = defaultCompletionTimeoutSignalFactory,
  ) {}

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    validateRequestSafely(request)

    if (request.signal?.aborted === true) {
      throw new CompletionProviderError('COMPLETION_CANCELLED')
    }

    let timeoutSignal: AbortSignal
    let composedSignal: AbortSignal
    try {
      timeoutSignal = this.timeoutSignalFactory(this.timeoutMs)
      if (!(timeoutSignal instanceof AbortSignal)) {
        throw new TypeError('Invalid timeout signal')
      }
      composedSignal = AbortSignal.any([
        ...(request.signal === undefined ? [] : [request.signal]),
        timeoutSignal,
      ])
    } catch {
      throw new CompletionProviderError('COMPLETION_PROVIDER_FAILURE')
    }

    const providerRequest = minimizeRequest(request, composedSignal)
    const rawResult = await this.executeProvider(
      providerRequest,
      request.signal,
      timeoutSignal,
      composedSignal,
    )

    return validateResultSafely(rawResult)
  }

  private executeProvider(
    request: CompletionRequest,
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
    composedSignal: AbortSignal,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let settled = false

      const finish = (settle: () => void) => {
        if (settled) {
          return
        }
        settled = true
        composedSignal.removeEventListener('abort', onAbort)
        settle()
      }
      const onAbort = () => {
        finish(() => {
          reject(abortError(callerSignal, timeoutSignal))
        })
      }

      if (composedSignal.aborted) {
        onAbort()
        return
      }

      composedSignal.addEventListener('abort', onAbort, { once: true })

      let pending: Promise<CompletionResult>
      try {
        pending = Promise.resolve(this.inner.complete(request))
      } catch {
        finish(() => {
          reject(new CompletionProviderError('COMPLETION_PROVIDER_FAILURE'))
        })
        return
      }

      void pending.then(
        (result) => {
          finish(() => {
            resolve(result)
          })
        },
        () => {
          finish(() => {
            reject(new CompletionProviderError('COMPLETION_PROVIDER_FAILURE'))
          })
        },
      )
    })
  }
}

function validateRequestSafely(request: CompletionRequest): void {
  try {
    if (!isRecord(request) || !isNonBlankString(request.studentQuestion)) {
      throw new CompletionProviderError('COMPLETION_INVALID_REQUEST')
    }
    if (!Array.isArray(request.context)) {
      throw new CompletionProviderError('COMPLETION_INVALID_REQUEST')
    }
    if (request.context.length === 0) {
      throw new CompletionProviderError('COMPLETION_EMPTY_CONTEXT')
    }
    if (
      request.signal !== undefined &&
      !(request.signal instanceof AbortSignal)
    ) {
      throw new CompletionProviderError('COMPLETION_INVALID_REQUEST')
    }

    for (const entry of request.context as readonly unknown[]) {
      if (
        !hasOnlyKeys(entry, CONTEXT_ENTRY_KEYS) ||
        !isNonBlankString(entry.sourceTitle) ||
        !Number.isSafeInteger(entry.chunkIndex) ||
        (entry.chunkIndex as number) < 0 ||
        !isNonBlankString(entry.content)
      ) {
        throw new CompletionProviderError('COMPLETION_INVALID_REQUEST')
      }
    }
  } catch (error) {
    if (error instanceof CompletionProviderError) {
      throw error
    }
    throw new CompletionProviderError('COMPLETION_INVALID_REQUEST')
  }
}

function validateResultSafely(result: unknown): CompletionResult {
  try {
    if (
      !hasOnlyKeys(result, RESULT_KEYS) ||
      !isNonBlankString(result.content) ||
      !isBoundedMetadata(result.provider, MAX_PROVIDER_LENGTH) ||
      !isBoundedMetadata(result.model, MAX_MODEL_LENGTH) ||
      !isBoundedMetadata(result.promptVersion, MAX_PROMPT_VERSION_LENGTH) ||
      result.promptVersion !== GROUNDED_COMPLETION_PROMPT_VERSION ||
      !isOptionalTokenCount(result.inputTokens) ||
      !isOptionalTokenCount(result.outputTokens)
    ) {
      throw new CompletionProviderError('COMPLETION_INVALID_RESULT')
    }

    return {
      content: result.content,
      provider: result.provider,
      model: result.model,
      promptVersion: result.promptVersion,
      ...(result.inputTokens === undefined
        ? {}
        : { inputTokens: result.inputTokens }),
      ...(result.outputTokens === undefined
        ? {}
        : { outputTokens: result.outputTokens }),
    }
  } catch (error) {
    if (error instanceof CompletionProviderError) {
      throw error
    }
    throw new CompletionProviderError('COMPLETION_INVALID_RESULT')
  }
}

function minimizeRequest(
  request: CompletionRequest,
  signal: AbortSignal,
): CompletionRequest {
  const [first, ...rest] = request.context
  const context: NonEmptyCompletionContext = [
    minimizeContextEntry(first),
    ...rest.map(minimizeContextEntry),
  ]

  return Object.freeze({
    studentQuestion: request.studentQuestion,
    context: Object.freeze(context),
    signal,
  })
}

function minimizeContextEntry(
  entry: CompletionContextEntry,
): CompletionContextEntry {
  return Object.freeze({
    sourceTitle: entry.sourceTitle,
    chunkIndex: entry.chunkIndex,
    content: entry.content,
  })
}

function abortError(
  callerSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
): CompletionProviderError {
  return new CompletionProviderError(
    callerSignal?.aborted === true
      ? 'COMPLETION_CANCELLED'
      : timeoutSignal.aborted
        ? 'COMPLETION_TIMEOUT'
        : 'COMPLETION_PROVIDER_FAILURE',
  )
}

function hasOnlyKeys<const Key extends string>(
  value: unknown,
  allowedKeys: readonly Key[],
): value is Record<Key, unknown> {
  if (!isRecord(value)) {
    return false
  }

  const ownKeys = Reflect.ownKeys(value)
  return ownKeys.every(
    (key) => typeof key === 'string' && allowedKeys.includes(key as Key),
  )
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isBoundedMetadata(value: unknown, maxLength: number): value is string {
  return isNonBlankString(value) && value.length <= maxLength
}

function isOptionalTokenCount(value: unknown): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
  )
}
