import { Inject, Injectable, Logger } from '@nestjs/common'

import {
  assertRequestBudget,
  RequestBudgetExceededError,
  type RequestBudgetOptions,
} from '../../../../common/http/request-deadline'
import {
  readUpstreamFailure,
  waitForRetry,
} from '../../../../platform/ai/upstream/upstream-retry-policy'
import type { AnalysisContextPackage } from './analysis-context.types'
import {
  ANALYSIS_CONFIDENCE_POLICY,
  AnalysisConfidencePolicy,
} from './analysis-confidence-policy'
import {
  ANALYSIS_FALLBACK_MODEL,
  ANALYSIS_FALLBACK_PROVIDER,
  AnalysisFallbackBuilder,
} from './analysis-fallback-builder'
import {
  ANALYSIS_MODEL_ERROR_CODE,
  ANALYSIS_MODEL_PORT,
  type AnalysisModelMessage,
  type AnalysisModelRequest,
  type AnalysisModelErrorCode,
  type AnalysisModelResponse,
  type AnalysisModelPort,
  AnalysisModelError,
} from './analysis-model.port'
import {
  ANALYSIS_RETRY_POLICY,
  AnalysisRetryPolicy,
} from './analysis-retry-policy'
import { buildEducationalAnalysisModelRequest } from './educational-analysis.prompt'
import { reconcileEducationalAnalysisRequestKind } from './educational-analysis.reconciler'
import {
  EducationalAnalysisRepository,
  type PersistedEducationalAnalysisRecord,
} from './educational-analysis.repository'
import {
  EDUCATIONAL_ANALYSIS_FALLBACK_REASON,
  EDUCATIONAL_ANALYSIS_SOURCE,
  type EducationalAnalysisFallbackReason,
  type EducationalAnalysisValidationIssue,
  type EducationalAnalysisValidationResult,
} from './educational-analysis.types'
import { validateEducationalAnalysisResult } from './educational-analysis.validator'

export const EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY = {
  INVALID_CONTEXT: 'invalid_context',
  PROVIDER_FAILURE: 'provider_failure',
  VALIDATION_FAILURE: 'validation_failure',
  PERSISTENCE_FAILURE: 'persistence_failure',
} as const

export type EducationalAnalysisFailureCategory =
  (typeof EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY)[keyof typeof EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY]

export type EducationalAnalysisServiceResult =
  | {
      readonly success: true
      readonly analysis: PersistedEducationalAnalysisRecord
      readonly reused: boolean
      readonly source: PersistedEducationalAnalysisRecord['analysisSource']
      readonly fallbackReason: PersistedEducationalAnalysisRecord['fallbackReason']
    }
  | {
      readonly success: false
      readonly category: typeof EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY.INVALID_CONTEXT
      readonly errorCode: 'ANALYSIS_CONTEXT_MISSING_TURN'
    }
  | {
      readonly success: false
      readonly category: typeof EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY.PROVIDER_FAILURE
      readonly errorCode: AnalysisModelErrorCode
    }
  | {
      readonly success: false
      readonly category: typeof EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY.VALIDATION_FAILURE
      readonly errorCode: 'ANALYSIS_VALIDATION_FAILED'
      readonly issues: readonly EducationalAnalysisValidationIssue[]
    }
  | {
      readonly success: false
      readonly category: typeof EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY.PERSISTENCE_FAILURE
      readonly errorCode: 'ANALYSIS_PERSISTENCE_FAILED'
    }

export interface AnalyzeEducationalContextOptions {
  readonly forceReanalysis?: boolean
  readonly signal?: AbortSignal
  readonly deadlineAt?: number
}

@Injectable()
export class EducationalAnalysisService {
  private readonly logger = new Logger(EducationalAnalysisService.name)

  constructor(
    @Inject(ANALYSIS_MODEL_PORT)
    private readonly analysisModelPort: AnalysisModelPort,
    private readonly educationalAnalysisRepository: EducationalAnalysisRepository,
    private readonly fallbackBuilder: AnalysisFallbackBuilder = new AnalysisFallbackBuilder(),
    @Inject(ANALYSIS_CONFIDENCE_POLICY)
    private readonly confidencePolicy: AnalysisConfidencePolicy = new AnalysisConfidencePolicy(),
    @Inject(ANALYSIS_RETRY_POLICY)
    private readonly retryPolicy: AnalysisRetryPolicy = new AnalysisRetryPolicy(),
  ) {}

  async analyze(
    context: AnalysisContextPackage,
    options: AnalyzeEducationalContextOptions = {},
  ): Promise<EducationalAnalysisServiceResult> {
    assertRequestBudget(options)
    const identity = analysisIdentityFromContext(context)
    if (identity === null) {
      return {
        success: false,
        category: EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY.INVALID_CONTEXT,
        errorCode: 'ANALYSIS_CONTEXT_MISSING_TURN',
      }
    }

    const forceReanalysis = options.forceReanalysis === true
    if (!forceReanalysis) {
      const existing =
        await this.educationalAnalysisRepository.findLatestAccepted(identity)
      assertRequestBudget(options)
      if (existing !== null) {
        return {
          success: true,
          analysis: existing,
          reused: true,
          source: existing.analysisSource,
          fallbackReason: existing.fallbackReason,
        }
      }
    }

    let modelRequest = buildEducationalAnalysisModelRequest(
      context,
      options.signal,
    )

    let retriesUsed = 0
    for (;;) {
      assertRequestBudget(options)
      let modelResponse: AnalysisModelResponse
      try {
        modelResponse = await this.analysisModelPort.analyze(modelRequest)
      } catch (error) {
        assertRequestBudget(options)
        const errorCode = providerFailureCode(error)
        const upstreamFailure = readUpstreamFailure(error, Date.now())
        if (
          upstreamFailure.retryable &&
          this.retryPolicy.canRetryProviderError(errorCode, retriesUsed)
        ) {
          retriesUsed += 1
          await waitForRetry(
            upstreamFailure.retryDelayMs,
            options.signal ?? new AbortController().signal,
            () => new RequestBudgetExceededError(),
          )
          assertRequestBudget(options)
          continue
        }

        return this.persistFallback(context, {
          identity,
          forceReanalysis,
          fallbackReason: fallbackReasonFromProviderError(errorCode),
          failureCategory: errorCode,
          infrastructureRetryCount: retriesUsed,
          budget: options,
        })
      }

      assertRequestBudget(options)

      const validation = validateEducationalAnalysisResult(
        modelResponse.rawOutput,
        context,
      )
      if (!validation.success) {
        if (this.retryPolicy.canRetryInvalidStructuredOutput(retriesUsed)) {
          retriesUsed += 1
          modelRequest = analysisRequestWithValidationCorrection(
            modelRequest,
            validation.issues,
          )
          assertRequestBudget(options)
          continue
        }

        return this.persistFallback(context, {
          identity,
          forceReanalysis,
          fallbackReason: fallbackReasonFromValidation(validation),
          failureCategory: 'analysis_validation_failed',
          infrastructureRetryCount: retriesUsed,
          budget: options,
        })
      }

      if (!this.confidencePolicy.accepts(validation.data)) {
        return this.persistFallback(context, {
          identity,
          forceReanalysis,
          fallbackReason: EDUCATIONAL_ANALYSIS_FALLBACK_REASON.LOW_CONFIDENCE,
          failureCategory: 'analysis_confidence_below_threshold',
          infrastructureRetryCount: retriesUsed,
          budget: options,
        })
      }

      const acceptedResult = reconcileEducationalAnalysisRequestKind(
        validation.data,
        context,
      )

      try {
        assertRequestBudget(options)
        const stored = await this.educationalAnalysisRepository.storeAccepted({
          ...identity,
          result: acceptedResult,
          modelResponse,
          forceReanalysis,
          metadata: {
            analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
            fallbackReason: null,
            failureCategory: null,
            confidencePolicyVersion: this.confidencePolicy.version,
            infrastructureRetryCount: retriesUsed,
          },
        })

        this.logAnalysisOutcome({
          attemptId: identity.attemptId,
          topicId: identity.topicId,
          status: stored.kind,
          analysisSource: stored.analysis.analysisSource,
          fallbackReason: stored.analysis.fallbackReason,
          infrastructureRetryCount: retriesUsed,
        })

        return {
          success: true,
          analysis: stored.analysis,
          reused: stored.kind === 'reused',
          source: stored.analysis.analysisSource,
          fallbackReason: stored.analysis.fallbackReason,
        }
      } catch {
        return {
          success: false,
          category: EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY.PERSISTENCE_FAILURE,
          errorCode: 'ANALYSIS_PERSISTENCE_FAILED',
        }
      }
    }
  }

  private async persistFallback(
    context: AnalysisContextPackage,
    input: {
      identity: NonNullable<ReturnType<typeof analysisIdentityFromContext>>
      forceReanalysis: boolean
      fallbackReason: EducationalAnalysisFallbackReason
      failureCategory: string
      infrastructureRetryCount: number
      budget: RequestBudgetOptions
    },
  ): Promise<EducationalAnalysisServiceResult> {
    assertRequestBudget(input.budget)
    const fallback = this.fallbackBuilder.build(context)
    const validation = validateEducationalAnalysisResult(fallback, context)
    if (!validation.success) {
      return validationFailure(validation)
    }

    try {
      assertRequestBudget(input.budget)
      const stored = await this.educationalAnalysisRepository.storeAccepted({
        ...input.identity,
        result: validation.data,
        modelResponse: {
          rawOutput: validation.data,
          provider: ANALYSIS_FALLBACK_PROVIDER,
          model: ANALYSIS_FALLBACK_MODEL,
          modelVersion: ANALYSIS_FALLBACK_MODEL,
          promptVersion: 'backend-analysis-fallback.v1',
        },
        forceReanalysis: input.forceReanalysis,
        metadata: {
          analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK,
          fallbackReason: input.fallbackReason,
          failureCategory: input.failureCategory,
          confidencePolicyVersion: this.confidencePolicy.version,
          infrastructureRetryCount: input.infrastructureRetryCount,
        },
      })

      this.logAnalysisOutcome({
        attemptId: input.identity.attemptId,
        topicId: input.identity.topicId,
        status: stored.kind,
        analysisSource: stored.analysis.analysisSource,
        fallbackReason: stored.analysis.fallbackReason,
        infrastructureRetryCount: input.infrastructureRetryCount,
      })

      return {
        success: true,
        analysis: stored.analysis,
        reused: stored.kind === 'reused',
        source: stored.analysis.analysisSource,
        fallbackReason: stored.analysis.fallbackReason,
      }
    } catch {
      return {
        success: false,
        category: EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY.PERSISTENCE_FAILURE,
        errorCode: 'ANALYSIS_PERSISTENCE_FAILED',
      }
    }
  }

  private logAnalysisOutcome(input: {
    attemptId: string
    topicId: string
    status: 'created' | 'reused'
    analysisSource: string
    fallbackReason: string | null
    infrastructureRetryCount: number
  }): void {
    this.logger.log({
      stage: 'educational_analysis',
      attemptId: input.attemptId,
      topicId: input.topicId,
      status: input.status,
      confidencePolicyVersion: this.confidencePolicy.version,
      analysisSource: input.analysisSource,
      fallbackReason: input.fallbackReason,
      infrastructureRetryCount: input.infrastructureRetryCount,
    })
  }
}

function analysisIdentityFromContext(context: AnalysisContextPackage) {
  if (context.studentMessage.attemptId === null) {
    return null
  }

  return {
    attemptId: context.studentMessage.attemptId,
    topicId: context.activeTopic.id,
    studentMessageId: context.studentMessage.id,
  }
}

function analysisRequestWithValidationCorrection(
  request: AnalysisModelRequest,
  issues: readonly EducationalAnalysisValidationIssue[],
): AnalysisModelRequest {
  const issueSummary = issues
    .slice(0, 8)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join('; ')
    .slice(0, 1_000)
  const correction = [
    request.messages[0].content,
    '',
    'Backend validation feedback for the previous response:',
    issueSummary,
    'Return a new JSON object that satisfies the complete contract. Do not repeat the invalid shape.',
  ].join('\n')
  const messages: readonly [AnalysisModelMessage, AnalysisModelMessage] = [
    Object.freeze({ role: 'system', content: correction }),
    request.messages[1],
  ]

  return Object.freeze({
    ...request,
    messages,
  })
}

function providerFailureCode(error: unknown): AnalysisModelErrorCode {
  if (error instanceof AnalysisModelError) {
    return error.code
  }

  return ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE
}

function fallbackReasonFromProviderError(
  errorCode: AnalysisModelErrorCode,
): EducationalAnalysisFallbackReason {
  switch (errorCode) {
    case ANALYSIS_MODEL_ERROR_CODE.TIMEOUT:
      return EDUCATIONAL_ANALYSIS_FALLBACK_REASON.PROVIDER_TIMEOUT
    case ANALYSIS_MODEL_ERROR_CODE.RATE_LIMITED:
      return EDUCATIONAL_ANALYSIS_FALLBACK_REASON.RATE_LIMIT
    case ANALYSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE:
      return EDUCATIONAL_ANALYSIS_FALLBACK_REASON.PROVIDER_UNAVAILABLE
    case ANALYSIS_MODEL_ERROR_CODE.MALFORMED_OUTPUT:
      return EDUCATIONAL_ANALYSIS_FALLBACK_REASON.MALFORMED_OUTPUT
    case ANALYSIS_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE:
    case ANALYSIS_MODEL_ERROR_CODE.CANCELLED:
    case ANALYSIS_MODEL_ERROR_CODE.CONFIGURATION_INVALID:
      return EDUCATIONAL_ANALYSIS_FALLBACK_REASON.UNSUPPORTED_OUTPUT
    case ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE:
      return EDUCATIONAL_ANALYSIS_FALLBACK_REASON.PROVIDER_TRANSPORT
  }
}

function fallbackReasonFromValidation(
  validation: Extract<EducationalAnalysisValidationResult, { success: false }>,
): EducationalAnalysisFallbackReason {
  return validation.issues.some(
    (issue) =>
      issue.category === 'invalid_enum' ||
      issue.category === 'unsupported_schema_version',
  )
    ? EDUCATIONAL_ANALYSIS_FALLBACK_REASON.UNSUPPORTED_OUTPUT
    : EDUCATIONAL_ANALYSIS_FALLBACK_REASON.SCHEMA_VALIDATION
}

function validationFailure(
  validation: Extract<EducationalAnalysisValidationResult, { success: false }>,
): EducationalAnalysisServiceResult {
  return {
    success: false,
    category: EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY.VALIDATION_FAILURE,
    errorCode: 'ANALYSIS_VALIDATION_FAILED',
    issues: validation.issues,
  }
}
