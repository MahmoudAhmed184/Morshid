export const COMPLETION_PROVIDER_TOKEN = Symbol('CompletionProvider')

export const COMPLETION_ERROR_CODES = [
  'COMPLETION_EMPTY_CONTEXT',
  'COMPLETION_INVALID_REQUEST',
  'COMPLETION_INVALID_RESULT',
  'COMPLETION_PROVIDER_FAILURE',
  'COMPLETION_TIMEOUT',
  'COMPLETION_CANCELLED',
  'COMPLETION_PROVIDER_UNSUPPORTED',
  'COMPLETION_CONFIGURATION_INVALID',
] as const

export type CompletionErrorCode = (typeof COMPLETION_ERROR_CODES)[number]

export interface CompletionContextEntry {
  readonly sourceTitle: string
  readonly chunkIndex: number
  readonly content: string
}

export type NonEmptyCompletionContext = readonly [
  CompletionContextEntry,
  ...CompletionContextEntry[],
]

export interface CompletionRequest {
  readonly studentQuestion: string
  readonly context: NonEmptyCompletionContext
  readonly signal?: AbortSignal
}

export interface CompletionResult {
  readonly content: string
  readonly provider: string
  readonly model: string
  readonly promptVersion: string
  readonly inputTokens?: number
  readonly outputTokens?: number
}

export interface CompletionProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>
}

const SAFE_ERROR_MESSAGES = {
  COMPLETION_EMPTY_CONTEXT: 'Completion requires authorized context',
  COMPLETION_INVALID_REQUEST: 'Completion request is invalid',
  COMPLETION_INVALID_RESULT: 'Completion result is invalid',
  COMPLETION_PROVIDER_FAILURE: 'Completion provider failed',
  COMPLETION_TIMEOUT: 'Completion timed out',
  COMPLETION_CANCELLED: 'Completion was cancelled',
  COMPLETION_PROVIDER_UNSUPPORTED: 'Completion provider is unsupported',
  COMPLETION_CONFIGURATION_INVALID: 'Completion configuration is invalid',
} as const satisfies Record<CompletionErrorCode, string>

// The fixed message and code are the only diagnostic data retained. In
// particular, provider errors, abort reasons, prompts, messages, chunks, and
// credentials must never be attached as a cause or copied onto this object.
export class CompletionProviderError extends Error {
  readonly code: CompletionErrorCode

  constructor(code: CompletionErrorCode) {
    super(SAFE_ERROR_MESSAGES[code])
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'CompletionProviderError',
    })
    this.code = code
  }
}
