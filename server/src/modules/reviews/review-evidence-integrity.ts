import { createHash } from 'node:crypto'

export function serializeReviewEvidence(value: unknown): string {
  if (
    value === undefined ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    throw new Error('Review evidence must contain only JSON values')
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(serializeReviewEvidence).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${serializeReviewEvidence(entryValue)}`,
    )
  return `{${entries.join(',')}}`
}

export function reviewEvidenceContentHash(value: unknown): string {
  return createHash('sha256')
    .update(serializeReviewEvidence(value))
    .digest('hex')
}
