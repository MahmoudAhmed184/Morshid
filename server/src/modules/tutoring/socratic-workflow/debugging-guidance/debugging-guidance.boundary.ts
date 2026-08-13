import { DEBUGGING_GUIDANCE_MAX_LINES } from './debugging-guidance.contract'

export const DEBUGGING_GUIDANCE_BOUNDARY_STATES = [
  'SUPPORTED',
  'TOO_MANY_LINES',
  'UNSUPPORTED_SCOPE',
] as const

export type DebuggingGuidanceBoundaryState =
  (typeof DEBUGGING_GUIDANCE_BOUNDARY_STATES)[number]

export interface DebuggingGuidanceBoundaryAssessment {
  readonly state: DebuggingGuidanceBoundaryState
  readonly codeSource: 'FENCED' | 'PLAIN'
  readonly lineCount: number
  readonly reason:
    'CODE_ACCEPTED' | 'LINE_LIMIT_EXCEEDED' | 'MULTIPLE_CODE_BLOCKS'
}

export type RejectedDebuggingGuidanceBoundaryAssessment =
  DebuggingGuidanceBoundaryAssessment & {
    readonly state: Exclude<DebuggingGuidanceBoundaryState, 'SUPPORTED'>
  }

export function isRejectedDebuggingGuidanceBoundaryAssessment(
  assessment: DebuggingGuidanceBoundaryAssessment,
): assessment is RejectedDebuggingGuidanceBoundaryAssessment {
  return assessment.state !== 'SUPPORTED'
}

interface FencedCodeBlock {
  readonly language: string
  readonly code: string
}

export function assessDebuggingGuidanceBoundary(
  studentInput: string,
): DebuggingGuidanceBoundaryAssessment {
  const blocks = extractFencedCodeBlocks(studentInput)
  if (blocks.length > 1) {
    return {
      state: 'UNSUPPORTED_SCOPE',
      codeSource: 'FENCED',
      lineCount: blocks.reduce(
        (total, block) => total + countNormalizedCodeLines(block.code),
        0,
      ),
      reason: 'MULTIPLE_CODE_BLOCKS',
    }
  }

  if (blocks.length === 0) {
    return assessCode(studentInput, 'PLAIN')
  }

  const block = blocks[0]
  return assessCode(block.code, 'FENCED')
}

function assessCode(
  code: string,
  codeSource: 'FENCED' | 'PLAIN',
): DebuggingGuidanceBoundaryAssessment {
  const lineCount = countNormalizedCodeLines(code)

  if (lineCount > DEBUGGING_GUIDANCE_MAX_LINES) {
    return {
      state: 'TOO_MANY_LINES',
      codeSource,
      lineCount,
      reason: 'LINE_LIMIT_EXCEEDED',
    }
  }

  return {
    state: 'SUPPORTED',
    codeSource,
    lineCount,
    reason: 'CODE_ACCEPTED',
  }
}

export function countNormalizedCodeLines(code: string): number {
  const lines = code.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n')

  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift()
  }
  while (lines.length > 0 && lines.at(-1)?.trim() === '') {
    lines.pop()
  }

  return lines.length
}

function extractFencedCodeBlocks(input: string): readonly FencedCodeBlock[] {
  const blocks: FencedCodeBlock[] = []
  const pattern = /```([^\r\n`]*)\r?\n([\s\S]*?)```/gu

  for (const match of input.matchAll(pattern)) {
    blocks.push({
      language: match[1].trim().toLowerCase(),
      code: match[2],
    })
  }

  return blocks
}
