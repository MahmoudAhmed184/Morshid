export const GROUNDED_COMPLETION_PROMPT_VERSION = 's2-p0-grounded-v1'

export const COMPLETION_PROVIDER_TOKEN = Symbol('CompletionProvider')

export type CompletionProviderName = 'deterministic'

export interface CompletionProviderMetadata {
  readonly provider: CompletionProviderName
  readonly model: string
  readonly supportsStreaming: boolean
}

export interface GroundedCompletionContextChunk {
  readonly materialTitle: string
  readonly chunkIndex: number
  readonly content: string
  readonly rank?: number
  readonly similarity?: number
}

export interface GroundedCompletionRequest {
  readonly studentQuestion: string
  readonly contextChunks: readonly GroundedCompletionContextChunk[]
  readonly promptVersion?: string
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

export type CompletionGuidanceLabel =
  | 'COURSE_GROUNDED'
  | 'GENERAL_NOT_FOUND'
  | 'UNCERTAIN_AWAITING_REVIEW'
  | 'REFUSAL'

export type CompletionFinishReason =
  | 'complete'
  | 'insufficient_context'
  | 'refusal'

export interface CompletionTokenUsage {
  readonly inputTokens?: number
  readonly outputTokens?: number
}

export type CompletionSafeMetadataValue = string | number | boolean | null

export type CompletionSafeMetadata = Readonly<
  Record<string, CompletionSafeMetadataValue>
>

export interface GroundedCompletionResult {
  readonly answer: string
  readonly provider: CompletionProviderName
  readonly model: string
  readonly promptVersion: string
  readonly guidanceLabel: CompletionGuidanceLabel
  readonly finishReason: CompletionFinishReason
  readonly tokenUsage?: CompletionTokenUsage
  readonly metadata?: CompletionSafeMetadata
}

export interface CompletionProvider {
  readonly metadata: CompletionProviderMetadata

  completeGrounded(
    input: GroundedCompletionRequest,
  ): Promise<GroundedCompletionResult>
}
