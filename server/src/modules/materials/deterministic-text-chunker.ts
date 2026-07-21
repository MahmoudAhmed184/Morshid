export const MATERIAL_CHUNK_TARGET_CHARACTERS = 1_200
export const MATERIAL_CHUNK_OVERLAP_CHARACTERS = 200

export interface MaterialTextChunk {
  chunkIndex: number
  content: string
}

export function chunkNormalizedText(text: string): MaterialTextChunk[] {
  if (text.trim() === '') {
    return []
  }

  const chunks: MaterialTextChunk[] = []
  let start = 0

  while (start < text.length) {
    const end = chooseChunkEnd(text, start)
    const content = text.slice(start, end).trim()

    if (content !== '') {
      chunks.push({
        chunkIndex: chunks.length,
        content,
      })
    }

    if (end >= text.length) {
      break
    }

    const nextStart = Math.max(0, end - MATERIAL_CHUNK_OVERLAP_CHARACTERS)
    start = nextStart <= start ? end : nextStart
  }

  return chunks
}

function chooseChunkEnd(text: string, start: number): number {
  const targetEnd = Math.min(
    text.length,
    start + MATERIAL_CHUNK_TARGET_CHARACTERS,
  )

  if (targetEnd >= text.length) {
    return text.length
  }

  const earliestPreferredBoundary = Math.min(
    targetEnd,
    start +
      MATERIAL_CHUNK_TARGET_CHARACTERS -
      MATERIAL_CHUNK_OVERLAP_CHARACTERS,
  )
  const preferredWindow = text.slice(earliestPreferredBoundary, targetEnd)
  const paragraphOffset = preferredWindow.lastIndexOf('\n\n')

  if (paragraphOffset >= 0) {
    const paragraphEnd = earliestPreferredBoundary + paragraphOffset

    if (paragraphEnd > start) {
      return paragraphEnd
    }
  }

  return targetEnd
}
