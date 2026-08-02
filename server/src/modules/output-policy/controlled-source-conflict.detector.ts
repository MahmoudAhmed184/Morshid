import { Injectable } from '@nestjs/common'

import type { RetrievedChunk } from '../retrieval/retrieval.service'

export const CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION =
  'python-integer-division-conflict-v1'

export interface ControlledSourceConflict {
  readonly detectorVersion: typeof CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION
  readonly sources: readonly [RetrievedChunk, RetrievedChunk]
}

const CANONICAL_QUESTION =
  /\bpython\b.*(?:\/|division).*(?:two\s+integers|integers?).*(?:integer|whole\s+number|decimal|float|result)|(?:\/|division).*(?:two\s+integers|integers?).*(?:integer|whole\s+number|decimal|float).*(?:python)/iu
const FLOAT_CLAIM =
  /(?:\btrue\s+division\b|(?:\/|slash\s+operator).{0,80}\b(?:produce|produces|return|returns|result|results)\b.{0,40}\b(?:decimal|float|floating[- ]point)\b|\b5\s*\/\s*2\s*(?:==|=|is|returns?|produces?)\s*2\.5\b)/iu
const INTEGER_CLAIM =
  /(?:(?:\/|slash\s+operator).{0,80}\b(?:integer\s+division|integer\s+result|truncate|truncates|whole\s+number)\b|\b5\s*\/\s*2\s*(?:==|=|is|returns?|produces?)\s*2(?:\.0)?(?![\d.]))/iu

@Injectable()
export class ControlledSourceConflictDetector {
  detect(
    studentQuestion: string,
    chunks: readonly RetrievedChunk[],
  ): ControlledSourceConflict | null {
    if (!CANONICAL_QUESTION.test(normalize(studentQuestion))) return null

    const eligible = chunks
      .filter(({ rank }) => rank === 1 || rank === 2)
      .sort((left, right) => left.rank - right.rank)
    if (eligible.length !== 2) return null
    const [first, second] = eligible
    if (first.materialId === second.materialId) return null

    const firstClaim = claimFrom(first.content)
    const secondClaim = claimFrom(second.content)
    if (
      firstClaim === null ||
      secondClaim === null ||
      firstClaim === secondClaim
    ) {
      return null
    }

    return Object.freeze({
      detectorVersion: CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION,
      sources: Object.freeze([first, second]),
    })
  }
}

function claimFrom(content: string): 'FLOAT' | 'INTEGER' | null {
  const normalized = normalize(content)
  const floatClaim = FLOAT_CLAIM.test(normalized)
  const integerClaim = INTEGER_CLAIM.test(normalized)
  if (floatClaim === integerClaim) return null
  return floatClaim ? 'FLOAT' : 'INTEGER'
}

function normalize(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}
