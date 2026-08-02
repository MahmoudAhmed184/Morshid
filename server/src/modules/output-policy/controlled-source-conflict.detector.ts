import { Injectable } from '@nestjs/common'

import type { RetrievedChunk } from '../retrieval/retrieval.service'

export const CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION =
  'controlled-source-conflict-v2'

export interface ControlledSourceConflict {
  readonly detectorVersion: typeof CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION
  readonly kind: ControlledConflictScenario
  readonly sources: readonly [RetrievedChunk, RetrievedChunk]
}

export type ControlledConflictScenario =
  'PYTHON_DIVISION' | 'QUESTION_X_SCHEDULE'
type OpposingClaim = 'A' | 'B'

const PYTHON_DIVISION_QUESTION =
  /\bpython\b.*(?:\/|division).*(?:two\s+integers|integers?).*(?:integer|whole\s+number|decimal|float|result)|(?:\/|division).*(?:two\s+integers|integers?).*(?:integer|whole\s+number|decimal|float).*(?:python)/iu
const QUESTION_X_SCHEDULE =
  /\b(?:on\s+which\s+day|what\s+day|when)\b.{0,100}\bquestion\s+x\b|\bquestion\s+x\b.{0,100}\b(?:scheduled|schedule|day|when)\b/iu
const FLOAT_CLAIM =
  /(?:\btrue\s+division\b|(?:\/|slash\s+operator).{0,80}\b(?:produce|produces|return|returns|result|results)\b.{0,40}\b(?:decimal|float|floating[- ]point)\b|\b5\s*\/\s*2\s*(?:==|=|is|returns?|produces?)\s*2\.5\b)/iu
const INTEGER_CLAIM =
  /(?:(?:\/|slash\s+operator).{0,80}\b(?:integer\s+division|integer\s+result|truncate|truncates|whole\s+number)\b|\b5\s*\/\s*2\s*(?:==|=|is|returns?|produces?)\s*2(?:\.0)?(?![\d.]))/iu
const MONDAY_CLAIM = /\bquestion\s+x\s+is\s+scheduled\s+for\s+monday\b/iu
const TUESDAY_CLAIM = /\bquestion\s+x\s+is\s+scheduled\s+for\s+tuesday\b/iu

@Injectable()
export class ControlledSourceConflictDetector {
  detect(
    studentQuestion: string,
    chunks: readonly RetrievedChunk[],
  ): ControlledSourceConflict | null {
    const scenario = scenarioFrom(studentQuestion)
    if (scenario === null) return null

    const eligible = chunks
      .filter(({ rank }) => rank === 1 || rank === 2)
      .sort((left, right) => left.rank - right.rank)
    if (eligible.length !== 2) return null
    const [first, second] = eligible
    if (first.materialId === second.materialId) return null

    const firstClaim = claimFrom(first.content, scenario)
    const secondClaim = claimFrom(second.content, scenario)
    if (
      firstClaim === null ||
      secondClaim === null ||
      firstClaim === secondClaim
    ) {
      return null
    }

    const sources: readonly [RetrievedChunk, RetrievedChunk] = [first, second]
    return Object.freeze({
      detectorVersion: CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION,
      kind: scenario,
      sources: Object.freeze(sources),
    })
  }
}

function scenarioFrom(question: string): ControlledConflictScenario | null {
  const normalized = normalize(question)
  if (PYTHON_DIVISION_QUESTION.test(normalized)) return 'PYTHON_DIVISION'
  if (QUESTION_X_SCHEDULE.test(normalized)) return 'QUESTION_X_SCHEDULE'
  return null
}

function claimFrom(
  content: string,
  scenario: ControlledConflictScenario,
): OpposingClaim | null {
  const normalized = normalize(content)
  const firstClaim =
    scenario === 'PYTHON_DIVISION'
      ? FLOAT_CLAIM.test(normalized)
      : MONDAY_CLAIM.test(normalized)
  const secondClaim =
    scenario === 'PYTHON_DIVISION'
      ? INTEGER_CLAIM.test(normalized)
      : TUESDAY_CLAIM.test(normalized)
  if (firstClaim === secondClaim) return null
  return firstClaim ? 'A' : 'B'
}

function normalize(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}
