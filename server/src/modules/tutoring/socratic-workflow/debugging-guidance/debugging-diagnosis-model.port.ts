export const DEBUGGING_DIAGNOSIS_MODEL_PORT = Symbol(
  'DebuggingDiagnosisModelPort',
)

export const DEBUGGING_DIAGNOSIS_MODEL_PROMPT_VERSION = 'debugging-diagnosis.v1'

export const DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE = {
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  TRANSPORT_FAILURE: 'TRANSPORT_FAILURE',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  MALFORMED_OUTPUT: 'MALFORMED_OUTPUT',
  UNSUPPORTED_RESPONSE: 'UNSUPPORTED_RESPONSE',
  CANCELLED: 'CANCELLED',
  CONFIGURATION_INVALID: 'CONFIGURATION_INVALID',
} as const

export type DebuggingDiagnosisModelErrorCode =
  (typeof DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE)[keyof typeof DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE]

export class DebuggingDiagnosisModelError extends Error {
  readonly status?: number
  readonly headers?: Headers
  readonly provider?: string
  readonly model?: string

  constructor(
    readonly code: DebuggingDiagnosisModelErrorCode,
    metadata: {
      readonly status?: number
      readonly headers?: Headers
      readonly provider?: string
      readonly model?: string
    } = {},
  ) {
    super(`Debugging diagnosis model failure: ${code}`)
    this.status = metadata.status
    this.headers = metadata.headers
    this.provider = metadata.provider
    this.model = metadata.model
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'DebuggingDiagnosisModelError',
    })
  }
}

export interface DebuggingDiagnosisModelRequest {
  readonly messages: readonly [
    { readonly role: 'system'; readonly content: string },
    { readonly role: 'user'; readonly content: string },
  ]
  readonly promptVersion: typeof DEBUGGING_DIAGNOSIS_MODEL_PROMPT_VERSION
  readonly responseSchemaName: 'DebuggingDiagnosisResult'
  readonly signal?: AbortSignal
}

export interface DebuggingDiagnosisModelResponse {
  readonly rawOutput: unknown
  readonly provider: string
  readonly model: string
  readonly promptVersion: typeof DEBUGGING_DIAGNOSIS_MODEL_PROMPT_VERSION
  readonly inputTokens?: number
  readonly outputTokens?: number
}

export interface DebuggingDiagnosisModelPort {
  diagnose(
    request: DebuggingDiagnosisModelRequest,
  ): Promise<DebuggingDiagnosisModelResponse>
}
