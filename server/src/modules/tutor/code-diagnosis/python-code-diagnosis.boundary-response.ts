import { MessageGuidanceLabel } from '../../../generated/prisma/client'

import type { RejectedPythonCodeDiagnosisBoundaryAssessment } from './python-code-diagnosis.boundary'
import { PYTHON_CODE_DIAGNOSIS_MAX_LINES } from './python-code-diagnosis.contract'

export const PYTHON_CODE_DIAGNOSIS_BOUNDARY_ERROR_CODES = {
  CLEARLY_NON_PYTHON: 'PYTHON_DIAGNOSIS_NON_PYTHON',
  INSUFFICIENT_INFORMATION: 'PYTHON_DIAGNOSIS_MORE_INFORMATION_REQUIRED',
  TOO_MANY_LINES: 'PYTHON_DIAGNOSIS_LINE_LIMIT_EXCEEDED',
  UNSUPPORTED_SCOPE: 'PYTHON_DIAGNOSIS_UNSUPPORTED_SCOPE',
} as const

export interface PythonCodeDiagnosisBoundaryResponse {
  readonly content: string
  readonly errorCode: (typeof PYTHON_CODE_DIAGNOSIS_BOUNDARY_ERROR_CODES)[keyof typeof PYTHON_CODE_DIAGNOSIS_BOUNDARY_ERROR_CODES]
  readonly guidanceLabel: typeof MessageGuidanceLabel.REFUSAL
}

export function buildPythonCodeDiagnosisBoundaryResponse(
  assessment: RejectedPythonCodeDiagnosisBoundaryAssessment,
): PythonCodeDiagnosisBoundaryResponse {
  const response = (() => {
    switch (assessment.state) {
      case 'CLEARLY_NON_PYTHON':
        return {
          content:
            'I can diagnose Python code only. Please send one Python snippet of at most 100 lines, and I will help you inspect it without running it.',
          errorCode:
            PYTHON_CODE_DIAGNOSIS_BOUNDARY_ERROR_CODES.CLEARLY_NON_PYTHON,
        }
      case 'INSUFFICIENT_INFORMATION':
        return {
          content:
            'I need a short Python snippet or the exact Python error before I can diagnose the problem. Please share one snippet of at most 100 lines.',
          errorCode:
            PYTHON_CODE_DIAGNOSIS_BOUNDARY_ERROR_CODES.INSUFFICIENT_INFORMATION,
        }
      case 'TOO_MANY_LINES':
        return {
          content: `This Python snippet has ${String(assessment.lineCount)} normalized lines. I can diagnose at most ${String(PYTHON_CODE_DIAGNOSIS_MAX_LINES)} lines, so please shorten it to the smallest relevant snippet and send it again.`,
          errorCode: PYTHON_CODE_DIAGNOSIS_BOUNDARY_ERROR_CODES.TOO_MANY_LINES,
        }
      case 'UNSUPPORTED_SCOPE':
        return {
          content:
            'I can diagnose one Python snippet at a time, not multiple files or code blocks. Please send the smallest single snippet that contains the problem.',
          errorCode:
            PYTHON_CODE_DIAGNOSIS_BOUNDARY_ERROR_CODES.UNSUPPORTED_SCOPE,
        }
      default:
        throw new TypeError('Unsupported Python diagnosis boundary')
    }
  })()

  return Object.freeze({
    ...response,
    guidanceLabel: MessageGuidanceLabel.REFUSAL,
  })
}
