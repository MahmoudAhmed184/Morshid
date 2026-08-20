import { Injectable } from '@nestjs/common'

import { RevealPolicy, TeachingStrategy } from '../../tutoring-values'
import { normalizeDeterministicText } from '../../../../common/text/normalize-deterministic-text'
import type { CandidateResponse } from '../generation/tutor-generation.types'
import {
  DEBUGGING_GUIDANCE_VALIDATION_FAILURE,
  validateDebuggingGuidanceOutput,
  type DebuggingGuidanceValidationFailure,
} from '../debugging-guidance/debugging-guidance.output-validator'
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

    if (
      candidate.studentAction.type !== context.studentActionObligation.technique
    ) {
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
      context.responseIntent === TeachingStrategy.DEBUGGING_GUIDANCE ||
      context.debuggingGuidanceRequired === true
    ) {
      const debuggingResult = validateDebuggingGuidanceOutput({
        candidate,
        allowedCitationIds: context.allowedCitationIds,
        rewriteRequested: context.debuggingGuidance?.rewriteRequested ?? false,
      })
      if (!debuggingResult.approved) {
        violations.push(debuggingGuidanceViolation(debuggingResult.failure))
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
      if (
        revealsFinalAnswer(normalized, {
          givenPremises: context.givenPremises,
          targetVariables: context.targetVariables,
        })
      ) {
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
      if (
        revealsDecisiveSubstitution(normalized, {
          givenPremises: context.givenPremises,
          targetVariables: context.targetVariables,
        })
      ) {
        violations.push(
          violation(
            RESPONSE_VIOLATION_TYPE.DIRECT_ANSWER_DISCLOSURE,
            RESPONSE_VALIDATION_SEVERITY.HIGH,
            'message',
            'Candidate performs decisive substitution derivation before the student reasoned through the step.',
            'Ask the student to perform the variable substitution or evaluate the expression.',
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
      candidate.debuggingGuidance === null &&
      context.studentActionObligation.required &&
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

export interface ProblemProtectionContext {
  readonly givenPremises?: ReadonlySet<string>
  readonly targetVariables?: ReadonlySet<string>
}

export function extractProblemStatementGivensAndTargets(
  activeProblemText: string,
): {
  givenPremises: Set<string>
  targetVariables: Set<string>
} {
  const normalized = normalizeDeterministicText(activeProblemText).toLowerCase()
  const givenPremises = new Set<string>()
  const targetVariables = new Set<string>()

  const lines = normalized.split(/\r?\n/)
  for (const line of lines) {
    if (
      /\b(?:i\s+think|i\s+guess|maybe|could\s+it\s+be|is\s+it|i\s+believe|my\s+guess|answer\s+is)\b/u.test(
        line,
      )
    ) {
      continue
    }
    const assignmentMatches = line.matchAll(
      /\b([a-z_][a-z0-9_]*)\s*=\s*([-+]?\d+(?:\.\d+)?)\b/gu,
    )
    for (const match of assignmentMatches) {
      const varName = match[1]
      const value = match[2]
      givenPremises.add(`${varName} = ${value}`)
      givenPremises.add(`${varName}=${value}`)
    }
  }

  const targetQueries = [
    /\bwhat\s+is\s+(?:the\s+value\s+of\s+)?([a-z_][a-z0-9_]*)\b/gu,
    /\bfind\s+(?:the\s+value\s+of\s+)?([a-z_][a-z0-9_]*)\b/gu,
    /\bsolve\s+for\s+([a-z_][a-z0-9_]*)\b/gu,
    /\bcalculate\s+(?:the\s+value\s+of\s+)?([a-z_][a-z0-9_]*)\b/gu,
  ]
  for (const queryRegex of targetQueries) {
    const matches = normalized.matchAll(queryRegex)
    for (const match of matches) {
      if (match[1]) {
        targetVariables.add(match[1])
      }
    }
  }

  const equationMatches = normalized.matchAll(
    /\b([a-z_][a-z0-9_]*)\s*=\s*[^;\n\r]*?[a-z_]/gu,
  )
  for (const match of equationMatches) {
    if (match[1]) {
      targetVariables.add(match[1])
    }
  }

  return { givenPremises, targetVariables }
}

export function revealsFinalAnswer(
  normalizedMessage: string,
  context?: ProblemProtectionContext,
): boolean {
  if (
    [
      /\b(?:the\s+answer|final\s+answer|answer)\s*(?:is|:)\s*\S+/u,
      /\b(?:the\s+result|final\s+result|result)\s*(?:is|:)\s*[-+]?\d/u,
    ].some((pattern) => pattern.test(normalizedMessage))
  ) {
    return true
  }

  const conclusionMatches = normalizedMessage.matchAll(
    /\b(?:therefore|thus|hence|so)\b[^.!?\n]{0,60}(?:=|\bis\b)\s*[-+]?\d/gu,
  )
  for (const conclusionMatch of conclusionMatches) {
    const matchedText = conclusionMatch[0]
    const assignedVar =
      /\b([a-z_][a-z0-9_]*)\s*=\s*([-+]?\d+(?:\.\d+)?)\b/u.exec(matchedText)
    if (assignedVar !== null) {
      const varName = assignedVar[1]
      const value = assignedVar[2]
      if (!isGivenPremise(context, varName, value)) {
        return true
      }
    } else {
      return true
    }
  }

  const assignmentMatches = normalizedMessage.matchAll(
    /\b([a-z_][a-z0-9_]*)\s*=\s*([-+]?\d+(?:\.\d+)?)\b/gu,
  )
  for (const match of assignmentMatches) {
    const varName = match[1]
    const value = match[2]
    if (isGivenPremise(context, varName, value)) {
      continue
    }

    if (isTargetVariable(context, varName)) {
      return true
    }
  }

  return false
}

function isGivenPremise(
  context: ProblemProtectionContext | undefined,
  varName: string,
  value: string,
): boolean {
  const premises = context?.givenPremises
  if (premises === undefined) {
    return false
  }
  return (
    premises.has(`${varName} = ${value}`) || premises.has(`${varName}=${value}`)
  )
}

function isTargetVariable(
  context: ProblemProtectionContext | undefined,
  varName: string,
): boolean {
  const targets = context?.targetVariables
  if (targets === undefined) {
    return false
  }
  return targets.has(varName)
}

export function revealsDecisiveSubstitution(
  normalizedMessage: string,
  context?: ProblemProtectionContext,
): boolean {
  if (
    context?.givenPremises === undefined ||
    context.givenPremises.size === 0
  ) {
    return false
  }

  for (const premise of context.givenPremises) {
    const match = /\b([a-z_][a-z0-9_]*)\s*=\s*([-+]?\d+(?:\.\d+)?)\b/u.exec(
      premise,
    )
    if (match === null) {
      continue
    }
    const varName = match[1]
    const value = match[2]

    // Explicit substitution: "x + 1 becomes 5 + 1", "x + 1 is 5 + 1", "x + 1 = 5 + 1"
    const substitutionPatternLeading = new RegExp(
      `\\b${varName}\\s*([+\\-*/%])\\s*(\\d+)\\s*(?:becomes|is|=|gives|yields|results in|->|=>)\\s*${value}\\s*\\1\\s*\\2\\b`,
      'iu',
    )
    if (substitutionPatternLeading.test(normalizedMessage)) {
      return true
    }

    // Commutative substitution: "1 + x becomes 1 + 5"
    const substitutionPatternTrailing = new RegExp(
      `\\b(\\d+)\\s*([+\\-*/%])\\s*${varName}\\s*(?:becomes|is|=|gives|yields|results in|->|=>)\\s*\\1\\s*\\2\\s*${value}\\b`,
      'iu',
    )
    if (substitutionPatternTrailing.test(normalizedMessage)) {
      return true
    }

    // Target assignment with substituted expression: "y = 5 + 1" or "y = 1 + 5"
    const targetSubstitutionPattern = new RegExp(
      `\\b[a-z_][a-z0-9_]*\\s*=\\s*(?:${value}\\s*[+\\-*/%]\\s*\\d+|\\d+\\s*[+\\-*/%]\\s*${value})\\b`,
      'iu',
    )
    if (targetSubstitutionPattern.test(normalizedMessage)) {
      return true
    }

    // Expressive derivation: "substituting x = 5 gives 5 + 1"
    const descriptiveSubstitutionPattern = new RegExp(
      `\\b(?:substituting|substitute|replacing|replace)\\s+${varName}\\s*(?:with|=|as|is)\\s*${value}\\s*(?:gives|yields|we get|to get|is|=|results in)\\s*(?:${value}\\s*[+\\-*/%]\\s*\\d+|\\d+\\s*[+\\-*/%]\\s*${value})\\b`,
      'iu',
    )
    if (descriptiveSubstitutionPattern.test(normalizedMessage)) {
      return true
    }
  }

  return false
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

function debuggingGuidanceViolation(
  failure: DebuggingGuidanceValidationFailure,
): ResponseValidationViolation {
  switch (failure) {
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_DEBUGGING_GUIDANCE:
      return violation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_MISSING_GUIDANCE,
        RESPONSE_VALIDATION_SEVERITY.HIGH,
        'debuggingGuidance',
        'The structured debugging guidance object is missing.',
        'Return the structured debugging guidance object required by the output contract.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_DIAGNOSIS:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_MISSING_DIAGNOSIS,
        'debuggingGuidance.diagnosis',
        'The structured debugging diagnosis field is missing.',
        'Include one bounded likely-defect diagnosis.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EMPTY_DIAGNOSIS:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_EMPTY_DIAGNOSIS,
        'debuggingGuidance.diagnosis',
        'The structured debugging diagnosis is empty.',
        'Provide a non-empty bounded likely-defect diagnosis.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_RELEVANT_LOCATION:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_MISSING_RELEVANT_LOCATION,
        'debuggingGuidance.relevantLocation',
        'The structured relevant location field is missing.',
        'Include the bounded code location the student should inspect.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EMPTY_RELEVANT_LOCATION:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_EMPTY_RELEVANT_LOCATION,
        'debuggingGuidance.relevantLocation',
        'The structured relevant location is empty.',
        'Provide a non-empty bounded code location.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_CONCEPT:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_MISSING_CONCEPT,
        'debuggingGuidance.conceptExplanation',
        'The structured concept explanation field is missing.',
        'Include a bounded concept explanation grounded by usedCitationIds.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EMPTY_CONCEPT:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_EMPTY_CONCEPT,
        'debuggingGuidance.conceptExplanation',
        'The structured concept explanation is empty.',
        'Provide a non-empty concept explanation grounded by usedCitationIds.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_AUTHORIZED_CITATION:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_MISSING_AUTHORIZED_CITATION,
        'usedCitationIds',
        'The debugging concept has no authorized course citation.',
        'Select at least one allowed citation ID for the concept explanation.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.INVALID_AUTHORIZED_CITATION:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_INVALID_AUTHORIZED_CITATION,
        'usedCitationIds',
        'The debugging concept uses a citation outside the backend allow-list.',
        'Use only citation IDs from allowedCitationIds.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.RENDERED_CITATION_MISMATCH:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_RENDERED_CITATION_MISMATCH,
        'message',
        'Rendered citation markers do not match usedCitationIds.',
        'Return the structured fields only and allow the backend to render citation markers.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_STUDENT_ACTION:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_MISSING_STUDENT_ACTION,
        'debuggingGuidance.inspectionActions',
        'The debugging response has no student inspection action.',
        'Provide exactly one meaningful inspection or trace action.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MULTIPLE_STUDENT_ACTIONS:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_MULTIPLE_STUDENT_ACTIONS,
        'debuggingGuidance.inspectionActions',
        'The debugging response asks the student to perform multiple actions.',
        'Provide exactly one meaningful inspection or trace action.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.INVALID_STUDENT_ACTION:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_INVALID_STUDENT_ACTION,
        'debuggingGuidance.inspectionActions',
        'The debugging response does not contain a meaningful inspection action.',
        'Provide one concrete inspection, trace, check, comparison, or prediction.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.STRUCTURED_STUDENT_ACTION_MISMATCH:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_STUDENT_ACTION_MISMATCH,
        'studentAction',
        'The derived studentAction disagrees with the structured inspection action.',
        'Return one structured inspection action and allow the backend to derive studentAction.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.RENDERED_RESPONSE_MISMATCH:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_RENDERED_RESPONSE_MISMATCH,
        'message',
        'The rendered message disagrees with the structured debugging response.',
        'Return the structured debugging fields and allow the backend to render the message.',
      )
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.PROMPT_DISCLOSURE:
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EXECUTION_CLAIM:
    case DEBUGGING_GUIDANCE_VALIDATION_FAILURE.FULL_REWRITE_SUSPECTED:
      return debuggingComponentViolation(
        RESPONSE_VIOLATION_TYPE.DEBUGGING_GUIDANCE_CONTRACT,
        'message',
        `Debugging guidance failed the ${failure} safety contract.`,
        'Remove policy disclosure, execution claims, and complete corrected code while preserving one inspection action.',
      )
  }
}

function debuggingComponentViolation(
  type: ResponseValidationViolation['type'],
  field: string,
  evidence: string,
  regenerationInstruction: string,
): ResponseValidationViolation {
  return violation(
    type,
    RESPONSE_VALIDATION_SEVERITY.HIGH,
    field,
    evidence,
    regenerationInstruction,
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
