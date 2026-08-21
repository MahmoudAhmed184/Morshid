import type {
  CandidateResponse,
  TutorDebuggingGuidanceResponse,
} from '../generation/tutor-generation.types'

export const DEBUGGING_GUIDANCE_VALIDATION_FAILURE = {
  PROMPT_DISCLOSURE: 'PROMPT_DISCLOSURE',
  EXECUTION_CLAIM: 'EXECUTION_CLAIM',
  FULL_REWRITE_SUSPECTED: 'FULL_REWRITE_SUSPECTED',
  MISSING_DEBUGGING_GUIDANCE: 'MISSING_DEBUGGING_GUIDANCE',
  MISSING_DIAGNOSIS: 'MISSING_DIAGNOSIS',
  EMPTY_DIAGNOSIS: 'EMPTY_DIAGNOSIS',
  MISSING_RELEVANT_LOCATION: 'MISSING_RELEVANT_LOCATION',
  EMPTY_RELEVANT_LOCATION: 'EMPTY_RELEVANT_LOCATION',
  MISSING_CONCEPT: 'MISSING_CONCEPT',
  EMPTY_CONCEPT: 'EMPTY_CONCEPT',
  MISSING_AUTHORIZED_CITATION: 'MISSING_AUTHORIZED_CITATION',
  INVALID_AUTHORIZED_CITATION: 'INVALID_AUTHORIZED_CITATION',
  RENDERED_CITATION_MISMATCH: 'RENDERED_CITATION_MISMATCH',
  MISSING_STUDENT_ACTION: 'MISSING_STUDENT_ACTION',
  MULTIPLE_STUDENT_ACTIONS: 'MULTIPLE_STUDENT_ACTIONS',
  INVALID_STUDENT_ACTION: 'INVALID_STUDENT_ACTION',
  STRUCTURED_STUDENT_ACTION_MISMATCH: 'STRUCTURED_STUDENT_ACTION_MISMATCH',
  RENDERED_RESPONSE_MISMATCH: 'RENDERED_RESPONSE_MISMATCH',
} as const

export type DebuggingGuidanceValidationFailure =
  (typeof DEBUGGING_GUIDANCE_VALIDATION_FAILURE)[keyof typeof DEBUGGING_GUIDANCE_VALIDATION_FAILURE]

export type DebuggingGuidanceValidationResult =
  | { readonly approved: true }
  | {
      readonly approved: false
      readonly failure: DebuggingGuidanceValidationFailure
    }

export interface DebuggingGuidanceContext {
  readonly likelyIssue: string
  readonly relevantLocation: string
  readonly concept: string
  readonly nextInspectionStep: string
  readonly evidenceQuery: string
  readonly rewriteRequested: boolean
}

export const DEBUGGING_GUIDANCE_FULL_REWRITE_REFUSAL =
  'I cannot provide a complete corrected program, but I can help you inspect the likely defect.'

interface DebuggingGuidanceOutputInput {
  readonly candidate: CandidateResponse
  readonly allowedCitationIds: ReadonlySet<string>
  readonly rewriteRequested: boolean
}

export function validateDebuggingGuidanceOutput(
  input: DebuggingGuidanceOutputInput,
): DebuggingGuidanceValidationResult {
  const { candidate } = input
  if (containsPromptDisclosure(candidate.message)) {
    return rejected(DEBUGGING_GUIDANCE_VALIDATION_FAILURE.PROMPT_DISCLOSURE)
  }
  if (containsExecutionClaim(candidate.message)) {
    return rejected(DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EXECUTION_CLAIM)
  }
  if (containsCompleteProgram(candidate.message)) {
    return rejected(
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.FULL_REWRITE_SUSPECTED,
    )
  }

  const guidance = candidate.debuggingGuidance
  if (guidance === null) {
    return rejected(
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_DEBUGGING_GUIDANCE,
    )
  }

  const componentFailure = validateComponents(guidance)
  if (componentFailure !== null) {
    return rejected(componentFailure)
  }

  if (candidate.usedCitationIds.length === 0) {
    return rejected(
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_AUTHORIZED_CITATION,
    )
  }
  if (
    candidate.usedCitationIds.some(
      (citationId) => !input.allowedCitationIds.has(citationId),
    )
  ) {
    return rejected(
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.INVALID_AUTHORIZED_CITATION,
    )
  }

  const actionFailure = validateInspectionAction(guidance.inspectionActions)
  if (actionFailure !== null) {
    return rejected(actionFailure)
  }
  const action = guidance.inspectionActions[0]
  if (
    candidate.studentAction === null ||
    normalizeContractText(candidate.studentAction.description) !==
      normalizeContractText(action)
  ) {
    return rejected(
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.STRUCTURED_STUDENT_ACTION_MISMATCH,
    )
  }

  const expectedMessage = renderDebuggingGuidanceMessage({
    guidance,
    usedCitationIds: candidate.usedCitationIds,
    action,
    rewriteRequested: input.rewriteRequested,
  })
  if (candidate.message !== expectedMessage) {
    const renderedCitationIds = extractRenderedCitationIds(candidate.message)
    if (!sameOrderedValues(renderedCitationIds, candidate.usedCitationIds)) {
      return rejected(
        DEBUGGING_GUIDANCE_VALIDATION_FAILURE.RENDERED_CITATION_MISMATCH,
      )
    }
    return rejected(
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.RENDERED_RESPONSE_MISMATCH,
    )
  }

  return { approved: true }
}

export function renderDebuggingGuidanceMessage(input: {
  readonly guidance: TutorDebuggingGuidanceResponse
  readonly usedCitationIds: readonly string[]
  readonly action: string
  readonly rewriteRequested: boolean
}): string {
  const citationMarkers = input.usedCitationIds
    .map((citationId) => `[${citationId}]`)
    .join(' ')
  return [
    ...(input.rewriteRequested
      ? [DEBUGGING_GUIDANCE_FULL_REWRITE_REFUSAL, '']
      : []),
    'Likely defect',
    input.guidance.diagnosis?.trim() ?? '',
    '',
    'Relevant location',
    input.guidance.relevantLocation?.trim() ?? '',
    '',
    'Concept',
    `${input.guidance.conceptExplanation?.trim() ?? ''} ${citationMarkers}`.trim(),
    '',
    'Next inspection step',
    input.action.trim(),
  ].join('\n')
}

function validateComponents(
  guidance: TutorDebuggingGuidanceResponse,
): DebuggingGuidanceValidationFailure | null {
  if (guidance.diagnosis === undefined) {
    return DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_DIAGNOSIS
  }
  if (guidance.diagnosis.trim() === '') {
    return DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EMPTY_DIAGNOSIS
  }
  if (guidance.relevantLocation === undefined) {
    return DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_RELEVANT_LOCATION
  }
  if (guidance.relevantLocation.trim() === '') {
    return DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EMPTY_RELEVANT_LOCATION
  }
  if (guidance.conceptExplanation === undefined) {
    return DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_CONCEPT
  }
  if (guidance.conceptExplanation.trim() === '') {
    return DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EMPTY_CONCEPT
  }
  return null
}

function validateInspectionAction(
  actions: readonly string[],
): DebuggingGuidanceValidationFailure | null {
  if (actions.length === 0) {
    return DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_STUDENT_ACTION
  }
  if (actions.length > 1) {
    return DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MULTIPLE_STUDENT_ACTIONS
  }

  const action = actions[0]?.trim() ?? ''
  if (action === '') {
    return DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_STUDENT_ACTION
  }
  if (hasMultipleActions(action)) {
    return DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MULTIPLE_STUDENT_ACTIONS
  }
  if (!isMeaningfulInspectionAction(action)) {
    return DEBUGGING_GUIDANCE_VALIDATION_FAILURE.INVALID_STUDENT_ACTION
  }
  return null
}

function isMeaningfulInspectionAction(action: string): boolean {
  const trimmed = action.trim()
  return Array.from(trimmed).length >= 12 && /\p{L}{3,}/u.test(trimmed)
}

function hasMultipleActions(action: string): boolean {
  if (
    /(?:^|\n|\s)(?:1[.)]|step\s*1[:.]?)\s+\S.*?(?:\n|\s)(?:2[.)]|step\s*2[:.]?)\s+\S/iu.test(
      action,
    )
  ) {
    return true
  }
  if (/(?:^|\n)\s*[-*•]\s+\S.*?\n\s*[-*•]\s+\S/u.test(action)) {
    return true
  }
  if (
    /\b(?:and|then|[.;])\s+(?:rewrite|modify|fix|correct the code|change the code)\b/iu.test(
      action,
    )
  ) {
    return true
  }
  return false
}

function containsCompleteProgram(content: string): boolean {
  if (/(?:^|\n)\s*(?:```|~~~)/u.test(content)) {
    return true
  }
  return /(?:^|\n)\s*(?:async\s+)?(?:def|class|function)\s+[A-Za-z_][A-Za-z0-9_]*/mu.test(
    content,
  )
}

function containsPromptDisclosure(content: string): boolean {
  return /<<<(?:BEGIN|END)_MORSHID_|\b(?:hidden\s+)?system\s+(?:instructions?|prompt)\s+(?:are|says?|said|state)|\bauthoritative\s+system\s+message\b/iu.test(
    content,
  )
}

function containsExecutionClaim(content: string): boolean {
  return /\b(?:I|we)\s+(?:have\s+)?(?:executed|ran|run|tested)\s+(?:(?:the|this|your)\s+)?(?:code|program|script)\b|\b(?:executing|running)\s+(?:(?:the|this|your)\s+)?(?:code|program|script)\s+(?:produced|returned|showed|shows)\b/iu.test(
    content,
  )
}

function extractRenderedCitationIds(content: string): readonly string[] {
  return [...content.matchAll(/\[([^\]\r\n]+)\]/gu)].map((match) => match[1])
}

function sameOrderedValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function normalizeContractText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ')
}

function rejected(
  failure: DebuggingGuidanceValidationFailure,
): DebuggingGuidanceValidationResult {
  return { approved: false, failure }
}
