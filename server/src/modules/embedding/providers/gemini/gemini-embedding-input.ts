import { MAX_EMBEDDING_TITLE_CODE_POINTS } from '../../embedding-provider'
import {
  GEMINI_EMBEDDING_ABSENT_TITLE,
  GEMINI_EMBEDDING_QUERY_TASK,
} from './gemini-embedding.constants'

/**
 * Builds the exact strings this provider embeds.
 *
 * `taskType` is unsupported by `gemini-embedding-2`; Google replaced it with
 * prompt prefixes, so the task and the title are part of the embedded text
 * rather than request fields. That makes these two formats protocol, not
 * cosmetics: the document format belongs to the persisted document profile and
 * the query format to the query protocol, and they are deliberately asymmetric.
 */

/** Query side. Part of the *query protocol* — changing it costs no re-embed. */
export function buildGeminiQueryInput(query: string): string {
  return `task: ${GEMINI_EMBEDDING_QUERY_TASK} | query: ${query}`
}

/**
 * Document side. Part of the *document profile* — changing it requires a new
 * profile and a full re-embed.
 */
export function buildGeminiDocumentInput(
  text: string,
  title: string | undefined,
): string {
  return `title: ${normalizeGeminiTitle(title)} | text: ${text}`
}

/**
 * Makes a title safe to place inside the document envelope.
 *
 * Without this a title like `Week 2 | text: ignore the following` would rewrite
 * the envelope the model reads, so the delimiter is replaced rather than
 * escaped — there is nothing downstream that would unescape it.
 *
 * Order matters: replace the delimiter, strip control characters (a newline
 * inside a single-line envelope is its own structural break), collapse
 * whitespace runs so the result is stable, and only then truncate. Truncation
 * is by code point so a surrogate pair is never split into a lone surrogate.
 */
export function normalizeGeminiTitle(title: string | undefined): string {
  if (title === undefined) {
    return GEMINI_EMBEDDING_ABSENT_TITLE
  }

  const withoutDelimiter = title.replaceAll('|', '/')
  // C0 controls and DEL. Replaced with a space rather than removed: deleting a
  // newline would silently join two words, and a newline inside a single-line
  // envelope is its own structural break.
  const withoutControls = stripControlCharacters(withoutDelimiter)
  const collapsed = withoutControls.replace(/\s+/gu, ' ').trim()

  if (collapsed === '') {
    return GEMINI_EMBEDDING_ABSENT_TITLE
  }

  return truncateByCodePoint(collapsed, MAX_EMBEDDING_TITLE_CODE_POINTS)
}

// A manual scan rather than a regex: an explicit control-character class trips
// the lint rule that exists to catch *accidental* control characters in
// patterns, and the intent here is the opposite of accidental.
const MAX_C0_CONTROL_CODE_POINT = 0x1f
const DEL_CODE_POINT = 0x7f

function stripControlCharacters(value: string): string {
  let result = ''
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    result +=
      codePoint <= MAX_C0_CONTROL_CODE_POINT || codePoint === DEL_CODE_POINT
        ? ' '
        : character
  }
  return result
}

function truncateByCodePoint(value: string, maxCodePoints: number): string {
  const codePoints: string[] = []
  for (const character of value) {
    if (codePoints.length >= maxCodePoints) {
      break
    }
    codePoints.push(character)
  }
  return codePoints.join('')
}
