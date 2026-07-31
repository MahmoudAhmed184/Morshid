import type { CompletionResult } from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import type { CompletionStrategy } from './completion-provider'
import type { GroundedCompletionMessage } from './grounded-completion-envelope'

// Internal seam between the deep CompletionProvider module and a selected
// provider implementation. Callers never prepare prompts or envelopes.
export interface PreparedCompletionRequest {
  readonly messages: readonly [
    GroundedCompletionMessage,
    GroundedCompletionMessage,
  ]
  readonly signal: AbortSignal
  readonly strategy?: CompletionStrategy
  readonly promptVersion?: string
}

export function preparedCompletionStrategy(
  request: PreparedCompletionRequest,
): CompletionStrategy {
  return request.strategy ?? 'GROUNDED_EXPLANATION'
}

export interface CompletionAdapter {
  complete(request: PreparedCompletionRequest): Promise<CompletionResult>
}

// The prepared request is a positional 2-tuple: index 0 carries the
// authoritative system prompt and index 1 carries untrusted student content.
// Nothing in the type records which is which, so a future reordering of
// `buildGroundedCompletionMessages` would silently promote untrusted input to
// the authoritative prompt with no type error and no failing test. Every
// adapter asserts the order at its own trust boundary — before any network
// call or envelope parse — and fails closed. The tuple is read reflectively
// rather than through the declared type because the declaration is exactly
// what a reordering bug would keep satisfying.
export function assertPreparedMessageOrder(
  request: PreparedCompletionRequest,
): void {
  const messages: unknown = Reflect.get(request, 'messages')
  if (
    !isMessagePair(messages) ||
    readMessageRole(messages, 0) !== 'system' ||
    readMessageRole(messages, 1) !== 'user'
  ) {
    throw new CompletionProviderError('COMPLETION_INVALID_REQUEST')
  }
}

function isMessagePair(value: unknown): value is object {
  if (!isObject(value)) {
    return false
  }

  const length: unknown = Reflect.get(value, 'length')
  return Array.isArray(value) && length === 2
}

function readMessageRole(messages: object, index: number): unknown {
  const message: unknown = Reflect.get(messages, String(index))
  return isObject(message) ? Reflect.get(message, 'role') : undefined
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}
