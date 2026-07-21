import {
  CompletionCancelledError,
  CompletionProviderError,
  CompletionProviderFailureError,
  CompletionProviderTimeoutError,
} from './completion-errors'
import type {
  CompletionProvider,
  CompletionProviderMetadata,
  GroundedCompletionRequest,
  GroundedCompletionResult,
} from './completion-provider'

export interface ManagedCompletionProviderOptions {
  readonly defaultTimeoutMs: number
}

export class ManagedCompletionProvider implements CompletionProvider {
  constructor(
    private readonly inner: CompletionProvider,
    private readonly options: ManagedCompletionProviderOptions,
  ) {}

  get metadata(): CompletionProviderMetadata {
    return this.inner.metadata
  }

  async completeGrounded(
    input: GroundedCompletionRequest,
  ): Promise<GroundedCompletionResult> {
    const timeoutMs = resolveTimeoutMs(
      input.timeoutMs,
      this.options.defaultTimeoutMs,
    )

    if (input.signal?.aborted === true) {
      throw new CompletionCancelledError()
    }

    let timeoutId: NodeJS.Timeout | undefined
    let removeAbortListener: (() => void) | undefined

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new CompletionProviderTimeoutError(timeoutMs))
      }, timeoutMs)
    })

    const cancellation = new Promise<never>((_, reject) => {
      if (input.signal === undefined) {
        return
      }

      const abort = () => reject(new CompletionCancelledError())
      input.signal.addEventListener('abort', abort, { once: true })
      removeAbortListener = () =>
        input.signal?.removeEventListener('abort', abort)
    })

    try {
      return await Promise.race([
        this.inner.completeGrounded(input),
        timeout,
        cancellation,
      ])
    } catch (error: unknown) {
      if (error instanceof CompletionProviderError) {
        throw error
      }

      throw new CompletionProviderFailureError(this.metadata.provider)
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      removeAbortListener?.()
    }
  }
}

function resolveTimeoutMs(
  requestTimeoutMs: number | undefined,
  defaultTimeoutMs: number,
): number {
  if (
    requestTimeoutMs !== undefined &&
    Number.isInteger(requestTimeoutMs) &&
    requestTimeoutMs > 0
  ) {
    return requestTimeoutMs
  }

  return defaultTimeoutMs
}
