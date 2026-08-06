import { countNormalizedCodeLines } from './python-code-diagnosis.boundary'
import type {
  PythonCodeDiagnosisOutputPolicyResult,
  PythonCodeDiagnosis,
} from './python-code-diagnosis.contract'

export const PYTHON_CODE_DIAGNOSIS_OUTPUT_BLOCKED =
  'PYTHON_DIAGNOSIS_OUTPUT_POLICY_BLOCKED'
export const FULL_REWRITE_REFUSAL =
  'I cannot provide a complete corrected program, but I can help you inspect the likely defect.'

const MAX_OUTPUT_CODE_BLOCK_LINES = 12
const REQUIRED_SECTION_HEADINGS = [
  'Likely defect',
  'Relevant location',
  'Python concept',
  'Next inspection step',
] as const

interface PythonCodeDiagnosisOutputGuardInput {
  readonly content: string
  readonly authorizedCitationCount: number
}

interface FencedOutputBlock {
  readonly code: string
  readonly start: number
}

export function validatePythonCodeDiagnosisOutput(
  input: PythonCodeDiagnosisOutputGuardInput,
): PythonCodeDiagnosisOutputPolicyResult {
  if (containsPromptDisclosure(input.content)) {
    return 'PROMPT_DISCLOSURE'
  }
  if (containsExecutionClaim(input.content)) {
    return 'EXECUTION_CLAIM'
  }

  const codeBlocks = extractFencedOutputBlocks(input.content)
  if (codeBlocks.length > 1) {
    return 'UNSUPPORTED_SCOPE'
  }
  if (
    codeBlocks.some(
      ({ code }) =>
        countNormalizedCodeLines(code) > MAX_OUTPUT_CODE_BLOCK_LINES,
    )
  ) {
    return 'CODE_BLOCK_TOO_LARGE'
  }
  if (containsFullCorrectedProgram(input.content, codeBlocks)) {
    return 'FULL_REWRITE_SUSPECTED'
  }

  const sections = parseRequiredSections(input.content)
  const nextStepSection = sections?.at(-1)
  if (
    sections === null ||
    nextStepSection === undefined ||
    containsMultipleInspectionSteps(nextStepSection)
  ) {
    return 'INVALID_RESPONSE_SHAPE'
  }
  if (
    !hasOnlyAuthorizedCitations(input.content, input.authorizedCitationCount)
  ) {
    return 'INVALID_CITATION'
  }

  return 'ALLOWED_DIAGNOSIS'
}

export function pythonCodeDiagnosisOutputErrorCode(
  result: Exclude<PythonCodeDiagnosisOutputPolicyResult, 'ALLOWED_DIAGNOSIS'>,
): string {
  return `${PYTHON_CODE_DIAGNOSIS_OUTPUT_BLOCKED}_${result}`
}

export function buildSafePythonCodeDiagnosisFallback(
  diagnosis: Omit<PythonCodeDiagnosis, 'citations'>,
): string {
  return [
    FULL_REWRITE_REFUSAL,
    '',
    'Likely defect',
    diagnosis.likelyDefect,
    '',
    'Relevant location',
    diagnosis.location,
    '',
    'Python concept',
    diagnosis.conceptExplanation,
    '',
    'Next inspection step',
    diagnosis.nextInspectionStep,
  ].join('\n')
}

export function addFullRewriteRefusal(content: string): string {
  return `${FULL_REWRITE_REFUSAL}\n\n${content}`
}

function containsPromptDisclosure(content: string): boolean {
  return /<<<(?:BEGIN|END)_MORSHID_UNTRUSTED_INPUT|\b(?:hidden\s+)?system\s+(?:instructions?|prompt)\s+(?:are|says?|said|state)|\bhidden\s+(?:instructions?|prompt)\s+(?:are|says?|said|state)|\bauthoritative\s+system\s+message\b/iu.test(
    content,
  )
}

function containsExecutionClaim(content: string): boolean {
  return /\b(?:I|we)\s+(?:have\s+)?(?:executed|ran|run|tested)\s+(?:(?:the|this|your)\s+)?(?:code|program|script)\b|\b(?:executing|running)\s+(?:(?:the|this|your)\s+)?(?:code|program|script)\s+(?:produced|returned|showed|shows)\b/iu.test(
    content,
  )
}

function extractFencedOutputBlocks(
  content: string,
): readonly FencedOutputBlock[] {
  return [...content.matchAll(/```[^\r\n`]*\r?\n([\s\S]*?)```/gu)].map(
    (match) => ({
      code: match[1],
      start: match.index,
    }),
  )
}

function containsFullCorrectedProgram(
  content: string,
  codeBlocks: readonly FencedOutputBlock[],
): boolean {
  if (
    /\b(?:here(?:'s| is)|below is|the following is)\s+(?:(?:the|a)\s+)?(?:full|complete|corrected|fixed|working|final)\s+(?:code|program|script|solution)\b|\bI(?:'ve| have)\s+(?:completed|corrected|fixed|rewritten)\s+(?:(?:the|your)\s+)?(?:assignment|code|program|script|solution)\b/iu.test(
      content,
    )
  ) {
    return true
  }

  const visibleCode = [
    ...codeBlocks.map(({ code }) => code),
    content.replace(/```[^\r\n`]*\r?\n[\s\S]*?```/gu, ''),
  ]
  return visibleCode.some((code) =>
    /(?:^|\n)\s*(?:async\s+)?(?:def|class)\s+[A-Za-z_][A-Za-z0-9_]*(?:\s*\([^\r\n]*\))?\s*:\s*(?:\r?\n)[ \t]+\S/mu.test(
      code,
    ),
  )
}

// Strips common LLM markdown decorators so that headings such as
// "**Likely defect**", "### Relevant location", or "Likely defect:" are
// matched exactly as their bare text. This does NOT change any security
// invariant: all other checks (citations, full-rewrite, execution claims,
// prompt disclosure, section count, section order, non-empty bodies) remain
// fully intact after normalization.
function normalizeHeadingLine(raw: string): string {
  return (
    raw
      .trim()
      // Remove leading ATX-style markdown heading markers (###, ##, #)
      .replace(/^#{1,6}\s+/u, '')
      // Remove surrounding bold/italic markdown markers (**text**, *text*,
      // __text__, _text_) in the most common single-level form
      .replace(/^(?:\*{1,2}|_{1,2})(.*?)(?:\*{1,2}|_{1,2})$/u, '$1')
      // Remove a trailing colon that models frequently append
      .replace(/:$/u, '')
      .trim()
  )
}

function parseRequiredSections(content: string): readonly string[] | null {
  const lines = content
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
  const headingIndexes = REQUIRED_SECTION_HEADINGS.map((heading) =>
    lines.reduce<number[]>((indexes, line, index) => {
      if (normalizeHeadingLine(line) === heading) {
        indexes.push(index)
      }
      return indexes
    }, []),
  )
  if (headingIndexes.some((indexes) => indexes.length !== 1)) {
    return null
  }

  const indexes = headingIndexes.map(([index]) => index)
  if (
    indexes.some(
      (index, position) => position > 0 && index <= indexes[position - 1],
    )
  ) {
    return null
  }

  const sections = indexes.map((index, position) =>
    lines
      .slice(index + 1, indexes[position + 1] ?? lines.length)
      .join('\n')
      .trim(),
  )
  return sections.every((section) => section !== '') ? sections : null
}

function containsMultipleInspectionSteps(nextStepSection: string): boolean {
  const listItems = nextStepSection.match(/^\s*(?:[-*]|\d+[.)])\s+/gmu) ?? []
  return listItems.length > 1
}

function hasOnlyAuthorizedCitations(
  content: string,
  authorizedCitationCount: number,
): boolean {
  if (
    !Number.isSafeInteger(authorizedCitationCount) ||
    authorizedCitationCount < 1
  ) {
    return false
  }

  const citations = [...content.matchAll(/\[((?:\d+\s*,\s*)*\d+)\]/gu)].flatMap(
    (match) => match[1].split(',').map((value) => Number(value.trim())),
  )

  return (
    citations.length > 0 &&
    citations.every(
      (citation) =>
        Number.isSafeInteger(citation) &&
        citation >= 1 &&
        citation <= authorizedCitationCount,
    )
  )
}
