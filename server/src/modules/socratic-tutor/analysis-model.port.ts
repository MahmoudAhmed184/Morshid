export const ANALYSIS_MODEL_PORT = Symbol('AnalysisModelPort')

export const ANALYSIS_PROVIDER_ROLE = 'analysis'

export const ANALYSIS_MODEL_ERROR_CODE = {
  TIMEOUT: 'ANALYSIS_MODEL_TIMEOUT',
  RATE_LIMITED: 'ANALYSIS_MODEL_RATE_LIMITED',
  TRANSPORT_FAILURE: 'ANALYSIS_MODEL_TRANSPORT_FAILURE',
  PROVIDER_UNAVAILABLE: 'ANALYSIS_MODEL_PROVIDER_UNAVAILABLE',
  MALFORMED_OUTPUT: 'ANALYSIS_MODEL_MALFORMED_OUTPUT',
  UNSUPPORTED_RESPONSE: 'ANALYSIS_MODEL_UNSUPPORTED_RESPONSE',
  CANCELLED: 'ANALYSIS_MODEL_CANCELLED',
  CONFIGURATION_INVALID: 'ANALYSIS_MODEL_CONFIGURATION_INVALID',
} as const

export type AnalysisModelErrorCode =
  (typeof ANALYSIS_MODEL_ERROR_CODE)[keyof typeof ANALYSIS_MODEL_ERROR_CODE]

export interface AnalysisModelMessage {
  readonly role: 'system' | 'user'
  readonly content: string
}

export interface AnalysisModelRequest {
  readonly messages: readonly [AnalysisModelMessage, AnalysisModelMessage]
  readonly promptVersion: string
  readonly responseSchemaName: 'EducationalAnalysisResult'
  readonly signal?: AbortSignal
}

export interface AnalysisModelResponse {
  readonly rawOutput: unknown
  readonly provider: string
  readonly model: string
  readonly modelVersion?: string
  readonly promptVersion: string
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly latencyMs?: number
}

export interface AnalysisModelPort {
  analyze(request: AnalysisModelRequest): Promise<AnalysisModelResponse>
}

const SAFE_ERROR_MESSAGES = {
  [ANALYSIS_MODEL_ERROR_CODE.TIMEOUT]: 'Analysis model timed out',
  [ANALYSIS_MODEL_ERROR_CODE.RATE_LIMITED]:
    'Analysis model rate limit reached',
  [ANALYSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE]:
    'Analysis model transport failed',
  [ANALYSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE]:
    'Analysis model provider is unavailable',
  [ANALYSIS_MODEL_ERROR_CODE.MALFORMED_OUTPUT]:
    'Analysis model returned malformed structured output',
  [ANALYSIS_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE]:
    'Analysis model response is unsupported',
  [ANALYSIS_MODEL_ERROR_CODE.CANCELLED]: 'Analysis model call was cancelled',
  [ANALYSIS_MODEL_ERROR_CODE.CONFIGURATION_INVALID]:
    'Analysis model configuration is invalid',
} as const satisfies Record<AnalysisModelErrorCode, string>

export class AnalysisModelError extends Error {
  readonly code: AnalysisModelErrorCode

  constructor(code: AnalysisModelErrorCode) {
    super(SAFE_ERROR_MESSAGES[code])
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'AnalysisModelError',
    })
    this.code = code
  }
}
