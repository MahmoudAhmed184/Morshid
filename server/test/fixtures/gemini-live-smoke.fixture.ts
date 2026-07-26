import type { CompletionRequest } from '../../src/modules/completion/completion-provider'

export const GEMINI_LIVE_SMOKE_FIXTURE = {
  studentQuestion: 'What study step does the synthetic guide recommend?',
  context: [
    {
      sourceTitle: 'Synthetic public demo guide',
      chunkIndex: 0,
      content:
        'The synthetic guide recommends practicing one worked example and checking the result against the supplied rubric.',
    },
  ],
} as const satisfies CompletionRequest
