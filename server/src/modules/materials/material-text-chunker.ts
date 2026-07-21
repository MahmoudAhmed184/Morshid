import { Injectable } from '@nestjs/common'

export const MATERIAL_CHUNK_TARGET_CHARACTERS = 1_200
export const MATERIAL_CHUNK_OVERLAP_CHARACTERS = 200

export interface MaterialTextChunk {
  chunkIndex: number
  content: string
}

@Injectable()
export class MaterialTextChunker {
  normalize(text: string): string {
    return text
      .normalize('NFKC')
      .replaceAll('\u0000', '')
      .replaceAll('\r\n', '\n')
      .replaceAll('\r', '\n')
      .split('\n')
      .map((line) => line.replace(/[\t\f\v ]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  chunk(text: string): MaterialTextChunk[] {
    const normalized = this.normalize(text)
    if (normalized.length === 0) {
      return []
    }

    const chunks: MaterialTextChunk[] = []
    let start = 0

    while (start < normalized.length) {
      const maximumEnd = Math.min(
        start + MATERIAL_CHUNK_TARGET_CHARACTERS,
        normalized.length,
      )
      const end =
        maximumEnd === normalized.length
          ? maximumEnd
          : findPreferredBoundary(normalized, start, maximumEnd)
      const content = normalized.slice(start, end)

      if (content.length > 0) {
        chunks.push({ chunkIndex: chunks.length, content })
      }

      if (end >= normalized.length) {
        break
      }

      start = end - MATERIAL_CHUNK_OVERLAP_CHARACTERS
    }

    return chunks
  }
}

function findPreferredBoundary(
  text: string,
  start: number,
  maximumEnd: number,
): number {
  const minimumBoundary =
    start + Math.floor(MATERIAL_CHUNK_TARGET_CHARACTERS / 2)
  const window = text.slice(minimumBoundary, maximumEnd)

  for (const separator of ['\n\n', '\n', ' ']) {
    const separatorIndex = window.lastIndexOf(separator)
    if (separatorIndex >= 0) {
      return minimumBoundary + separatorIndex
    }
  }

  return maximumEnd
}
