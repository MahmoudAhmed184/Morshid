import { Injectable } from '@nestjs/common'

import { MessageGuidanceLabel } from '../tutoring-values'
import {
  AUTOMATIC_POLICY_REASONS,
  RESPONSE_GOVERNANCE_VERSION,
  type AutomaticPolicyReason,
  type ResponseGovernanceDecision,
  type ResponseGovernanceConflictKind,
  type ResponseGovernanceInput,
} from './response-governance.contract'

export const RESPONSE_GOVERNANCE_GENERAL_NOT_FOUND_CONTENT =
  'I could not find course material that supports this request. I can offer only limited general learning guidance while an Instructor reviews it.'
export const RESPONSE_GOVERNANCE_SOURCE_CONFLICT_CONTENT =
  'The available course materials conflict, so I cannot present either position as settled course guidance. An Instructor review is pending.'
export const RESPONSE_GOVERNANCE_QUESTION_X_SCHEDULE_CONFLICT_CONTENT =
  'The available course materials conflict: one schedules Question X for Monday and another schedules it for Tuesday. I cannot present either day as settled course guidance. An Instructor review is pending.'
export const RESPONSE_GOVERNANCE_REFUSAL_CONTENT =
  'I cannot provide that response. I can help with a smaller learning step that follows the course policy.'
export const RESPONSE_GOVERNANCE_CITATION_MISSING_CONTENT =
  'I could not verify the required course citation, so I am withholding the proposed guidance while an Instructor reviews it.'

const MAX_PROPOSED_CONTENT_CODE_POINTS = 16_000
const MAX_REVIEW_SOURCE_EXCERPT_CODE_POINTS = 500
const REVIEW_EVIDENCE_SUMMARIES = {
  GENERAL_NOT_FOUND: 'Course support was not found for the proposed guidance.',
  SOURCE_CONFLICT:
    'Distinct retrieved course sources require Instructor conflict review.',
  POLICY_CHECK_FAILED:
    'The proposed response did not pass the automatic policy check.',
  FINAL_ANSWER_RISK:
    'The proposed response was classified as direct final-answer guidance.',
  CITATION_MISSING:
    'The proposed course-grounded response was missing a required citation.',
} as const satisfies Record<AutomaticPolicyReason, string>

@Injectable()
export class ResponseGovernance {
  evaluate(input: ResponseGovernanceInput): ResponseGovernanceDecision {
    const proposedContent = requireBoundedContent(input.proposedContent)
    const reasons = collectReasons(input)

    if (reasons.length === 0) {
      return Object.freeze({
        policyVersion: RESPONSE_GOVERNANCE_VERSION,
        content: proposedContent,
        display: 'AS_PROPOSED',
        safeRefusal: false,
        createReview: false,
        reasons: Object.freeze([]),
        reviewEvidence: null,
        studentStatus: Object.freeze({
          guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
          reviewStatus: 'NOT_REQUIRED',
        }),
      })
    }

    const safeRefusal =
      reasons.includes('POLICY_CHECK_FAILED') ||
      reasons.includes('FINAL_ANSWER_RISK')

    return Object.freeze({
      policyVersion: RESPONSE_GOVERNANCE_VERSION,
      content: replacementFor(reasons, input.controlledConflictKind),
      display: 'SAFE_REPLACEMENT',
      safeRefusal,
      createReview: true,
      reasons: Object.freeze(reasons),
      reviewEvidence: {
        summary: reasons
          .map((reason) => REVIEW_EVIDENCE_SUMMARIES[reason])
          .join(' '),
        sources: (input.evidence ?? []).map((source) => ({
          ...(source.materialId === undefined
            ? {}
            : { materialId: source.materialId }),
          ...(source.materialTitle === undefined
            ? {}
            : { materialTitle: source.materialTitle }),
          ...(source.chunkId === undefined ? {} : { chunkId: source.chunkId }),
          ...(source.chunkIndex === undefined
            ? {}
            : { chunkIndex: source.chunkIndex }),
          excerpt: takeCodePoints(
            normalizeWhitespace(source.excerpt),
            MAX_REVIEW_SOURCE_EXCERPT_CODE_POINTS,
          ),
          ...(source.rank === undefined ? {} : { rank: source.rank }),
          ...(source.score === undefined ? {} : { score: source.score }),
        })),
        facts: [
          { code: 'policy_version', value: RESPONSE_GOVERNANCE_VERSION },
          { code: 'reason_count', value: reasons.length },
          ...(input.reviewFacts ?? []),
        ],
      },
      studentStatus: Object.freeze({
        guidanceLabel: safeRefusal
          ? MessageGuidanceLabel.REFUSAL
          : MessageGuidanceLabel.UNCERTAIN_AWAITING_REVIEW,
        reviewStatus: 'AWAITING_REVIEW',
      }),
    })
  }
}

function collectReasons(
  input: ResponseGovernanceInput,
): AutomaticPolicyReason[] {
  const detected = new Set<AutomaticPolicyReason>()
  const { assessment } = input

  switch (assessment.support) {
    case 'SUPPORTED':
      break
    case 'NOT_FOUND':
      detected.add('GENERAL_NOT_FOUND')
      break
    case 'CONFLICTING':
      detected.add('SOURCE_CONFLICT')
      break
    default:
      return assertNever(assessment.support)
  }

  switch (assessment.policyCheck) {
    case 'PASSED':
      break
    case 'FAILED':
      detected.add('POLICY_CHECK_FAILED')
      break
    default:
      return assertNever(assessment.policyCheck)
  }

  switch (assessment.answerRisk) {
    case 'NONE':
      break
    case 'FINAL_ANSWER':
      detected.add('FINAL_ANSWER_RISK')
      break
    default:
      return assertNever(assessment.answerRisk)
  }

  switch (assessment.citations) {
    case 'PRESENT':
    case 'NOT_REQUIRED':
      break
    case 'MISSING':
      detected.add('CITATION_MISSING')
      break
    default:
      return assertNever(assessment.citations)
  }

  return AUTOMATIC_POLICY_REASONS.filter((reason) => detected.has(reason))
}

function replacementFor(
  reasons: readonly AutomaticPolicyReason[],
  controlledConflictKind: ResponseGovernanceConflictKind | undefined,
): string {
  if (
    reasons.includes('POLICY_CHECK_FAILED') ||
    reasons.includes('FINAL_ANSWER_RISK')
  ) {
    return RESPONSE_GOVERNANCE_REFUSAL_CONTENT
  }
  if (reasons.includes('SOURCE_CONFLICT')) {
    return controlledConflictKind === 'QUESTION_X_SCHEDULE'
      ? RESPONSE_GOVERNANCE_QUESTION_X_SCHEDULE_CONFLICT_CONTENT
      : RESPONSE_GOVERNANCE_SOURCE_CONFLICT_CONTENT
  }
  if (reasons.includes('GENERAL_NOT_FOUND')) {
    return RESPONSE_GOVERNANCE_GENERAL_NOT_FOUND_CONTENT
  }
  return RESPONSE_GOVERNANCE_CITATION_MISSING_CONTENT
}

function requireBoundedContent(value: string): string {
  const normalized = value.trim()
  if (
    normalized.length === 0 ||
    Array.from(normalized).length > MAX_PROPOSED_CONTENT_CODE_POINTS
  ) {
    throw new TypeError('Proposed output is invalid')
  }
  return normalized
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

function takeCodePoints(value: string, maximum: number): string {
  return Array.from(value).slice(0, maximum).join('')
}

function assertNever(_value: never): never {
  throw new TypeError('Invalid response-governance assessment')
}
