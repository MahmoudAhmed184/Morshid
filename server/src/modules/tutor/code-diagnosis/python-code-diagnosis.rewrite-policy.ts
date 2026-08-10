const FULL_REWRITE_REQUEST_PATTERNS = [
  /\b(?:give|provide|return|send|show|write)\s+(?:me\s+)?(?:the\s+)?(?:full|complete|whole|entire|final)\s+(?:(?:corrected|fixed|working)\s+)?(?:assignment|code|program|script|solution)\b/giu,
  /\b(?:complete|correct|finish|fix|rewrite)\s+(?:(?:my|the|this)\s+)?(?:full|complete|whole|entire)\s+(?:assignment|code|program|script|solution)\b/giu,
] as const

const NEGATED_REQUEST_PREFIX =
  /(?:\bdo\s+not|\bdon't|\bnever|\bwithout|\brefuse\s+to)\s+[^.!?\r\n]{0,32}$/iu

export function requestsFullCorrectedProgram(studentMessage: string): boolean {
  const requestText = maskPythonCommentsAndStrings(
    maskFencedCodeBlocks(studentMessage),
  )

  for (const pattern of FULL_REWRITE_REQUEST_PATTERNS) {
    for (const match of requestText.matchAll(pattern)) {
      const prefix = requestText.slice(
        Math.max(0, match.index - 48),
        match.index,
      )
      if (!NEGATED_REQUEST_PREFIX.test(prefix)) {
        return true
      }
    }
  }

  return false
}

function maskFencedCodeBlocks(input: string): string {
  return input.replace(/```[^\r\n`]*\r?\n[\s\S]*?```/gu, maskNonNewlines)
}

function maskPythonCommentsAndStrings(input: string): string {
  return input
    .replace(/(?:'''[\s\S]*?'''|"""[\s\S]*?""")/gu, maskNonNewlines)
    .replace(
      /(?:'(?:\\.|[^'\\\r\n])*'|"(?:\\.|[^"\\\r\n])*")/gu,
      maskNonNewlines,
    )
    .replace(/#[^\r\n]*/gu, maskNonNewlines)
}

function maskNonNewlines(value: string): string {
  return value.replace(/[^\r\n]/gu, ' ')
}
