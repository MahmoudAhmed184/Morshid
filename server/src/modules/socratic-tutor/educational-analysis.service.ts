import { Inject, Injectable } from '@nestjs/common'

import type { AnalysisContextPackage } from './analysis-context.types'
import {
  ANALYSIS_MODEL_ERROR_CODE,
  ANALYSIS_MODEL_PORT,
  type AnalysisModelErrorCode,
  type AnalysisModelPort,
  AnalysisModelError,
} from './analysis-model.port'
import { buildEducationalAnalysisModelRequest } from './educational-analysis.prompt'
import {
  EducationalAnalysisRepository,
  type PersistedEducationalAnalysisRecord,
} from './educational-analysis.repository'
import {
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
}

@Injectable()
export class EducationalAnalysisService {
  constructor(
    @Inject(ANALYSIS_MODEL_PORT)
    private readonly analysisModelPort: AnalysisModelPort,
    private readonly educationalAnalysisRepository: EducationalAnalysisRepository,
  ) {}

  async analyze(
    context: AnalysisContextPackage,
    options: AnalyzeEducationalContextOptions = {},
  ): Promise<EducationalAnalysisServiceResult> {
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
      if (existing !== null) {
        return {
          success: true,
          analysis: existing,
          reused: true,
        }
      }
    }

    const modelRequest = buildEducationalAnalysisModelRequest(
      context,
      options.signal,
    )

    let modelResponse
    try {
      modelResponse = await this.analysisModelPort.analyze(modelRequest)
    } catch (error) {
      return {
        success: false,
        category: EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY.PROVIDER_FAILURE,
        errorCode: providerFailureCode(error),
      }
    }

    const validation = validateEducationalAnalysisResult(
      modelResponse.rawOutput,
      context,
    )
    if (!validation.success) {
      return validationFailure(validation)
    }

    try {
      const stored = await this.educationalAnalysisRepository.storeAccepted({
        ...identity,
        result: validation.data,
        modelResponse,
        forceReanalysis,
      })

      return {
        success: true,
        analysis: stored.analysis,
        reused: stored.kind === 'reused',
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

function analysisIdentityFromContext(context: AnalysisContextPackage) {
  if (context.studentMessage.turnId === null) {
    return null
  }

  return {
    turnId: context.studentMessage.turnId,
    topicId: context.activeTopic.id,
    studentMessageId: context.studentMessage.id,
  }
}

function providerFailureCode(error: unknown): AnalysisModelErrorCode {
  if (error instanceof AnalysisModelError) {
    return error.code
  }

  return ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE
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
