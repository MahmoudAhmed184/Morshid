import { Injectable } from '@nestjs/common'

import { normalizeDeterministicText } from '../../common/text/normalize-deterministic-text'
import type {
  CompletionAdapter,
  PreparedCompletionRequest,
} from './completion-adapter'
import type { CompletionResult } from './completion-provider'
import { CompletionProviderError } from './completion-provider'
import {
  GROUNDED_COMPLETION_PROMPT_VERSION,
  parseGroundedCompletionInputEnvelope,
} from './grounded-completion-envelope'

export const DETERMINISTIC_COMPLETION_PROVIDER = 'deterministic'
export const DETERMINISTIC_COMPLETION_MODEL = 'deterministic-completion-v1'
export const DETERMINISTIC_EVIDENCE_EXCERPT_CODE_POINTS = 240

const DETERMINISTIC_HEADER =
  'Grounded guidance based only on the supplied authorized context:'

// Offline provider for CI, local development, and the backup demo. Its output
// is an evidence digest rather than generated prose: every variable character
// comes from the supplied context, and the student question is never echoed.
@Injectable()
export class DeterministicCompletionProvider implements CompletionAdapter {
  complete(request: PreparedCompletionRequest): Promise<CompletionResult> {
    if (request.signal.aborted) {
      return Promise.reject(new CompletionProviderError('COMPLETION_CANCELLED'))
    }

    const input = parseGroundedCompletionInputEnvelope(
      request.messages[1].content,
    )
    const evidence = input.context.map((entry, index) => {
      const excerpt = takeCodePoints(
        normalizeDeterministicText(entry.content),
        DETERMINISTIC_EVIDENCE_EXCERPT_CODE_POINTS,
      )
      const sourceTitle = normalizeDeterministicText(entry.sourceTitle)

      return `${String(index + 1)}. ${JSON.stringify(excerpt)} — ${JSON.stringify(sourceTitle)}, chunk ${String(entry.chunkIndex)}`
    })

    return Promise.resolve({
      content: [DETERMINISTIC_HEADER, ...evidence].join('\n'),
      provider: DETERMINISTIC_COMPLETION_PROVIDER,
      model: DETERMINISTIC_COMPLETION_MODEL,
      promptVersion: GROUNDED_COMPLETION_PROMPT_VERSION,
    })
  }
}

function takeCodePoints(text: string, limit: number): string {
  return Array.from(text).slice(0, limit).join('')
}
