import { createHash } from 'node:crypto'

export function catalogSemanticFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')
}

export function assertCatalogSemanticFingerprint(
  expected: string,
  value: unknown,
): void {
  const actual = catalogSemanticFingerprint(value)

  if (actual !== expected) {
    throw new Error(
      `Prisma catalog semantics differ from the reviewed expectation (expected ${expected}, received ${actual})`,
    )
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    )
  }

  if (typeof value === 'string') {
    return value.replaceAll('\r\n', '\n').trim()
  }

  return value
}
