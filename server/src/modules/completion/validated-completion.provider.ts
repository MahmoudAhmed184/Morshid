import type {
  CompletionFinishReason,
  CompletionGuidanceLabel,
  CompletionProvider,
  CompletionProviderMetadata,
  CompletionSafeMetadata,
  CompletionSafeMetadataValue,
  GroundedCompletionRequest,
  GroundedCompletionResult,
} from './completion-provider'
import { MalformedCompletionResultError } from './completion-errors'

const VALID_FINISH_REASONS = new Set<CompletionFinishReason>([
  'complete',
  'insufficient_context',
  'refusal',
])

const VALID_GUIDANCE_LABELS = new Set<CompletionGuidanceLabel>([
  'COURSE_GROUNDED',
  'GENERAL_NOT_FOUND',
  'UNCERTAIN_AWAITING_REVIEW',
  'REFUSAL',
])

export class ValidatedCompletionProvider implements CompletionProvider {
  constructor(private readonly inner: CompletionProvider) {}

  get metadata(): CompletionProviderMetadata {
    return this.inner.metadata
  }

  async completeGrounded(
    input: GroundedCompletionRequest,
  ): Promise<GroundedCompletionResult> {
    const result = await this.inner.completeGrounded(input)
    validateCompletionResult(result)

    return result
  }
}

export function validateCompletionResult(result: unknown): void {
  if (!isRecord(result)) {
    throw new MalformedCompletionResultError('missing_provider')
  }

  if (typeof result.answer !== 'string' || result.answer.trim() === '') {
    throw new MalformedCompletionResultError('empty_answer')
  }

  if (result.provider !== 'deterministic') {
    throw new MalformedCompletionResultError('missing_provider')
  }

  if (typeof result.model !== 'string' || result.model.trim() === '') {
    throw new MalformedCompletionResultError('missing_model')
  }

  if (
    typeof result.promptVersion !== 'string' ||
    result.promptVersion.trim() === ''
  ) {
    throw new MalformedCompletionResultError('missing_prompt_version')
  }

  if (
    typeof result.finishReason !== 'string' ||
    !VALID_FINISH_REASONS.has(result.finishReason as CompletionFinishReason)
  ) {
    throw new MalformedCompletionResultError('invalid_finish_reason')
  }

  if (
    typeof result.guidanceLabel !== 'string' ||
    !VALID_GUIDANCE_LABELS.has(result.guidanceLabel as CompletionGuidanceLabel)
  ) {
    throw new MalformedCompletionResultError('invalid_guidance_label')
  }

  if (result.tokenUsage !== undefined) {
    if (!isRecord(result.tokenUsage)) {
      throw new MalformedCompletionResultError('invalid_token_usage')
    }

    validateTokenCount(result.tokenUsage.inputTokens)
    validateTokenCount(result.tokenUsage.outputTokens)
  }

  if (result.metadata !== undefined && !isSafeMetadata(result.metadata)) {
    throw new MalformedCompletionResultError('invalid_metadata')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateTokenCount(value: unknown): void {
  if (value === undefined) {
    return
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    !Number.isFinite(value)
  ) {
    throw new MalformedCompletionResultError('invalid_token_usage')
  }
}

function isSafeMetadata(metadata: unknown): metadata is CompletionSafeMetadata {
  if (
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    metadata === null
  ) {
    return false
  }

  return Object.entries(metadata).every(
    ([key, value]) => key.trim() !== '' && isSafeMetadataValue(value),
  )
}

function isSafeMetadataValue(
  value: unknown,
): value is CompletionSafeMetadataValue {
  if (value === null) {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  return typeof value === 'string' || typeof value === 'boolean'
}
