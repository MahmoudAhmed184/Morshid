/**
 * Held-out fixtures for the Gemini embedding live smoke check.
 *
 * Synthetic and permission-safe: the free tier lets Google use submitted inputs
 * to improve its products, so nothing derived from real course material may
 * appear here. Every string is redacted from any diagnostic the script emits.
 *
 * `relevant` must rank above `unrelated` for `query`. These are held out from
 * the task-selection calibration fixtures on purpose — selecting and validating
 * on the same fixtures proves nothing.
 */
export const GEMINI_EMBEDDING_LIVE_SMOKE_FIXTURE = {
  materialTitle: 'Synthetic Collections Handout',
  query: 'How do I look up a value by its key?',
  relevant:
    'A dictionary maps unique keys to values, so a lookup by key is a direct operation.',
  unrelated:
    'Orbital transfer windows depend on the relative positions of two planets.',
  // The configured operational batch size. A successful request at this size
  // establishes that the configured batch succeeds — NOT the model's maximum.
  batchFillerPrefix: 'Synthetic filler chunk number ',
} as const

export function buildGeminiSmokeBatch(size: number): readonly string[] {
  const fixture = GEMINI_EMBEDDING_LIVE_SMOKE_FIXTURE
  return [
    fixture.relevant,
    fixture.unrelated,
    ...Array.from(
      { length: Math.max(0, size - 2) },
      (_, index) => `${fixture.batchFillerPrefix}${String(index)}`,
    ),
  ]
}
