import {
  CompletionProviderFailureError,
} from './completion-errors'
import type {
  CompletionProvider,
  CompletionProviderMetadata,
  GroundedCompletionContextChunk,
  GroundedCompletionRequest,
  GroundedCompletionResult,
} from './completion-provider'
import { buildGroundedCompletionEnvelope } from './grounded-completion-envelope'

export const DETERMINISTIC_COMPLETION_MODEL =
  'morshid-deterministic-completion-v1'

export interface DeterministicCompletionProviderOptions {
  readonly model?: string
  readonly failOnComplete?: boolean
}

interface RankedContextChunk {
  readonly chunk: GroundedCompletionContextChunk
  readonly sourceIndex: number
  readonly overlap: number
}

const MAX_CONTEXT_SNIPPET_CHARACTERS = 360
const INSUFFICIENT_CONTEXT_ANSWER =
  'I could not find enough authorized course context to answer this question.'
const SEARCH_STOP_WORDS = new Set([
  'about',
  'and',
  'are',
  'can',
  'does',
  'for',
  'from',
  'how',
  'the',
  'this',
  'what',
  'when',
  'where',
  'why',
  'with',
])

export class DeterministicCompletionProvider implements CompletionProvider {
  readonly metadata: CompletionProviderMetadata

  constructor(
    private readonly options: DeterministicCompletionProviderOptions = {},
  ) {
    this.metadata = {
      provider: 'deterministic',
      model: options.model ?? DETERMINISTIC_COMPLETION_MODEL,
      supportsStreaming: false,
    }
  }

  async completeGrounded(
    input: GroundedCompletionRequest,
  ): Promise<GroundedCompletionResult> {
    if (this.options.failOnComplete === true) {
      throw new CompletionProviderFailureError(this.metadata.provider)
    }

    const envelope = buildGroundedCompletionEnvelope(input)
    const selected = selectMostRelevantChunk(
      input.studentQuestion,
      input.contextChunks,
    )

    if (selected === null) {
      return this.buildInsufficientContextResult(envelope)
    }

    const snippet = compactContextSnippet(selected.chunk.content)
    if (snippet === '') {
      return this.buildInsufficientContextResult(envelope)
    }

    const answer = [
      'Based on the authorized course context:',
      snippet,
      `Source ${String(selected.sourceIndex)}, chunk ${String(selected.chunk.chunkIndex)}.`,
    ].join(' ')

    return {
      answer,
      provider: this.metadata.provider,
      model: this.metadata.model,
      promptVersion: envelope.promptVersion,
      guidanceLabel: 'COURSE_GROUNDED',
      finishReason: 'complete',
      tokenUsage: {
        inputTokens: estimateTokens(envelope.prompt),
        outputTokens: estimateTokens(answer),
      },
      metadata: {
        contextChunkCount: envelope.contextChunkCount,
        selectedSourceIndex: selected.sourceIndex,
        selectedChunkIndex: selected.chunk.chunkIndex,
        supportsStreaming: this.metadata.supportsStreaming,
      },
    }
  }

  private buildInsufficientContextResult(envelope: {
    readonly promptVersion: string
    readonly prompt: string
    readonly contextChunkCount: number
  }): GroundedCompletionResult {
    return {
      answer: INSUFFICIENT_CONTEXT_ANSWER,
      provider: this.metadata.provider,
      model: this.metadata.model,
      promptVersion: envelope.promptVersion,
      guidanceLabel: 'GENERAL_NOT_FOUND',
      finishReason: 'insufficient_context',
      tokenUsage: {
        inputTokens: estimateTokens(envelope.prompt),
        outputTokens: estimateTokens(INSUFFICIENT_CONTEXT_ANSWER),
      },
      metadata: {
        contextChunkCount: envelope.contextChunkCount,
        supportsStreaming: this.metadata.supportsStreaming,
      },
    }
  }
}

function selectMostRelevantChunk(
  studentQuestion: string,
  contextChunks: readonly GroundedCompletionContextChunk[],
): RankedContextChunk | null {
  const questionTerms = toSearchTerms(studentQuestion)
  if (questionTerms.size === 0) {
    return null
  }

  const ranked = contextChunks
    .map((chunk, index): RankedContextChunk => {
      const contentTerms = toSearchTerms(chunk.content)
      let overlap = 0
      for (const term of questionTerms) {
        if (contentTerms.has(term)) {
          overlap += 1
        }
      }

      return { chunk, sourceIndex: index + 1, overlap }
    })
    .filter((candidate) => candidate.overlap > 0)
    .sort((left, right) => {
      if (right.overlap !== left.overlap) {
        return right.overlap - left.overlap
      }

      const leftRank = left.chunk.rank ?? Number.MAX_SAFE_INTEGER
      const rightRank = right.chunk.rank ?? Number.MAX_SAFE_INTEGER
      if (leftRank !== rightRank) {
        return leftRank - rightRank
      }

      return left.sourceIndex - right.sourceIndex
    })

  return ranked[0] ?? null
}

function toSearchTerms(text: string): Set<string> {
  return new Set(
    text
      .normalize('NFKC')
      .toLowerCase()
      .match(/[a-z][a-z0-9_]{2,}/gu)
      ?.filter((term) => !SEARCH_STOP_WORDS.has(term)) ?? [],
  )
}

function compactContextSnippet(content: string): string {
  const normalized = content.normalize('NFKC').trim().replace(/\s+/gu, ' ')
  const conceptualSentences = normalized
    .split(/(?<=[.!?])\s+/u)
    .filter((sentence) => !looksLikeInstructionInjection(sentence))
    .join(' ')
    .trim()

  if (conceptualSentences.length <= MAX_CONTEXT_SNIPPET_CHARACTERS) {
    return conceptualSentences
  }

  return `${conceptualSentences
    .slice(0, MAX_CONTEXT_SNIPPET_CHARACTERS - 3)
    .trim()}...`
}

function looksLikeInstructionInjection(sentence: string): boolean {
  return /\b(api key|credential|developer message|ignore previous|reveal|secret|system prompt|system rules)\b/iu.test(
    sentence,
  )
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/u).length * 1.25))
}
