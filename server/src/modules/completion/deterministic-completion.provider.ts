import { Injectable, Optional } from '@nestjs/common'

import type {
  CompletionProvider,
  CompletionRequest,
  CompletionResult,
} from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import { GROUNDED_COMPLETION_PROMPT_VERSION } from './grounded-completion-envelope'

export const DETERMINISTIC_COMPLETION_PROVIDER = 'deterministic'
export const DETERMINISTIC_COMPLETION_MODEL = 'deterministic-completion-v1'
export const DETERMINISTIC_EVIDENCE_EXCERPT_CODE_POINTS = 240

const DETERMINISTIC_HEADER =
  'Grounded guidance based only on the supplied authorized context:'

export type DeterministicCompletionMode =
  'complete' | 'fail' | 'wait-until-aborted'

// Offline provider for CI, local development, and the backup demo. Its output
// is an evidence digest rather than generated prose: every variable character
// comes from the supplied context, and the student question is never echoed.
@Injectable()
export class DeterministicCompletionProvider implements CompletionProvider {
  constructor(
    @Optional() private readonly mode: DeterministicCompletionMode = 'complete',
  ) {}

  complete(request: CompletionRequest): Promise<CompletionResult> {
    if (request.signal?.aborted === true) {
      return Promise.reject(new CompletionProviderError('COMPLETION_CANCELLED'))
    }

    if (this.mode === 'fail') {
      return Promise.reject(new Error('deterministic controlled failure'))
    }

    if (this.mode === 'wait-until-aborted') {
      return this.waitUntilAborted(request.signal)
    }

    const evidence = request.context.map((entry, index) => {
      const excerpt = takeCodePoints(
        normalizeCompletionText(entry.content),
        DETERMINISTIC_EVIDENCE_EXCERPT_CODE_POINTS,
      )
      const sourceTitle = normalizeCompletionText(entry.sourceTitle)

      return `${String(index + 1)}. ${JSON.stringify(excerpt)} — ${JSON.stringify(sourceTitle)}, chunk ${String(entry.chunkIndex)}`
    })

    return Promise.resolve({
      content: [DETERMINISTIC_HEADER, ...evidence].join('\n'),
      provider: DETERMINISTIC_COMPLETION_PROVIDER,
      model: DETERMINISTIC_COMPLETION_MODEL,
      promptVersion: GROUNDED_COMPLETION_PROMPT_VERSION,
    })
  }

  private waitUntilAborted(signal: AbortSignal | undefined): Promise<never> {
    if (signal === undefined) {
      return Promise.reject(
        new CompletionProviderError('COMPLETION_INVALID_REQUEST'),
      )
    }

    return new Promise((_, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          reject(new CompletionProviderError('COMPLETION_CANCELLED'))
        },
        { once: true },
      )
    })
  }
}

export function normalizeCompletionText(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/gu, ' ')
}

function takeCodePoints(text: string, limit: number): string {
  return Array.from(text).slice(0, limit).join('')
}
