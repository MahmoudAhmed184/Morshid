export const DEFAULT_SOCRATIC_CHAT_REQUEST_TIMEOUT_MS = 120_000
export const MAX_SOCRATIC_CHAT_REQUEST_TIMEOUT_MS = 300_000
export const MIN_REQUEST_BUDGET_TO_START_WORK_MS = 100

export interface RequestBudgetOptions {
  readonly signal?: AbortSignal
  readonly deadlineAt?: number
}

export interface RequestBudget extends RequestBudgetOptions {
  readonly signal: AbortSignal
  readonly deadlineAt: number
}

export interface RequestBudgetHandle extends RequestBudget {
  dispose(): void
}

export class RequestBudgetExceededError extends Error {
  constructor() {
    super('The request budget is no longer available')
    this.name = 'RequestBudgetExceededError'
  }
}

export interface LifecycleEventSource {
  on(event: string, listener: () => void): unknown
  removeListener(event: string, listener: () => void): unknown
}

export interface RequestLifecycleSources {
  readonly request?: LifecycleEventSource & { readonly complete?: boolean }
  readonly response?: LifecycleEventSource
}

export function createRequestBudget(
  timeoutMs: number,
  sources: RequestLifecycleSources = {},
): RequestBudgetHandle {
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > MAX_SOCRATIC_CHAT_REQUEST_TIMEOUT_MS
  ) {
    throw new TypeError('Invalid request timeout')
  }

  const controller = new AbortController()
  const deadlineAt = Date.now() + timeoutMs
  let responseFinished = false

  const abort = (): void => {
    if (!controller.signal.aborted) {
      controller.abort(new RequestBudgetExceededError())
    }
  }
  const timer = setTimeout(abort, timeoutMs)

  const onRequestAborted = (): void => {
    abort()
  }
  const onRequestClosed = (): void => {
    if (sources.request?.complete !== true) {
      abort()
    }
  }
  const onResponseFinished = (): void => {
    responseFinished = true
  }
  const onResponseClosed = (): void => {
    if (!responseFinished) {
      abort()
    }
  }

  sources.request?.on('aborted', onRequestAborted)
  sources.request?.on('close', onRequestClosed)
  sources.response?.on('finish', onResponseFinished)
  sources.response?.on('close', onResponseClosed)

  return {
    signal: controller.signal,
    deadlineAt,
    dispose: (): void => {
      clearTimeout(timer)
      sources.request?.removeListener('aborted', onRequestAborted)
      sources.request?.removeListener('close', onRequestClosed)
      sources.response?.removeListener('finish', onResponseFinished)
      sources.response?.removeListener('close', onResponseClosed)
    },
  }
}

export function assertRequestBudget(
  budget: RequestBudgetOptions | undefined,
  minimumMs = MIN_REQUEST_BUDGET_TO_START_WORK_MS,
): void {
  if (budget === undefined) {
    return
  }

  if (
    budget.signal?.aborted === true ||
    (budget.deadlineAt !== undefined &&
      budget.deadlineAt - Date.now() < minimumMs)
  ) {
    throw new RequestBudgetExceededError()
  }
}

export function remainingRequestBudget(
  budget: RequestBudgetOptions | undefined,
): number | undefined {
  if (budget === undefined) {
    return undefined
  }

  return budget.deadlineAt === undefined
    ? undefined
    : Math.max(0, budget.deadlineAt - Date.now())
}
