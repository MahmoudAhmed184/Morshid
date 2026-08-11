import { Injectable } from '@nestjs/common'

import { RevealPolicy } from '../tutoring-values'
import { normalizeDeterministicText } from '../../../common/text/normalize-deterministic-text'
import type { CandidateResponse } from './tutor-generation.types'
import { validateDebuggingGuidanceOutput } from './debugging-guidance.contract'
import {
  RESPONSE_VALIDATION_ACTION,
  RESPONSE_VALIDATION_SEVERITY,
  RESPONSE_VALIDATION_STAGE,
  RESPONSE_VIOLATION_TYPE,
  type CandidateValidationContext,
  type ResponseValidationViolation,
  type ValidationResult,
  approvedValidationResult,
  rejectedValidationResult,
} from './response-validation.types'

@Injectable()
export class DeterministicGuardService {
  evaluate(
    candidate: CandidateResponse,
    context: CandidateValidationContext,
  ): ValidationResult {
    const violations: ResponseValidationViolation[] = []
    const normalized = normalizeDeterministicText(
      candidate.message,
    ).toLowerCase()

    if (candidate.responseIntent !== context.responseIntent) {
      violations.push(
        violation(
          RESPONSE_VIOLATION_TYPE.RESPONSE_INTENT_MISMATCH,
          RESPONSE_VALIDATION_SEVERITY.MEDIUM,
          'responseIntent',
          'Candidate responseIntent does not match the TeachingDecision strategy.',
          'Use the responseIntent required by the TeachingDecision.',
        ),
      )
    }

    if (candidate.studentAction.type !== context.primaryTechnique) {
      violations.push(
        violation(
          RESPONSE_VIOLATION_TYPE.TECHNIQUE_MISMATCH,
          RESPONSE_VALIDATION_SEVERITY.MEDIUM,
          'studentAction.type',
          'Candidate student action does not match the primary TeachingDecision technique.',
          'Use the primary TeachingDecision technique for studentAction.type.',
        ),
      )
    }

    if (
      context.debuggingGuidance !== undefined ||
      context.debuggingGuidanceRequired === true
    ) {
      const debuggingResult = validateDebuggingGuidanceOutput({
        content: candidate.message,
        authorizedCitationCount: context.allowedCitationIds.size,
      })
      if (debuggingResult !== 'ALLOWED_DEBUGGING_GUIDANCE') {
        violations.push(
          violation(
            RESPONSE_VIOLATION_TYPE.DEBUGGING_GUIDANCE_CONTRACT,
            RESPONSE_VALIDATION_SEVERITY.HIGH,
            'message',
            `Debugging guidance failed the ${debuggingResult} contract.`,
            'Return the four debugging guidance sections, cite authorized course evidence in Concept, and give exactly one inspection step without executing or rewriting the code.',
          ),
        )
      }
    }

    if (hasGroundingViolation(candidate, context)) {
      violations.push(
        violation(
          RESPONSE_VIOLATION_TYPE.GROUNDING_VIOLATION,
          RESPONSE_VALIDATION_SEVERITY.HIGH,
          'usedCitationIds',
          'Candidate is missing required grounding or cites outside the backend allow-list.',
          'Use one or more backend-allowed citation IDs when grounding is required.',
        ),
      )
    }

    if (candidate.selfReportedCompliance.finalAnswerRevealed) {
      violations.push(
        violation(
          RESPONSE_VIOLATION_TYPE.FINAL_ANSWER_DISCLOSURE,
          RESPONSE_VALIDATION_SEVERITY.CRITICAL,
          'selfReportedCompliance.finalAnswerRevealed',
          'Candidate explicitly reports that it revealed a prohibited final answer.',
          'Set finalAnswerRevealed to false and remove any final-answer disclosure.',
        ),
      )
    }
    if (candidate.selfReportedCompliance.completeSolutionRevealed) {
      violations.push(
        violation(
          RESPONSE_VIOLATION_TYPE.COMPLETE_SOLUTION_DISCLOSURE,
          RESPONSE_VALIDATION_SEVERITY.CRITICAL,
          'selfReportedCompliance.completeSolutionRevealed',
          'Candidate explicitly reports that it revealed a prohibited complete solution.',
          'Set completeSolutionRevealed to false and remove complete-solution disclosure.',
        ),
      )
    }

    if (context.revealPolicy === RevealPolicy.NO_FINAL_ANSWER) {
      if (revealsFinalAnswer(normalized)) {
        violations.push(
          violation(
            RESPONSE_VIOLATION_TYPE.FINAL_ANSWER_DISCLOSURE,
            RESPONSE_VALIDATION_SEVERITY.HIGH,
            'message',
            'Candidate contains a high-confidence final-answer disclosure pattern.',
            'Remove final answers and ask for one next reasoning step.',
          ),
        )
      }
      if (revealsCompleteSolution(normalized)) {
        violations.push(
          violation(
            RESPONSE_VIOLATION_TYPE.COMPLETE_SOLUTION_DISCLOSURE,
            RESPONSE_VALIDATION_SEVERITY.HIGH,
            'message',
            'Candidate appears to disclose a complete solution sequence.',
            'Keep at most one guided step and leave work for the student.',
          ),
        )
      }
      if (containsSubmissionReadyCode(candidate.message)) {
        violations.push(
          violation(
            RESPONSE_VIOLATION_TYPE.SUBMISSION_READY_CODE,
            RESPONSE_VALIDATION_SEVERITY.HIGH,
            'message',
            'Candidate appears to provide complete runnable or submittable code.',
            'Provide a diagnostic snippet or trace prompt instead of complete code.',
          ),
        )
      }
    }

    const disclosedSteps = countDisclosedSteps(candidate.message)
    if (disclosedSteps > context.maximumDisclosedSteps) {
      violations.push(
        violation(
          RESPONSE_VIOLATION_TYPE.EXCESSIVE_DISCLOSED_STEPS,
          RESPONSE_VALIDATION_SEVERITY.MEDIUM,
          'message',
          'Candidate discloses more explicit solution steps than the guard policy allows.',
          'Honor maximumDisclosedSteps without reducing the approved guidance shape: keep additional scaffolding as questions, structure, or connections rather than disclosed protected solution steps.',
        ),
      )
    }

    if (context.guidanceLevel <= 1 && disclosedSteps > 1) {
      violations.push(
        violation(
          RESPONSE_VIOLATION_TYPE.GUIDANCE_LEVEL_VIOLATION,
          RESPONSE_VALIDATION_SEVERITY.MEDIUM,
          'message',
          'Candidate is more direct than the approved guidance level.',
          'Use a lighter Socratic prompt at the approved guidance level.',
        ),
      )
    }

    if (
      context.requireStudentAction &&
      !requestsMeaningfulStudentAction(candidate)
    ) {
      violations.push(
        violation(
          RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_STUDENT_ACTION,
          RESPONSE_VALIDATION_SEVERITY.HIGH,
          'studentAction',
          'Candidate does not request one meaningful student reasoning action.',
          'Ask the student for one concrete reasoning step, trace, check, or explanation.',
        ),
      )
    }

    if (violations.length > 0) {
      return rejectedValidationResult(
        RESPONSE_VALIDATION_STAGE.DETERMINISTIC,
        violations,
        RESPONSE_VALIDATION_ACTION.REGENERATE,
        {
          provider: candidate.provider,
          model: candidate.model,
          promptVersion: candidate.promptVersion,
        },
      )
    }

    return approvedValidationResult(RESPONSE_VALIDATION_STAGE.DETERMINISTIC, {
      provider: candidate.provider,
      model: candidate.model,
      promptVersion: candidate.promptVersion,
    })
  }
}

export function revealsFinalAnswer(normalizedMessage: string): boolean {
  return [
    /\b(?:the\s+answer|final\s+answer|answer)\s*(?:is|:)\s*\S+/u,
    /\b(?:the\s+result|final\s+result|result)\s*(?:is|:)\s*[-+]?\d/u,
    /\b(?:therefore|thus|so)\b[^.!?\n]{0,60}\b(?:=|is)\s*[-+]?\d/u,
    /\b[a-z]\s*=\s*[-+]?\d+(?:\.\d+)?\b/u,
  ].some((pattern) => pattern.test(normalizedMessage))
}

export function revealsCompleteSolution(normalizedMessage: string): boolean {
  if (
    /\b(?:complete|full)\s+(?:solution|derivation|working)\b/u.test(
      normalizedMessage,
    )
  ) {
    return true
  }
  return countDisclosedSteps(normalizedMessage) >= 3
}

export function containsSubmissionReadyCode(message: string): boolean {
  const normalized = normalizeDeterministicText(message).toLowerCase()
  if (
    /\b(?:complete|full|final)\s+(?:code|implementation|program)\b/u.test(
      normalized,
    )
  ) {
    return true
  }

  const codeBlocks = [...message.matchAll(/```[\s\S]*?```/gu)].map(
    (match) => match[0],
  )
  return codeBlocks.some((block) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('```'))
    const joined = normalizeDeterministicText(lines.join('\n'))
    return (
      lines.length >= 5 &&
      /\b(?:import|from|class|def|function|const|let|var|public\s+static\s+void\s+main)\b/u.test(
        joined,
      )
    )
  })
}

export function countDisclosedSteps(message: string): number {
  const normalized = normalizeDeterministicText(message).toLowerCase()
  const matches = normalized.match(
    /(?:^|\n|\s)(?:step\s+\d+|[1-9]\d?\s*[.)])\s+\S/gu,
  )
  return matches?.length ?? 0
}

function requestsMeaningfulStudentAction(
  candidate: CandidateResponse,
): boolean {
  if (!candidate.requiresStudentAction) {
    return false
  }

  const description = normalizeDeterministicText(
    candidate.studentAction.description,
  ).toLowerCase()
  const message = normalizeDeterministicText(candidate.message).toLowerCase()
  return (
    /(?:\?|try|show|trace|explain|identify|write|compare|check|predict|tell me)/u.test(
      `${message} ${description}`,
    ) && description.length >= 12
  )
}

function hasGroundingViolation(
  candidate: CandidateResponse,
  context: CandidateValidationContext,
): boolean {
  return (
    candidate.usedCitationIds.some(
      (id) => !context.allowedCitationIds.has(id),
    ) ||
    (context.requireGrounding &&
      context.enforceCitationSupport &&
      context.allowedCitationIds.size > 0 &&
      candidate.usedCitationIds.length === 0)
  )
}

function violation(
  type: ResponseValidationViolation['type'],
  severity: ResponseValidationViolation['severity'],
  field: string | null,
  evidence: string,
  regenerationInstruction: string,
): ResponseValidationViolation {
  return Object.freeze({
    type,
    severity,
    field,
    evidence,
    regenerationInstruction,
  })
}
