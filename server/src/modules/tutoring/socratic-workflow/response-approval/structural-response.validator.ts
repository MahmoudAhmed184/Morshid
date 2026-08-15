import { Injectable } from '@nestjs/common'

import {
  ReflectionMode,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import {
  CandidateResponseContentSchema,
  validateCandidateResponse,
} from '../generation/tutor-candidate.schema'
import {
  TUTOR_CANDIDATE_LIMITS,
  type CandidateResponse,
  type CandidateResponsePolicyContext,
} from '../generation/tutor-generation.types'
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
export class StructuralResponseValidator {
  validate(
    candidate: CandidateResponse,
    context: CandidateValidationContext,
  ): ValidationResult {
    const content = {
      message: candidate.debuggingGuidance === null ? candidate.message : null,
      debuggingGuidance: candidate.debuggingGuidance,
      responseIntent: candidate.responseIntent,
      usedCitationIds: candidate.usedCitationIds,
      requiresStudentAction: candidate.requiresStudentAction,
      studentAction:
        candidate.debuggingGuidance === null ? candidate.studentAction : null,
      reflectionIncluded: candidate.reflectionIncluded,
      selfReportedCompliance: candidate.selfReportedCompliance,
    }

    const parsed = CandidateResponseContentSchema.safeParse(content)
    if (!parsed.success) {
      return reject([
        violation(
          RESPONSE_VIOLATION_TYPE.MALFORMED_RESPONSE,
          RESPONSE_VALIDATION_SEVERITY.CRITICAL,
          null,
          'Candidate content no longer matches the required schema.',
          'Return only the required CandidateResponse fields with valid values.',
        ),
      ])
    }

    const policy: CandidateResponsePolicyContext = {
      allowedCitationIds: context.allowedCitationIds,
      requireGrounding: context.requireGrounding,
      enforceCitationSupport: context.enforceCitationSupport,
      requireStudentAction: context.requireStudentAction,
      reflectionMode: context.reflectionMode,
      debuggingGuidanceRequired: context.debuggingGuidanceRequired,
      debuggingRewriteRequested: context.debuggingGuidance?.rewriteRequested,
      studentActionType: context.primaryTechnique,
    }
    const validation = validateCandidateResponse(content, policy, {
      provider: candidate.provider,
      model: candidate.model,
      tokenUsage: candidate.tokenUsage,
    })
    if (!validation.success) {
      return reject([violationForGenerationFailure(validation.errorCode)])
    }

    return approvedValidationResult(RESPONSE_VALIDATION_STAGE.STRUCTURAL, {
      provider: candidate.provider,
      model: candidate.model,
      promptVersion: candidate.promptVersion,
    })
  }

  validateRaw(
    rawOutput: unknown,
    policy: CandidateResponsePolicyContext,
    metadata: Pick<CandidateResponse, 'provider' | 'model' | 'tokenUsage'>,
  ): ValidationResult {
    const validation = validateCandidateResponse(rawOutput, policy, metadata)
    if (validation.success) {
      return approvedValidationResult(RESPONSE_VALIDATION_STAGE.STRUCTURAL, {
        provider: metadata.provider,
        model: metadata.model,
      })
    }

    return reject([violationForGenerationFailure(validation.errorCode)])
  }
}

export function structuralRejectionFromGenerationFailure(
  errorCode: string,
): ValidationResult {
  return reject([violationForGenerationFailure(errorCode)])
}

function violationForGenerationFailure(
  errorCode: string,
): ResponseValidationViolation {
  switch (errorCode) {
    case 'TUTOR_MALFORMED_OUTPUT':
      return violation(
        RESPONSE_VIOLATION_TYPE.MALFORMED_RESPONSE,
        RESPONSE_VALIDATION_SEVERITY.CRITICAL,
        null,
        'Candidate was not parseable as the required response object.',
        'Return a valid CandidateResponse JSON object with every required field.',
      )
    case 'TUTOR_INVALID_CITATION':
      return violation(
        RESPONSE_VIOLATION_TYPE.INVALID_CITATION,
        RESPONSE_VALIDATION_SEVERITY.HIGH,
        'usedCitationIds',
        'Candidate did not satisfy the backend citation grounding requirement.',
        'Use an allowed citation when grounding and citation support are required.',
      )
    default:
      return violation(
        RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_FIELD,
        RESPONSE_VALIDATION_SEVERITY.HIGH,
        null,
        'Candidate failed required schema or backend-owned metadata checks.',
        'Return only the content fields and do not include approval or backend metadata.',
      )
  }
}

export function buildCandidateValidationContext(input: {
  readonly allowedCitationIds: ReadonlySet<string>
  readonly requireGrounding: boolean
  readonly enforceCitationSupport: boolean
  readonly requireStudentAction: boolean
  readonly reflectionMode: ReflectionMode
  readonly responseIntent: TeachingStrategy
  readonly primaryTechnique: TeachingTechnique
  readonly guidanceLevel: number
  readonly revealPolicy: CandidateValidationContext['revealPolicy']
  readonly maximumDisclosedSteps: number
  readonly debuggingGuidance?: CandidateValidationContext['debuggingGuidance']
  readonly debuggingGuidanceRequired?: boolean
}): CandidateValidationContext {
  return Object.freeze({ ...input })
}

function reject(
  violations: readonly ResponseValidationViolation[],
): ValidationResult {
  return rejectedValidationResult(
    RESPONSE_VALIDATION_STAGE.STRUCTURAL,
    violations,
    RESPONSE_VALIDATION_ACTION.REGENERATE,
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
    evidence: evidence.slice(
      0,
      TUTOR_CANDIDATE_LIMITS.maxStudentActionDescriptionCodePoints,
    ),
    regenerationInstruction,
  })
}
