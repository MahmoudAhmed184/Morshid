import { MessageGuidanceLabel } from '../../../../generated/prisma/client'

import type { RejectedDebuggingGuidanceBoundaryAssessment } from './debugging-guidance.boundary'
import { DEBUGGING_GUIDANCE_MAX_LINES } from './debugging-guidance.contract'

export const DEBUGGING_GUIDANCE_BOUNDARY_ERROR_CODES = {
  UNSUPPORTED_LANGUAGE: 'DEBUGGING_GUIDANCE_UNSUPPORTED_LANGUAGE',
  INSUFFICIENT_INFORMATION: 'DEBUGGING_GUIDANCE_MORE_INFORMATION_REQUIRED',
  TOO_MANY_LINES: 'DEBUGGING_GUIDANCE_LINE_LIMIT_EXCEEDED',
  UNSUPPORTED_SCOPE: 'DEBUGGING_GUIDANCE_UNSUPPORTED_SCOPE',
} as const

export interface DebuggingGuidanceBoundaryResponse {
  readonly content: string
  readonly errorCode: (typeof DEBUGGING_GUIDANCE_BOUNDARY_ERROR_CODES)[keyof typeof DEBUGGING_GUIDANCE_BOUNDARY_ERROR_CODES]
  readonly guidanceLabel: typeof MessageGuidanceLabel.REFUSAL
}

export function buildDebuggingGuidanceBoundaryResponse(
  assessment: RejectedDebuggingGuidanceBoundaryAssessment,
): DebuggingGuidanceBoundaryResponse {
  const response = (() => {
    switch (assessment.state) {
      case 'UNSUPPORTED_LANGUAGE':
        return {
          content:
            'I can inspect one supported code snippet of at most 100 lines, and I will help you reason about it without running it.',
          errorCode:
            DEBUGGING_GUIDANCE_BOUNDARY_ERROR_CODES.UNSUPPORTED_LANGUAGE,
        }
      case 'INSUFFICIENT_INFORMATION':
        return {
          content:
            'I need a short code snippet or the exact error before I can diagnose the problem. Please share one snippet of at most 100 lines.',
          errorCode:
            DEBUGGING_GUIDANCE_BOUNDARY_ERROR_CODES.INSUFFICIENT_INFORMATION,
        }
      case 'TOO_MANY_LINES':
        return {
          content: `This code snippet has ${String(assessment.lineCount)} normalized lines. I can diagnose at most ${String(DEBUGGING_GUIDANCE_MAX_LINES)} lines, so please shorten it to the smallest relevant snippet and send it again.`,
          errorCode: DEBUGGING_GUIDANCE_BOUNDARY_ERROR_CODES.TOO_MANY_LINES,
        }
      case 'UNSUPPORTED_SCOPE':
        return {
          content:
            'I can diagnose one code snippet at a time, not multiple files or code blocks. Please send the smallest single snippet that contains the problem.',
          errorCode: DEBUGGING_GUIDANCE_BOUNDARY_ERROR_CODES.UNSUPPORTED_SCOPE,
        }
      default:
        throw new TypeError('Unsupported debugging guidance boundary')
    }
  })()

  return Object.freeze({
    ...response,
    guidanceLabel: MessageGuidanceLabel.REFUSAL,
  })
}
