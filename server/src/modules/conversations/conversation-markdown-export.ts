import { Readable } from 'node:stream'

import type {
  ExportableMessageRecord,
  ExportableSessionRecord,
} from './interface/conversation-records'
import type { MessageGuidanceLabel } from './interface/conversation-values'
import type { StudentCitationSource } from '../materials/interface/student-citation-sources'
import type { StudentPublishedGuidance } from '../reviews/interface/student-review-summaries'

export function escapeRawHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatGuidanceLabel(label: MessageGuidanceLabel): string {
  switch (label) {
    case 'COURSE_GROUNDED':
      return 'Course Grounded'
    case 'GENERAL_NOT_FOUND':
      return 'General Knowledge (Not Found in Course Material)'
    case 'UNCERTAIN_AWAITING_REVIEW':
      return 'Uncertain (Awaiting Review)'
    case 'INSTRUCTOR_REVIEWED':
      return 'Instructor Reviewed'
    case 'REFUSAL':
      return 'Refusal'
    default:
      return label
  }
}

export function formatReviewOutcome(
  outcome: 'APPROVED' | 'EDITED' | 'REPLACED' | 'REQUEST_REJECTED' | null,
): string {
  switch (outcome) {
    case 'APPROVED':
      return 'Approved'
    case 'EDITED':
      return 'Edited by Instructor'
    case 'REPLACED':
      return 'Replaced by Instructor'
    case 'REQUEST_REJECTED':
      return 'Request Rejected'
    case null:
      return 'Resolved'
  }
}

const MAX_FILENAME_SEGMENT_LENGTH = 60
const MAX_TOTAL_FILENAME_LENGTH = 140

export function sanitizeFilename(name: string): string {
  const sanitized = Array.from(name)
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      if (
        codePoint < 0x20 ||
        codePoint === 0x7f ||
        /[/\\:*?"<>|&]/.test(character)
      ) {
        return '-'
      }
      return character
    })
    .join('')
    .replace(/[\s\t\n\r-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')

  return sanitized.slice(0, MAX_FILENAME_SEGMENT_LENGTH)
}

export function generateExportFilename(
  courseCode: string,
  sessionTitle: string,
): string {
  const safeCode = sanitizeFilename(courseCode) || 'course'
  const safeTitle = sanitizeFilename(sessionTitle) || 'conversation'
  const baseName = `morshid-${safeCode}-${safeTitle}`

  const truncated = baseName.slice(0, MAX_TOTAL_FILENAME_LENGTH)
  return `${truncated}.md`
}

export function formatContentDisposition(filename: string): string {
  const asciiFallback = filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
  const encodedUtf8 = encodeURIComponent(filename)

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8}`
}

export function formatExportHeader(
  session: ExportableSessionRecord,
  exportDate: Date,
): string {
  return [
    '# Morshid Conversation Export',
    '',
    `- **Course:** ${escapeRawHtml(session.course.code)} — ${escapeRawHtml(session.course.title)}`,
    `- **Conversation:** ${escapeRawHtml(session.title)}`,
    `- **Exported at:** ${exportDate.toISOString()}`,
    '',
    '---',
    '',
    '',
  ].join('\n')
}

export function formatExportMessage(
  message: ExportableMessageRecord,
  citations: readonly StudentCitationSource[] = [],
  publishedGuidance?: StudentPublishedGuidance,
): string {
  const roleName = message.role === 'STUDENT' ? 'Student' : 'Assistant'
  const timestamp = (message.completedAt ?? message.createdAt).toISOString()

  const lines: string[] = [
    `## Message ${String(message.sequence)} — ${roleName} (${timestamp})`,
    '',
  ]

  if (message.role === 'ASSISTANT' && message.guidanceLabel !== null) {
    lines.push(`*Guidance: ${formatGuidanceLabel(message.guidanceLabel)}*`, '')
  }

  lines.push(escapeRawHtml(message.content), '')

  if (message.role === 'ASSISTANT' && citations.length > 0) {
    lines.push('### Citations', '')
    for (const citation of citations) {
      const isUnavailable = citation.sourceStatus !== 'AVAILABLE'
      const statusSuffix = isUnavailable ? ' *(Source unavailable)*' : ''
      lines.push(
        `${String(citation.order)}. [${String(citation.order)}] **${escapeRawHtml(citation.materialTitle)}**${statusSuffix}`,
      )

      if (!isUnavailable && citation.evidence.length > 0) {
        for (const evidence of citation.evidence) {
          lines.push(
            `   - Excerpt (Chunk ${String(evidence.chunkNumber)}): > "${escapeRawHtml(evidence.excerpt)}"`,
          )
        }
      }
    }
    lines.push('')
  }

  if (
    publishedGuidance?.publishedContent !== undefined &&
    publishedGuidance.publishedContent !== null &&
    publishedGuidance.publishedContent.length > 0
  ) {
    const outcomeLabel = formatReviewOutcome(publishedGuidance.outcome)
    const resolvedTime =
      publishedGuidance.resolvedAt !== null
        ? ` (${publishedGuidance.resolvedAt.toISOString()})`
        : ''
    lines.push(
      '### Published Instructor Guidance',
      `*Outcome: ${outcomeLabel}${resolvedTime}*`,
      '',
      escapeRawHtml(publishedGuidance.publishedContent),
      '',
    )
  }

  lines.push('---', '', '')

  return lines.join('\n')
}

export interface ConversationExportStreamSources {
  fetchMessagesBatch: (cursor?: number) => Promise<ExportableMessageRecord[]>
  fetchCitations: (
    messageIds: string[],
  ) => Promise<readonly StudentCitationSource[]>
  fetchPublishedGuidance: (
    messageIds: string[],
  ) => Promise<readonly StudentPublishedGuidance[]>
}

export async function* generateExportChunks(
  session: ExportableSessionRecord,
  sources: ConversationExportStreamSources,
  exportDate = new Date(),
): AsyncGenerator<string> {
  yield formatExportHeader(session, exportDate)

  let cursor: number | undefined = undefined
  let hasMore = true

  while (hasMore) {
    const batch = await sources.fetchMessagesBatch(cursor)
    if (batch.length === 0) {
      break
    }

    const messageIds = batch.map((message) => message.id)
    const [citations, publishedGuidances] = await Promise.all([
      sources.fetchCitations(messageIds),
      sources.fetchPublishedGuidance(messageIds),
    ])

    const citationsByMessage = new Map<string, StudentCitationSource[]>()
    for (const citation of citations) {
      const list = citationsByMessage.get(citation.messageId) ?? []
      list.push(citation)
      citationsByMessage.set(citation.messageId, list)
    }

    const guidanceByMessage = new Map<string, StudentPublishedGuidance>()
    for (const guidance of publishedGuidances) {
      guidanceByMessage.set(guidance.messageId, guidance)
    }

    for (const message of batch) {
      const messageCitations = (citationsByMessage.get(message.id) ?? []).sort(
        (a, b) => a.order - b.order,
      )
      const messageGuidance = guidanceByMessage.get(message.id)

      yield formatExportMessage(message, messageCitations, messageGuidance)
    }

    cursor = batch[batch.length - 1]?.sequence
    if (batch.length < 100) {
      hasMore = false
    }
  }
}

export function createConversationExportStream(
  session: ExportableSessionRecord,
  sources: ConversationExportStreamSources,
  exportDate = new Date(),
): Readable {
  return Readable.from(generateExportChunks(session, sources, exportDate))
}

export async function collectStreamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    const buffer: Buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(typeof chunk === 'string' ? chunk : String(chunk))
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf-8')
}
