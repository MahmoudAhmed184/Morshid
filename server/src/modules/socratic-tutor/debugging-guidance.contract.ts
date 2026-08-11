export const DEBUGGING_GUIDANCE_SECTION_HEADINGS = [
  'Likely defect',
  'Relevant location',
  'Concept',
  'Next inspection step',
] as const

export const DEBUGGING_GUIDANCE_OUTPUT_RESULTS = [
  'ALLOWED_DEBUGGING_GUIDANCE',
  'INVALID_RESPONSE_SHAPE',
  'FULL_REWRITE_SUSPECTED',
  'PROMPT_DISCLOSURE',
  'EXECUTION_CLAIM',
  'INVALID_CITATION',
  'UNSUPPORTED_SCOPE',
] as const

export type DebuggingGuidanceOutputResult =
  (typeof DEBUGGING_GUIDANCE_OUTPUT_RESULTS)[number]

export interface DebuggingGuidanceContext {
  readonly likelyIssue: string
  readonly relevantLocation: string
  readonly concept: string
  readonly nextInspectionStep: string
  readonly evidenceQuery: string
  readonly rewriteRequested: boolean
}

export const DEBUGGING_GUIDANCE_FULL_REWRITE_REFUSAL =
  'I cannot provide a complete corrected program, but I can help you inspect the likely defect.'

interface DebuggingGuidanceOutputInput {
  readonly content: string
  readonly authorizedCitationCount: number
}

export function validateDebuggingGuidanceOutput(
  input: DebuggingGuidanceOutputInput,
): DebuggingGuidanceOutputResult {
  if (containsPromptDisclosure(input.content)) {
    return 'PROMPT_DISCLOSURE'
  }
  if (containsExecutionClaim(input.content)) {
    return 'EXECUTION_CLAIM'
  }

  const codeBlocks = extractFencedCodeBlocks(input.content)
  if (codeBlocks.length > 1) {
    return 'UNSUPPORTED_SCOPE'
  }
  if (codeBlocks.length > 0 || containsCompleteProgram(input.content)) {
    return 'FULL_REWRITE_SUSPECTED'
  }

  const sections = parseSections(input.content)
  const nextStep = sections?.at(-1)
  if (
    sections === null ||
    nextStep === undefined ||
    !hasExactlyOneInspectionStep(nextStep)
  ) {
    return 'INVALID_RESPONSE_SHAPE'
  }

  const concept = sections.at(2)
  if (
    concept === undefined ||
    extractCitationIndexes(concept, input.authorizedCitationCount).length === 0
  ) {
    return 'INVALID_CITATION'
  }

  return 'ALLOWED_DEBUGGING_GUIDANCE'
}

function parseSections(content: string): readonly string[] | null {
  const lines = content
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
  const refusalLine = lines[0]?.trim()
  const contentLines =
    refusalLine === DEBUGGING_GUIDANCE_FULL_REWRITE_REFUSAL
      ? lines.slice(1)
      : lines
  const headingIndexes = DEBUGGING_GUIDANCE_SECTION_HEADINGS.map((heading) =>
    contentLines.reduce<number[]>((indexes, line, index) => {
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
    contentLines.slice(0, indexes[0]).some((line) => line.trim() !== '') ||
    indexes.some(
      (index, position) => position > 0 && index <= indexes[position - 1],
    )
  ) {
    return null
  }

  const sections = indexes.map((index, position) =>
    contentLines
      .slice(index + 1, indexes[position + 1] ?? contentLines.length)
      .join('\n')
      .trim(),
  )
  return sections.every((section) => section !== '') ? sections : null
}

function normalizeHeadingLine(raw: string): string {
  return raw
    .trim()
    .replace(/^#{1,6}\s+/u, '')
    .replace(/^(?:\*{1,2}|_{1,2})(.*?)(?:\*{1,2}|_{1,2})$/u, '$1')
    .replace(/:$/u, '')
    .trim()
}

function hasExactlyOneInspectionStep(section: string): boolean {
  const lines = section
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length !== 1 || /^(?:[-*]|\d+[.)])\s+/u.test(lines[0])) {
    return false
  }
  return (lines[0].match(/[.!?](?:\s|$)/gu) ?? []).length <= 1
}

function extractFencedCodeBlocks(content: string): readonly string[] {
  return [...content.matchAll(/```[^\r\n`]*\r?\n([\s\S]*?)```/gu)].map(
    (match) => match[1],
  )
}

function containsCompleteProgram(content: string): boolean {
  return /(?:^|\n)\s*(?:async\s+)?(?:def|class|function)\s+[A-Za-z_][A-Za-z0-9_]*/mu.test(
    content,
  )
}

function containsPromptDisclosure(content: string): boolean {
  return /<<<(?:BEGIN|END)_MORSHID_|\b(?:hidden\s+)?system\s+(?:instructions?|prompt)\s+(?:are|says?|said|state)|\bauthoritative\s+system\s+message\b/iu.test(
    content,
  )
}

function containsExecutionClaim(content: string): boolean {
  return /\b(?:I|we)\s+(?:have\s+)?(?:executed|ran|run|tested)\s+(?:(?:the|this|your)\s+)?(?:code|program|script)\b|\b(?:executing|running)\s+(?:(?:the|this|your)\s+)?(?:code|program|script)\s+(?:produced|returned|showed|shows)\b/iu.test(
    content,
  )
}

function extractCitationIndexes(
  content: string,
  authorizedCitationCount: number,
): readonly number[] {
  if (
    !Number.isSafeInteger(authorizedCitationCount) ||
    authorizedCitationCount < 1
  ) {
    return []
  }
  const markers = [...content.matchAll(/\[((?:\d+\s*,\s*)*\d+)\]/gu)]
  const malformed = [...content.matchAll(/\[[^\]\r\n]*\]/gu)].some(
    ([marker]) =>
      /\d/u.test(marker) && !/^\[(?:\d+\s*,\s*)*\d+\]$/u.test(marker),
  )
  if (malformed) {
    return []
  }
  const indexes = markers.flatMap((match) =>
    match[1].split(',').map((value) => Number(value.trim())),
  )
  if (
    indexes.some(
      (index) =>
        !Number.isSafeInteger(index) ||
        index < 1 ||
        index > authorizedCitationCount,
    )
  ) {
    return []
  }
  return [...new Set(indexes)]
}
