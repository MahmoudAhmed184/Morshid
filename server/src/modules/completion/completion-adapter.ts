import type { CompletionResult } from './completion-provider'
import type { GroundedCompletionMessage } from './grounded-completion-envelope'

// Internal seam between the deep CompletionProvider module and a selected
// provider implementation. Callers never prepare prompts or envelopes.
export interface PreparedCompletionRequest {
  readonly messages: readonly [
    GroundedCompletionMessage,
    GroundedCompletionMessage,
  ]
  readonly signal: AbortSignal
}

export interface CompletionAdapter {
  complete(request: PreparedCompletionRequest): Promise<CompletionResult>
}
