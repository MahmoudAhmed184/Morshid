import {
  collectStreamToString,
  createConversationExportStream,
  escapeRawHtml,
  formatContentDisposition,
  formatExportHeader,
  formatExportMessage,
  formatGuidanceLabel,
  formatReviewOutcome,
  generateExportFilename,
  sanitizeFilename,
} from './conversation-markdown-export'
import type {
  ExportableMessageRecord,
  ExportableSessionRecord,
} from './interface/conversation-records'
import type { StudentCitationSource } from '../materials/interface/student-citation-sources'
import type { StudentPublishedGuidance } from '../reviews/interface/student-review-summaries'

describe('conversation-markdown-export', () => {
  describe('escapeRawHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeRawHtml('<script>alert("test") & \'quote\'</script>')).toBe(
        '&lt;script&gt;alert(&quot;test&quot;) &amp; &#39;quote&#39;&lt;/script&gt;',
      )
    })

    it('preserves clean text without changes', () => {
      expect(escapeRawHtml('Simple text with 123 numbers.')).toBe(
        'Simple text with 123 numbers.',
      )
    })
  })

  describe('formatGuidanceLabel', () => {
    it('formats all guidance labels cleanly', () => {
      expect(formatGuidanceLabel('COURSE_GROUNDED')).toBe('Course Grounded')
      expect(formatGuidanceLabel('GENERAL_NOT_FOUND')).toBe(
        'General Knowledge (Not Found in Course Material)',
      )
      expect(formatGuidanceLabel('UNCERTAIN_AWAITING_REVIEW')).toBe(
        'Uncertain (Awaiting Review)',
      )
      expect(formatGuidanceLabel('INSTRUCTOR_REVIEWED')).toBe(
        'Instructor Reviewed',
      )
      expect(formatGuidanceLabel('REFUSAL')).toBe('Refusal')
    })
  })

  describe('formatReviewOutcome', () => {
    it('formats review outcomes cleanly', () => {
      expect(formatReviewOutcome('APPROVED')).toBe('Approved')
      expect(formatReviewOutcome('EDITED')).toBe('Edited by Instructor')
      expect(formatReviewOutcome('REPLACED')).toBe('Replaced by Instructor')
      expect(formatReviewOutcome('REQUEST_REJECTED')).toBe('Request Rejected')
      expect(formatReviewOutcome(null)).toBe('Resolved')
    })
  })

  describe('filename generation and sanitization', () => {
    it('sanitizes unsafe characters from filenames', () => {
      expect(sanitizeFilename('Course: 101 / Intro *? "test"')).toBe(
        'Course-101-Intro-test',
      )
    })

    it('preserves Arabic and UTF-8 characters', () => {
      expect(sanitizeFilename('مرشد - الخوارزميات')).toBe('مرشد-الخوارزميات')
    })

    it('generates export filename with course code and session title', () => {
      const filename = generateExportFilename(
        'CS101',
        'Understanding Recursion & Trees',
      )
      expect(filename).toBe('morshid-CS101-Understanding-Recursion-Trees.md')
    })

    it('handles fallback when inputs are empty', () => {
      const filename = generateExportFilename('', '')
      expect(filename).toBe('morshid-course-conversation.md')
    })

    it('formats Content-Disposition header with ascii fallback and UTF-8 encoding', () => {
      const header = formatContentDisposition('morshid-CS101-مرشد.md')
      expect(header).toContain('attachment; filename="morshid-CS101-____.md"')
      expect(header).toContain(
        "filename*=UTF-8''morshid-CS101-%D9%85%D8%B1%D8%B4%D8%AF.md",
      )
    })
  })

  describe('formatExportHeader', () => {
    it('formats header with escaped course and session details', () => {
      const session: ExportableSessionRecord = {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Binary Search & <Trees>',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        course: {
          id: '22222222-2222-4222-8222-222222222222',
          code: 'CS101',
          title: 'Algorithms & Data Structures',
        },
      }
      const exportDate = new Date('2026-08-16T12:00:00.000Z')
      const header = formatExportHeader(session, exportDate)

      expect(header).toContain('# Morshid Conversation Export')
      expect(header).toContain(
        '- **Course:** CS101 — Algorithms &amp; Data Structures',
      )
      expect(header).toContain(
        '- **Conversation:** Binary Search &amp; &lt;Trees&gt;',
      )
      expect(header).toContain('- **Exported at:** 2026-08-16T12:00:00.000Z')
      expect(header).toContain('---')
    })
  })

  describe('formatExportMessage', () => {
    it('formats a student message', () => {
      const message: ExportableMessageRecord = {
        id: 'msg-1',
        sequence: 1,
        role: 'STUDENT',
        content: 'How does binary search work in <Python>?',
        guidanceLabel: null,
        createdAt: new Date('2026-08-16T12:01:00.000Z'),
        completedAt: new Date('2026-08-16T12:01:00.000Z'),
      }

      const formatted = formatExportMessage(message)
      expect(formatted).toContain(
        '## Message 1 — Student (2026-08-16T12:01:00.000Z)',
      )
      expect(formatted).toContain(
        'How does binary search work in &lt;Python&gt;?',
      )
      expect(formatted).toContain('---')
    })

    it('formats an assistant message with guidance label and citations', () => {
      const message: ExportableMessageRecord = {
        id: 'msg-2',
        sequence: 2,
        role: 'ASSISTANT',
        content: 'Binary search works by dividing the search interval in half.',
        guidanceLabel: 'COURSE_GROUNDED',
        createdAt: new Date('2026-08-16T12:01:02.000Z'),
        completedAt: new Date('2026-08-16T12:01:05.000Z'),
      }

      const citations: StudentCitationSource[] = [
        {
          messageId: 'msg-2',
          order: 1,
          materialId: 'mat-1',
          materialTitle: 'Chapter 3: Searching & Sorting',
          sourceAvailable: true,
          sourceStatus: 'AVAILABLE',
          evidence: [
            {
              rank: 1,
              similarityScore: 0.95,
              chunkId: 'chunk-1',
              chunkNumber: 4,
              excerpt:
                'Binary search repeatedly divides the search interval in half.',
            },
          ],
        },
      ]

      const formatted = formatExportMessage(message, citations)
      expect(formatted).toContain(
        '## Message 2 — Assistant (2026-08-16T12:01:05.000Z)',
      )
      expect(formatted).toContain('*Guidance: Course Grounded*')
      expect(formatted).toContain('### Citations')
      expect(formatted).toContain(
        '1. [1] **Chapter 3: Searching &amp; Sorting**',
      )
      expect(formatted).toContain(
        '- Excerpt (Chunk 4): > "Binary search repeatedly divides the search interval in half."',
      )
    })

    it('formats an assistant message with published instructor guidance', () => {
      const message: ExportableMessageRecord = {
        id: 'msg-2',
        sequence: 2,
        role: 'ASSISTANT',
        content: 'Original guidance response.',
        guidanceLabel: 'INSTRUCTOR_REVIEWED',
        createdAt: new Date('2026-08-16T12:01:02.000Z'),
        completedAt: new Date('2026-08-16T12:01:05.000Z'),
      }

      const publishedGuidance: StudentPublishedGuidance = {
        messageId: 'msg-2',
        reviewCaseId: 'rev-1',
        outcome: 'EDITED',
        publishedContent: 'Instructor-revised guidance explaining base cases.',
        resolvedAt: new Date('2026-08-16T13:00:00.000Z'),
      }

      const formatted = formatExportMessage(message, [], publishedGuidance)
      expect(formatted).toContain('### Published Instructor Guidance')
      expect(formatted).toContain(
        '*Outcome: Edited by Instructor (2026-08-16T13:00:00.000Z)*',
      )
      expect(formatted).toContain(
        'Instructor-revised guidance explaining base cases.',
      )
    })

    it('indicates when cited source is unavailable or deleted', () => {
      const message: ExportableMessageRecord = {
        id: 'msg-2',
        sequence: 2,
        role: 'ASSISTANT',
        content: 'Response with deleted citation.',
        guidanceLabel: null,
        createdAt: new Date('2026-08-16T12:01:02.000Z'),
        completedAt: new Date('2026-08-16T12:01:05.000Z'),
      }

      const citations: StudentCitationSource[] = [
        {
          messageId: 'msg-2',
          order: 1,
          materialId: 'mat-deleted',
          materialTitle: 'Old Slides',
          sourceAvailable: false,
          sourceStatus: 'DELETED',
          evidence: [],
        },
      ]

      const formatted = formatExportMessage(message, citations)
      expect(formatted).toContain(
        '1. [1] **Old Slides** *(Source unavailable)*',
      )
    })
  })

  describe('createConversationExportStream', () => {
    it('streams complete conversation history in sequence order', async () => {
      const session: ExportableSessionRecord = {
        id: 'session-1',
        title: 'Full Export Test',
        createdAt: new Date('2026-08-16T10:00:00.000Z'),
        course: {
          id: 'course-1',
          code: 'CS101',
          title: 'Python Programming',
        },
      }

      const messages: ExportableMessageRecord[] = [
        {
          id: 'msg-1',
          sequence: 1,
          role: 'STUDENT',
          content: 'What is a dictionary?',
          guidanceLabel: null,
          createdAt: new Date('2026-08-16T10:01:00.000Z'),
          completedAt: new Date('2026-08-16T10:01:00.000Z'),
        },
        {
          id: 'msg-2',
          sequence: 2,
          role: 'ASSISTANT',
          content: 'A dictionary in Python is a key-value mapping.',
          guidanceLabel: 'COURSE_GROUNDED',
          createdAt: new Date('2026-08-16T10:01:02.000Z'),
          completedAt: new Date('2026-08-16T10:01:04.000Z'),
        },
      ]

      const stream = createConversationExportStream(
        session,
        {
          fetchMessagesBatch: (cursor) => {
            if (cursor === undefined) return Promise.resolve(messages)
            return Promise.resolve([])
          },
          fetchCitations: () => Promise.resolve([]),
          fetchPublishedGuidance: () => Promise.resolve([]),
        },
        new Date('2026-08-16T12:00:00.000Z'),
      )

      const result = await collectStreamToString(stream)
      expect(result).toContain('# Morshid Conversation Export')
      expect(result).toContain('## Message 1 — Student')
      expect(result).toContain('What is a dictionary?')
      expect(result).toContain('## Message 2 — Assistant')
      expect(result).toContain('A dictionary in Python is a key-value mapping.')
    })
  })
})
