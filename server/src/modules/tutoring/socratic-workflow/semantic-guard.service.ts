import { Inject, Injectable } from '@nestjs/common'
import { z } from 'zod'

import { assertRequestBudget } from '../../../common/http/request-deadline'
import {
  RESPONSE_VALIDATION_ACTION,
  RESPONSE_VALIDATION_SEVERITY,
  RESPONSE_VALIDATION_STAGE,
  RESPONSE_VIOLATION_TYPE,
  type ResponseValidationViolation,
  approvedValidationResult,
  rejectedValidationResult,
} from './response-validation.types'
import {
  SEMANTIC_GUARD_ERROR_CODE,
  SEMANTIC_GUARD_PORT,
  SEMANTIC_GUARD_PROMPT_VERSION,
  SemanticGuardModelError,
  type SemanticGuardEvaluationInput,
  type SemanticGuardPort,
  type SemanticGuardServiceResult,
} from './semantic-guard.types'
import { buildSemanticGuardRequest } from './semantic-guard.prompt'

const SemanticGuardOutputSchema = z
  .object({
    approved: z.boolean(),
    violations: z
      .array(
        z
          .object({
            type: z
              .enum(RESPONSE_VIOLATION_TYPE)
              .catch(RESPONSE_VIOLATION_TYPE.SEMANTIC_POLICY_VIOLATION),
            severity: z.enum(RESPONSE_VALIDATION_SEVERITY),
            field: z.string().trim().max(80).nullable().catch(null),
            evidence: z.string().trim().min(1).max(240),
            regenerationInstruction: z.string().trim().min(1).max(240),
          })
          .strict(),
      )
      .max(8),
  })
  .strict()
  .refine((value) => value.approved === (value.violations.length === 0), {
    message: 'Approved guard output must not include violations',
  })

@Injectable()
export class SemanticGuardService {
  constructor(
    @Inject(SEMANTIC_GUARD_PORT)
    private readonly semanticGuardPort: SemanticGuardPort,
  ) {}

  async evaluate(
    input: SemanticGuardEvaluationInput,
  ): Promise<SemanticGuardServiceResult> {
    assertRequestBudget(input)
    const request = buildSemanticGuardRequest(input)

    try {
      const response = await this.semanticGuardPort.evaluate(request)
      assertRequestBudget(input)
      const parsed = parseGuardOutput(response.rawOutput)
      if (parsed === null) {
        return infrastructureFailure(SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT)
      }

      if (parsed.approved) {
        return {
          kind: 'validated',
          result: approvedValidationResult(RESPONSE_VALIDATION_STAGE.SEMANTIC, {
            provider: response.provider,
            model: response.model,
            promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
          }),
        }
      }

      return {
        kind: 'validated',
        result: rejectedValidationResult(
          RESPONSE_VALIDATION_STAGE.SEMANTIC,
          parsed.violations,
          RESPONSE_VALIDATION_ACTION.REGENERATE,
          {
            provider: response.provider,
            model: response.model,
            promptVersion: SEMANTIC_GUARD_PROMPT_VERSION,
          },
        ),
      }
    } catch (error) {
      assertRequestBudget(input)
      return infrastructureFailure(semanticFailureCode(error))
    }
  }
}

function parseGuardOutput(rawOutput: unknown): {
  approved: boolean
  violations: readonly ResponseValidationViolation[]
} | null {
  const candidate =
    typeof rawOutput === 'string' ? parseJsonObject(rawOutput) : rawOutput
  const parsed = SemanticGuardOutputSchema.safeParse(candidate)
  return parsed.success
    ? {
        approved: parsed.data.approved,
        violations: parsed.data.violations.map((item) =>
          Object.freeze({
            type: item.type,
            severity: item.severity,
            field: item.field,
            evidence: item.evidence,
            regenerationInstruction: item.regenerationInstruction,
          }),
        ),
      }
    : null
}

function parseJsonObject(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function infrastructureFailure(
  errorCode: (typeof SEMANTIC_GUARD_ERROR_CODE)[keyof typeof SEMANTIC_GUARD_ERROR_CODE],
): SemanticGuardServiceResult {
  return {
    kind: 'infrastructure_failure',
    errorCode,
    result: rejectedValidationResult(
      RESPONSE_VALIDATION_STAGE.SEMANTIC,
      [
        Object.freeze({
          type:
            errorCode === SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT
              ? RESPONSE_VIOLATION_TYPE.GUARD_MALFORMED_OUTPUT
              : RESPONSE_VIOLATION_TYPE.GUARD_UNAVAILABLE,
          severity: RESPONSE_VALIDATION_SEVERITY.CRITICAL,
          field: null,
          evidence: 'Semantic Guard approval could not be established.',
          regenerationInstruction:
            'Use deterministic safe fallback; do not regenerate for guard infrastructure failure.',
        }),
      ],
      RESPONSE_VALIDATION_ACTION.USE_SAFE_FALLBACK,
      { promptVersion: SEMANTIC_GUARD_PROMPT_VERSION },
    ),
  }
}

function semanticFailureCode(error: unknown) {
  if (error instanceof SemanticGuardModelError) {
    return error.code
  }
  return SEMANTIC_GUARD_ERROR_CODE.TRANSPORT_FAILURE
}
