export const ExplanationDetailLevel = {
  CONCISE: 'CONCISE',
  STANDARD: 'STANDARD',
  DETAILED: 'DETAILED',
} as const

export type ExplanationDetailLevel =
  (typeof ExplanationDetailLevel)[keyof typeof ExplanationDetailLevel]

export function normalizeExplanationDetailLevel(
  value: unknown,
): ExplanationDetailLevel {
  if (
    value === ExplanationDetailLevel.CONCISE ||
    value === ExplanationDetailLevel.STANDARD ||
    value === ExplanationDetailLevel.DETAILED
  ) {
    return value
  }
  return ExplanationDetailLevel.STANDARD
}
