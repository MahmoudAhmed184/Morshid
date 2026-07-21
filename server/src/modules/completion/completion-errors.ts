import type { CompletionSafeMetadata } from './completion-provider'

export type CompletionErrorCode =
  | 'COMPLETION_EMPTY_CONTEXT'
  | 'COMPLETION_BLANK_QUESTION'
  | 'COMPLETION_MALFORMED_RESULT'
  | 'COMPLETION_PROVIDER_TIMEOUT'
  | 'COMPLETION_PROVIDER_FAILURE'
  | 'COMPLETION_CANCELLED'
  | 'COMPLETION_UNSUPPORTED_PROVIDER'

export class CompletionProviderError extends Error {
  constructor(
    readonly code: CompletionErrorCode,
    readonly safeMessage: string,
    readonly retryable: boolean,
    readonly safeMetadata: CompletionSafeMetadata = {},
  ) {
    super(safeMessage)
    this.name = 'CompletionProviderError'
  }
}

export class EmptyCompletionContextError extends CompletionProviderError {
  constructor() {
    super(
      'COMPLETION_EMPTY_CONTEXT',
      'Completion requires at least one authorized context chunk',
      false,
    )
    this.name = 'EmptyCompletionContextError'
  }
}

export class BlankCompletionQuestionError extends CompletionProviderError {
  constructor() {
    super(
      'COMPLETION_BLANK_QUESTION',
      'Completion requires a non-empty student question',
      false,
    )
    this.name = 'BlankCompletionQuestionError'
  }
}

export type MalformedCompletionResultReason =
  | 'empty_answer'
  | 'missing_provider'
  | 'missing_model'
  | 'missing_prompt_version'
  | 'invalid_finish_reason'
  | 'invalid_guidance_label'
  | 'invalid_token_usage'
  | 'invalid_metadata'

export class MalformedCompletionResultError extends CompletionProviderError {
  constructor(readonly reason: MalformedCompletionResultReason) {
    super(
      'COMPLETION_MALFORMED_RESULT',
      'Completion provider returned a malformed result',
      false,
      { reason },
    )
    this.name = 'MalformedCompletionResultError'
  }
}

export class CompletionProviderTimeoutError extends CompletionProviderError {
  constructor(readonly timeoutMs: number) {
    super(
      'COMPLETION_PROVIDER_TIMEOUT',
      'Completion provider timed out',
      true,
      { timeoutMs },
    )
    this.name = 'CompletionProviderTimeoutError'
  }
}

export class CompletionProviderFailureError extends CompletionProviderError {
  constructor(readonly provider: string) {
    super('COMPLETION_PROVIDER_FAILURE', 'Completion provider failed', true, {
      provider,
    })
    this.name = 'CompletionProviderFailureError'
  }
}

export class CompletionCancelledError extends CompletionProviderError {
  constructor() {
    super('COMPLETION_CANCELLED', 'Completion request was cancelled', false)
    this.name = 'CompletionCancelledError'
  }
}

export class UnsupportedCompletionProviderError extends CompletionProviderError {
  constructor(readonly provider: string) {
    super(
      'COMPLETION_UNSUPPORTED_PROVIDER',
      'Unsupported completion provider',
      false,
      { provider },
    )
    this.name = 'UnsupportedCompletionProviderError'
  }
}
