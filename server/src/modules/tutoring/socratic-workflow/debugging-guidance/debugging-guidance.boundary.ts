import { DEBUGGING_GUIDANCE_MAX_LINES } from './debugging-guidance.contract'

export const DEBUGGING_GUIDANCE_BOUNDARY_STATES = [
  'SUPPORTED',
  'UNSUPPORTED_LANGUAGE',
  'INSUFFICIENT_INFORMATION',
  'TOO_MANY_LINES',
  'UNSUPPORTED_SCOPE',
] as const

export type DebuggingGuidanceBoundaryState =
  (typeof DEBUGGING_GUIDANCE_BOUNDARY_STATES)[number]

export interface DebuggingGuidanceBoundaryAssessment {
  readonly state: DebuggingGuidanceBoundaryState
  readonly detectedLanguage: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN'
  readonly codeSource: 'FENCED' | 'PLAIN'
  readonly lineCount: number
  readonly reason:
    | 'SUPPORTED_LANGUAGE_SIGNALS'
    | 'UNSUPPORTED_LANGUAGE_SIGNALS'
    | 'LANGUAGE_UNCLEAR'
    | 'LINE_LIMIT_EXCEEDED'
    | 'MULTIPLE_CODE_BLOCKS'
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

const SUPPORTED_CODE_FENCE_LANGUAGES = new Set([
  'python',
  'python3',
  'py',
  '.py',
])
const KNOWN_UNSUPPORTED_CODE_FENCE_LANGUAGES = new Set([
  'bash',
  'c',
  'c++',
  'cpp',
  'csharp',
  'cs',
  'go',
  'java',
  'javascript',
  'js',
  'html',
  'php',
  'ruby',
  'rust',
  'shell',
  'sh',
  'sql',
  'ts',
  'typescript',
])

const SUPPORTED_LANGUAGE_SIGNAL_PATTERNS = [
  /^\s*(?:async\s+)?def\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*:/mu,
  /^\s*class\s+[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?\s*:/mu,
  /^\s*(?:for\s+.+\s+in\s+.+|while\s+.+|if\s+.+|elif\s+.+|else|try|except(?:\s+.+)?|with\s+.+)\s*:/mu,
  /^\s*(?:from\s+[A-Za-z_][A-Za-z0-9_.]*\s+import\s+|import\s+[A-Za-z_][A-Za-z0-9_.]*)/mu,
  /\b(?:enumerate|len|open|print|range|zip)\s*\(/u,
] as const

const UNSUPPORTED_LANGUAGE_SIGNAL_GROUPS = [
  [
    /\b(?:const|let|var)\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=/u,
    /\bfunction\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\(/u,
    /=>/u,
    /\bconsole\.log\s*\(/u,
    /\.length\b/u,
  ],
  [
    /\bpublic\s+(?:final\s+)?class\s+[A-Za-z_][A-Za-z0-9_]*/u,
    /\bpublic\s+static\s+void\s+main\s*\(/u,
    /\bSystem\.out\.print(?:ln)?\s*\(/u,
    /\b(?:int|String|boolean|double)\s+[A-Za-z_][A-Za-z0-9_]*\s*[=;]/u,
  ],
  [
    /^\s*#include\s*[<"]/mu,
    /\bint\s+main\s*\(/u,
    /\bprintf\s*\(/u,
    /\b(?:char|double|float|int)\s+[A-Za-z_][A-Za-z0-9_]*\s*[=;]/u,
  ],
  [
    /\b(?:const|let|var)\s+[A-Za-z_$][A-Za-z0-9_$]*\s*:\s*(?:boolean|number|string)\b/u,
    /\b(?:interface|type)\s+[A-Za-z_$][A-Za-z0-9_$]*/u,
    /\bconsole\.log\s*\(/u,
  ],
  [
    /\busing\s+System\s*;/u,
    /\bpublic\s+(?:sealed\s+)?class\s+[A-Za-z_][A-Za-z0-9_]*/u,
    /\bstatic\s+void\s+Main\s*\(/u,
    /\bConsole\.WriteLine\s*\(/u,
  ],
  [
    /\bSELECT\b[\s\S]*\bFROM\b/iu,
    /\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE)\b/iu,
    /;\s*$/mu,
  ],
  [
    /<!DOCTYPE\s+html\s*>/iu,
    /<html(?:\s[^>]*)?>/iu,
    /<(?:body|div|head|script)(?:\s[^>]*)?>/iu,
    /<\/(?:body|div|head|html|script)>/iu,
  ],
  [
    /^\s*#!\s*\/[^\r\n]*\b(?:ba|z|k)?sh\b/mu,
    /^\s*(?:echo|printf|source|export)\s+/mu,
    /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/u,
    /\b(?:fi|done|esac)\b/u,
  ],
] as const

export function assessDebuggingGuidanceBoundary(
  studentInput: string,
): DebuggingGuidanceBoundaryAssessment {
  const blocks = extractFencedCodeBlocks(studentInput)
  if (blocks.length > 1) {
    return {
      state: 'UNSUPPORTED_SCOPE',
      detectedLanguage: 'UNKNOWN',
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
  return assessCode(block.code, 'FENCED', block.language.toLowerCase())
}

function assessCode(
  code: string,
  codeSource: 'FENCED' | 'PLAIN',
  fenceLanguage?: string,
): DebuggingGuidanceBoundaryAssessment {
  const lineCount = countNormalizedCodeLines(code)

  if (
    fenceLanguage !== undefined &&
    KNOWN_UNSUPPORTED_CODE_FENCE_LANGUAGES.has(fenceLanguage)
  ) {
    return {
      state: 'UNSUPPORTED_LANGUAGE',
      detectedLanguage: 'UNSUPPORTED',
      codeSource,
      lineCount,
      reason: 'UNSUPPORTED_LANGUAGE_SIGNALS',
    }
  }

  const supportedLanguageDetected =
    (fenceLanguage !== undefined &&
      SUPPORTED_CODE_FENCE_LANGUAGES.has(fenceLanguage)) ||
    SUPPORTED_LANGUAGE_SIGNAL_PATTERNS.some((pattern) => pattern.test(code))

  if (!supportedLanguageDetected && hasUnsupportedLanguageSignals(code)) {
    return {
      state: 'UNSUPPORTED_LANGUAGE',
      detectedLanguage: 'UNSUPPORTED',
      codeSource,
      lineCount,
      reason: 'UNSUPPORTED_LANGUAGE_SIGNALS',
    }
  }

  if (!supportedLanguageDetected) {
    return {
      state: 'INSUFFICIENT_INFORMATION',
      detectedLanguage: 'UNKNOWN',
      codeSource,
      lineCount,
      reason: 'LANGUAGE_UNCLEAR',
    }
  }

  if (lineCount > DEBUGGING_GUIDANCE_MAX_LINES) {
    return {
      state: 'TOO_MANY_LINES',
      detectedLanguage: 'SUPPORTED',
      codeSource,
      lineCount,
      reason: 'LINE_LIMIT_EXCEEDED',
    }
  }

  return {
    state: 'SUPPORTED',
    detectedLanguage: 'SUPPORTED',
    codeSource,
    lineCount,
    reason: 'SUPPORTED_LANGUAGE_SIGNALS',
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

function hasUnsupportedLanguageSignals(code: string): boolean {
  return UNSUPPORTED_LANGUAGE_SIGNAL_GROUPS.some(
    (patterns) => patterns.filter((pattern) => pattern.test(code)).length >= 2,
  )
}
