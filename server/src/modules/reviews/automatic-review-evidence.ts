const MAX_SUMMARY_CODE_POINTS = 1_000
const MAX_SOURCE_COUNT = 20
const MAX_SOURCE_EXCERPT_CODE_POINTS = 1_000
const MAX_FACT_COUNT = 20
const MAX_FACT_CODE_CODE_POINTS = 80
const MAX_FACT_STRING_CODE_POINTS = 500
const MAX_IDENTIFIER_CODE_POINTS = 200

export interface AutomaticReviewEvidenceSource {
  materialId?: string
  chunkId?: string
  excerpt: string
  rank?: number
  score?: number
}

export interface AutomaticReviewEvidenceFact {
  code: string
  value: string | number | boolean
}

export interface AutomaticReviewEvidenceContribution {
  summary: string
  sources?: readonly AutomaticReviewEvidenceSource[]
  facts?: readonly AutomaticReviewEvidenceFact[]
}

export function normalizeAutomaticReviewEvidence(
  evidence: AutomaticReviewEvidenceContribution,
): AutomaticReviewEvidenceContribution {
  const summary = boundedText(
    evidence.summary,
    'summary',
    MAX_SUMMARY_CODE_POINTS,
  )
  const sources = evidence.sources ?? []
  const facts = evidence.facts ?? []

  if (sources.length > MAX_SOURCE_COUNT) {
    throw new TypeError(
      `evidence.sources must contain at most ${String(MAX_SOURCE_COUNT)} items`,
    )
  }
  if (facts.length > MAX_FACT_COUNT) {
    throw new TypeError(
      `evidence.facts must contain at most ${String(MAX_FACT_COUNT)} items`,
    )
  }

  return {
    summary,
    sources: sources.map((source, index) => ({
      ...(source.materialId === undefined
        ? {}
        : {
            materialId: boundedText(
              source.materialId,
              `sources[${String(index)}].materialId`,
              MAX_IDENTIFIER_CODE_POINTS,
            ),
          }),
      ...(source.chunkId === undefined
        ? {}
        : {
            chunkId: boundedText(
              source.chunkId,
              `sources[${String(index)}].chunkId`,
              MAX_IDENTIFIER_CODE_POINTS,
            ),
          }),
      excerpt: boundedText(
        source.excerpt,
        `sources[${String(index)}].excerpt`,
        MAX_SOURCE_EXCERPT_CODE_POINTS,
      ),
      ...(source.rank === undefined
        ? {}
        : {
            rank: positiveInteger(
              source.rank,
              `sources[${String(index)}].rank`,
            ),
          }),
      ...(source.score === undefined
        ? {}
        : {
            score: finiteNumber(
              source.score,
              `sources[${String(index)}].score`,
            ),
          }),
    })),
    facts: facts.map((fact, index) => ({
      code: boundedText(
        fact.code,
        `facts[${String(index)}].code`,
        MAX_FACT_CODE_CODE_POINTS,
      ),
      value:
        typeof fact.value === 'string'
          ? boundedText(
              fact.value,
              `facts[${String(index)}].value`,
              MAX_FACT_STRING_CODE_POINTS,
            )
          : finiteValue(fact.value, `facts[${String(index)}].value`),
    })),
  }
}

function boundedText(value: string, field: string, limit: number): string {
  const normalized = value.trim()
  if (normalized.length === 0 || Array.from(normalized).length > limit) {
    throw new TypeError(
      `${field} must contain between 1 and ${String(limit)} characters`,
    )
  }
  return normalized
}

function finiteValue(value: number | boolean, field: string): number | boolean {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError(`${field} must be finite`)
  }
  return value
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer`)
  }
  return value
}

function finiteNumber(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${field} must be finite`)
  }
  return value
}
