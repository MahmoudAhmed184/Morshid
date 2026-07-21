import type {
  CompletionProvider,
  CompletionRequest,
  CompletionResult,
} from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import type {
  CompletionAdapter,
  PreparedCompletionRequest,
} from './completion-adapter'
import {
  hasAtMostCodePoints,
  readAbortSignalAborted,
  snapshotCompletionRequest,
} from './completion-input'
import {
  GROUNDED_COMPLETION_PROMPT_VERSION,
  buildGroundedCompletionMessages,
} from './grounded-completion-envelope'

export const DEFAULT_COMPLETION_TIMEOUT_MS = 30_000
export const MAX_COMPLETION_TIMEOUT_MS = 120_000
export const MAX_COMPLETION_OUTPUT_CODE_POINTS = 16_000

const MAX_PROVIDER_LENGTH = 80
const MAX_MODEL_LENGTH = 120
const MAX_PROMPT_VERSION_LENGTH = 80
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
    private readonly inner: CompletionAdapter,
    private readonly timeoutMs = DEFAULT_COMPLETION_TIMEOUT_MS,
    private readonly timeoutSignalFactory: CompletionTimeoutSignalFactory = defaultCompletionTimeoutSignalFactory,
  ) {}

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const requestSnapshot = snapshotCompletionRequest(request)

    let callerAborted: boolean
    try {
      callerAborted =
        requestSnapshot.signal !== undefined &&
        readAbortSignalAborted(requestSnapshot.signal)
    } catch {
      throw new CompletionProviderError('COMPLETION_INVALID_REQUEST')
    }
    if (callerAborted) {
      throw new CompletionProviderError('COMPLETION_CANCELLED')
    }

    let timeoutSignal: AbortSignal
    let composedSignal: AbortSignal
    try {
      timeoutSignal = this.timeoutSignalFactory(this.timeoutMs)
      if (!(timeoutSignal instanceof AbortSignal)) {
        throw new TypeError('Invalid timeout signal')
      }
      readAbortSignalAborted(timeoutSignal)
      composedSignal = AbortSignal.any([
        ...(requestSnapshot.signal === undefined
          ? []
          : [requestSnapshot.signal]),
        timeoutSignal,
      ])
    } catch {
      throw new CompletionProviderError('COMPLETION_PROVIDER_FAILURE')
    }

    const providerRequest = Object.freeze<PreparedCompletionRequest>({
      messages: buildGroundedCompletionMessages(requestSnapshot),
      signal: composedSignal,
    })
    const rawResult = await this.executeProvider(
      providerRequest,
      requestSnapshot.signal,
      timeoutSignal,
    )

    return validateResultSafely(rawResult)
  }

  private executeProvider(
    request: PreparedCompletionRequest,
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): Promise<unknown> {
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
          reject(new CompletionProviderError('COMPLETION_CANCELLED'))
        })
      }
      const onTimeout = () => {
        finish(() => {
          reject(new CompletionProviderError('COMPLETION_TIMEOUT'))
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
          reject(new CompletionProviderError('COMPLETION_PROVIDER_FAILURE'))
        })
        return
      }

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

function validateResultSafely(result: unknown): CompletionResult {
  try {
    if (!hasOnlyKeys(result, RESULT_KEYS)) {
      throw new TypeError('Invalid result shape')
    }

    const snapshot = {
      content: Reflect.get(result, 'content'),
      provider: Reflect.get(result, 'provider'),
      model: Reflect.get(result, 'model'),
      promptVersion: Reflect.get(result, 'promptVersion'),
      inputTokens: Reflect.get(result, 'inputTokens'),
      outputTokens: Reflect.get(result, 'outputTokens'),
    }

    if (
      !isNonBlankString(snapshot.content) ||
      !hasAtMostCodePoints(
        snapshot.content,
        MAX_COMPLETION_OUTPUT_CODE_POINTS,
      ) ||
      !isBoundedMetadata(snapshot.provider, MAX_PROVIDER_LENGTH) ||
      !isBoundedMetadata(snapshot.model, MAX_MODEL_LENGTH) ||
      !isBoundedMetadata(snapshot.promptVersion, MAX_PROMPT_VERSION_LENGTH) ||
      snapshot.promptVersion !== GROUNDED_COMPLETION_PROMPT_VERSION ||
      !isOptionalTokenCount(snapshot.inputTokens) ||
      !isOptionalTokenCount(snapshot.outputTokens)
    ) {
      throw new TypeError('Invalid result values')
    }

    return Object.freeze({
      content: snapshot.content,
      provider: snapshot.provider,
      model: snapshot.model,
      promptVersion: snapshot.promptVersion,
      ...(snapshot.inputTokens === undefined
        ? {}
        : { inputTokens: snapshot.inputTokens }),
      ...(snapshot.outputTokens === undefined
        ? {}
        : { outputTokens: snapshot.outputTokens }),
    })
  } catch {
    throw new CompletionProviderError('COMPLETION_INVALID_RESULT')
  }
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
