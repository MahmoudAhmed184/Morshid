import { PYTHON_CODE_DIAGNOSIS_MAX_LINES } from './python-code-diagnosis.contract'

export const PYTHON_CODE_DIAGNOSIS_BOUNDARY_STATES = [
  'SUPPORTED',
  'CLEARLY_NON_PYTHON',
  'INSUFFICIENT_INFORMATION',
  'TOO_MANY_LINES',
  'UNSUPPORTED_SCOPE',
] as const

export type PythonCodeDiagnosisBoundaryState =
  (typeof PYTHON_CODE_DIAGNOSIS_BOUNDARY_STATES)[number]

export interface PythonCodeDiagnosisBoundaryAssessment {
  readonly state: PythonCodeDiagnosisBoundaryState
  readonly detectedLanguage: 'PYTHON' | 'CLEARLY_NON_PYTHON' | 'UNKNOWN'
  readonly codeSource: 'FENCED' | 'PLAIN'
  readonly lineCount: number
  readonly reason:
    | 'PYTHON_SIGNALS'
    | 'NON_PYTHON_SIGNALS'
    | 'LANGUAGE_UNCLEAR'
    | 'LINE_LIMIT_EXCEEDED'
    | 'MULTIPLE_CODE_BLOCKS'
}

export type RejectedPythonCodeDiagnosisBoundaryAssessment =
  PythonCodeDiagnosisBoundaryAssessment & {
    readonly state: Exclude<PythonCodeDiagnosisBoundaryState, 'SUPPORTED'>
  }

export function isRejectedPythonCodeDiagnosisBoundaryAssessment(
  assessment: PythonCodeDiagnosisBoundaryAssessment,
): assessment is RejectedPythonCodeDiagnosisBoundaryAssessment {
  return assessment.state !== 'SUPPORTED'
}

interface FencedCodeBlock {
  readonly language: string
  readonly code: string
}

const PYTHON_FENCE_LANGUAGES = new Set(['python', 'python3', 'py', '.py'])
const CLEARLY_NON_PYTHON_FENCE_LANGUAGES = new Set([
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

const PYTHON_SIGNAL_PATTERNS = [
  /^\s*(?:async\s+)?def\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*:/mu,
  /^\s*class\s+[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?\s*:/mu,
  /^\s*(?:for\s+.+\s+in\s+.+|while\s+.+|if\s+.+|elif\s+.+|else|try|except(?:\s+.+)?|with\s+.+)\s*:/mu,
  /^\s*(?:from\s+[A-Za-z_][A-Za-z0-9_.]*\s+import\s+|import\s+[A-Za-z_][A-Za-z0-9_.]*)/mu,
  /\b(?:enumerate|len|open|print|range|zip)\s*\(/u,
] as const

const CLEARLY_NON_PYTHON_SIGNAL_GROUPS = [
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

export function assessPythonCodeDiagnosisBoundary(
  studentInput: string,
): PythonCodeDiagnosisBoundaryAssessment {
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
): PythonCodeDiagnosisBoundaryAssessment {
  const lineCount = countNormalizedCodeLines(code)

  if (
    fenceLanguage !== undefined &&
    CLEARLY_NON_PYTHON_FENCE_LANGUAGES.has(fenceLanguage)
  ) {
    return {
      state: 'CLEARLY_NON_PYTHON',
      detectedLanguage: 'CLEARLY_NON_PYTHON',
      codeSource,
      lineCount,
      reason: 'NON_PYTHON_SIGNALS',
    }
  }

  const pythonDetected =
    (fenceLanguage !== undefined &&
      PYTHON_FENCE_LANGUAGES.has(fenceLanguage)) ||
    PYTHON_SIGNAL_PATTERNS.some((pattern) => pattern.test(code))

  if (!pythonDetected && hasClearlyNonPythonSignals(code)) {
    return {
      state: 'CLEARLY_NON_PYTHON',
      detectedLanguage: 'CLEARLY_NON_PYTHON',
      codeSource,
      lineCount,
      reason: 'NON_PYTHON_SIGNALS',
    }
  }

  if (!pythonDetected) {
    return {
      state: 'INSUFFICIENT_INFORMATION',
      detectedLanguage: 'UNKNOWN',
      codeSource,
      lineCount,
      reason: 'LANGUAGE_UNCLEAR',
    }
  }

  if (lineCount > PYTHON_CODE_DIAGNOSIS_MAX_LINES) {
    return {
      state: 'TOO_MANY_LINES',
      detectedLanguage: 'PYTHON',
      codeSource,
      lineCount,
      reason: 'LINE_LIMIT_EXCEEDED',
    }
  }

  return {
    state: 'SUPPORTED',
    detectedLanguage: 'PYTHON',
    codeSource,
    lineCount,
    reason: 'PYTHON_SIGNALS',
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

function hasClearlyNonPythonSignals(code: string): boolean {
  return CLEARLY_NON_PYTHON_SIGNAL_GROUPS.some(
    (patterns) => patterns.filter((pattern) => pattern.test(code)).length >= 2,
  )
}
