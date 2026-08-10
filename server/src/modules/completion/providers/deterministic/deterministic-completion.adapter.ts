import { normalizeDeterministicText } from '../../../../common/text/normalize-deterministic-text'
import type {
  CompletionAdapter,
  PreparedCompletionRequest,
} from '../../completion-adapter'
import { assertPreparedMessageOrder } from '../../completion-adapter'
import { DETERMINISTIC_COMPLETION_PROVIDER } from '../../completion-configuration'
import type { CompletionResult } from '../../completion-provider'
import { CompletionProviderError } from '../../completion-provider'
import {
  GROUNDED_COMPLETION_PROMPT_VERSION,
  parseGroundedCompletionInputEnvelope,
} from '../../grounded-completion-envelope'
import { preparedCompletionStrategy } from '../../completion-adapter'

export const DETERMINISTIC_COMPLETION_MODEL = 'deterministic-completion-v1'
export const DETERMINISTIC_EVIDENCE_EXCERPT_CODE_POINTS = 240

const DETERMINISTIC_HEADER =
  'Grounded guidance based only on the supplied authorized context:'

// Offline adapter for CI, local development, and the backup demo. Its output
// is an evidence digest rather than generated prose: every variable character
// comes from the supplied context, and the student question is never echoed.
export class DeterministicCompletionAdapter implements CompletionAdapter {
  // The digest is computed synchronously; the executor exists so every refusal
  // reaches the caller as a rejection rather than a synchronous throw.
  complete(request: PreparedCompletionRequest): Promise<CompletionResult> {
    return new Promise<CompletionResult>((resolve) => {
      if (request.signal.aborted) {
        throw new CompletionProviderError('COMPLETION_CANCELLED')
      }

      // This adapter reads index 1 as the untrusted envelope purely by
      // position, so the shared order assertion has to run before the parse.
      assertPreparedMessageOrder(request)

      const input = parseGroundedCompletionInputEnvelope(
        request.messages[1].content,
      )
      if (
        preparedCompletionStrategy(request) === 'PYTHON_CODE_DIAGNOSIS' &&
        'diagnosis' in input
      ) {
        resolve({
          content: formatStaticCodeDiagnosis(input.diagnosis),
          provider: DETERMINISTIC_COMPLETION_PROVIDER,
          model: DETERMINISTIC_COMPLETION_MODEL,
          promptVersion:
            request.promptVersion ?? GROUNDED_COMPLETION_PROMPT_VERSION,
        })
        return
      }

      const evidence = input.context.map((entry, index) => {
        const excerpt = takeCodePoints(
          normalizeDeterministicText(entry.content),
          DETERMINISTIC_EVIDENCE_EXCERPT_CODE_POINTS,
        )
        const sourceTitle = normalizeDeterministicText(entry.sourceTitle)

        return `${String(index + 1)}. ${JSON.stringify(excerpt)} — ${JSON.stringify(sourceTitle)}, chunk ${String(entry.chunkIndex)}`
      })

      resolve({
        content: [DETERMINISTIC_HEADER, ...evidence].join('\n'),
        provider: DETERMINISTIC_COMPLETION_PROVIDER,
        model: DETERMINISTIC_COMPLETION_MODEL,
        promptVersion:
          request.promptVersion ?? GROUNDED_COMPLETION_PROMPT_VERSION,
      })
    })
  }
}

function formatStaticCodeDiagnosis(diagnosis: {
  readonly likelyDefect: string
  readonly location: string
  readonly conceptExplanation: string
  readonly nextInspectionStep: string
}): string {
  return [
    'Likely defect',
    diagnosis.likelyDefect,
    '',
    'Relevant location',
    diagnosis.location,
    '',
    'Python concept',
    `${diagnosis.conceptExplanation} [1]`,
    '',
    'Next inspection step',
    diagnosis.nextInspectionStep,
  ].join('\n')
}

function takeCodePoints(text: string, limit: number): string {
  return Array.from(text).slice(0, limit).join('')
}
