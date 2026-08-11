import { describe, expect, it } from 'vitest'

import {
  chatMessageHistoryResponseSchema,
  chatMessageSchema,
  chatSessionListResponseSchema,
  chatSessionResponseSchema,
  createChatSessionRequestSchema,
  createStudentReviewRequestSchema,
  deleteChatSessionResponseSchema,
  listChatMessagesInputSchema,
  renameChatSessionRequestSchema,
  studentAiTutorSearchSchema,
  groundedChatTurnResponseSchema,
  sendStudentChatMessageRequestSchema,
} from './student-chat.schema'
import {
  chatMessageHistoryResponseFixture,
  chatSessionListResponseFixture,
  groundedChatTurnResponseFixture,
  malformedChatSessionResponseFixture,
  orderedChatMessagesFixture,
  primaryChatSessionFixture,
  studentChatIds,
} from '../testing/student-chat.fixtures'

describe('Student chat contract schemas', () => {
  it.each([
    'INCORRECT',
    'CONFUSING',
    'UNHELPFUL',
    'COURSE_MISMATCH',
    'TOO_MUCH_ANSWER',
    'OTHER',
  ] as const)('accepts the %s Student flag reason', (flagReason) => {
    expect(
      createStudentReviewRequestSchema.parse({
        flagReason,
        note: flagReason === 'OTHER' ? 'Another concern' : null,
      }),
    ).toEqual({
      flagReason,
      note: flagReason === 'OTHER' ? 'Another concern' : null,
    })
  })

  it('normalizes notes and requires a non-empty note for OTHER', () => {
    expect(
      createStudentReviewRequestSchema.parse({
        flagReason: 'OTHER',
        note: '  Another concern  ',
      }),
    ).toEqual({ flagReason: 'OTHER', note: 'Another concern' })
    expect(() =>
      createStudentReviewRequestSchema.parse({
        flagReason: 'OTHER',
        note: '   ',
      }),
    ).toThrow()
    expect(() =>
      createStudentReviewRequestSchema.parse({ note: null }),
    ).toThrow()
    expect(() =>
      createStudentReviewRequestSchema.parse({
        flagReason: 'INVALID',
        note: null,
      }),
    ).toThrow()
  })

  it('accepts valid session list and ordered message history responses', () => {
    expect(
      chatSessionListResponseSchema.parse(chatSessionListResponseFixture),
    ).toEqual(chatSessionListResponseFixture)
    expect(
      chatMessageHistoryResponseSchema.parse(chatMessageHistoryResponseFixture),
    ).toEqual(chatMessageHistoryResponseFixture)
  })

  it('requires reloadable prompt metadata and bounds persisted hint levels to 1–4', () => {
    const assistant = orderedChatMessagesFixture[1]

    expect(chatMessageSchema.parse(assistant)).toMatchObject({
      hintLevel: 1,
      promptVersion: 'tutor-generation.mvp.v3',
    })
    expect(
      chatMessageSchema.safeParse({ ...assistant, hintLevel: 0 }).success,
    ).toBe(false)
    expect(
      chatMessageSchema.safeParse({ ...assistant, hintLevel: 5 }).success,
    ).toBe(false)
    const { promptVersion: _promptVersion, ...withoutPromptVersion } = assistant
    expect(chatMessageSchema.safeParse(withoutPromptVersion).success).toBe(
      false,
    )
  })

  it.each([
    {
      status: 'PENDING',
      outcome: null,
      resolvedAt: null,
      hasNotification: false,
    },
    {
      status: 'RESOLVED',
      outcome: 'EDITED',
      resolvedAt: '2026-07-31T10:00:00.000Z',
      hasNotification: true,
    },
    {
      status: 'REJECTED',
      outcome: 'REQUEST_REJECTED',
      resolvedAt: '2026-07-31T10:00:00.000Z',
      hasNotification: true,
    },
  ] as const)(
    'loads saved chat history with a $status review summary',
    (summary) => {
      const assistantMessage = chatMessageHistoryResponseFixture.messages[1]
      const response = {
        ...chatMessageHistoryResponseFixture,
        messages: [
          chatMessageHistoryResponseFixture.messages[0],
          {
            ...assistantMessage,
            reviewSummary: {
              reviewCaseId: studentChatIds.primarySession,
              ...summary,
            },
          },
        ],
      }

      expect(chatMessageHistoryResponseSchema.parse(response)).toEqual(response)
    },
  )

  it('keeps review summaries strict and rejects unrelated fields', () => {
    const assistantMessage = chatMessageHistoryResponseFixture.messages[1]
    expect(() =>
      chatMessageHistoryResponseSchema.parse({
        ...chatMessageHistoryResponseFixture,
        messages: [
          chatMessageHistoryResponseFixture.messages[0],
          {
            ...assistantMessage,
            reviewSummary: {
              reviewCaseId: studentChatIds.primarySession,
              status: 'RESOLVED',
              outcome: 'APPROVED',
              resolvedAt: '2026-07-31T10:00:00.000Z',
              hasNotification: true,
              instructorId: 'must-not-be-accepted',
            },
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects missing and incorrectly typed session fields', () => {
    const { updatedAt: _updatedAt, ...missingUpdatedAt } =
      primaryChatSessionFixture

    expect(() =>
      chatSessionResponseSchema.parse({ session: missingUpdatedAt }),
    ).toThrow()
    expect(() =>
      chatSessionResponseSchema.parse({
        session: { ...primaryChatSessionFixture, lastMessageAt: 42 },
      }),
    ).toThrow()
  })

  it('rejects unexpected owner fields and cross-shaped responses', () => {
    expect(() =>
      chatSessionResponseSchema.parse(malformedChatSessionResponseFixture),
    ).toThrow()
    expect(() =>
      chatSessionListResponseSchema.parse({
        courses: [],
        nextCursor: null,
      }),
    ).toThrow()
  })

  it('rejects invalid message roles and sequence values', () => {
    const [firstMessage] = chatMessageHistoryResponseFixture.messages

    expect(() =>
      chatMessageHistoryResponseSchema.parse({
        messages: [{ ...firstMessage, role: 'INSTRUCTOR' }],
        nextCursor: null,
      }),
    ).toThrow()
    expect(() =>
      chatMessageHistoryResponseSchema.parse({
        messages: [{ ...firstMessage, sequence: 0 }],
        nextCursor: null,
      }),
    ).toThrow()
  })

  it('validates strict grounded-turn citations and availability invariants', () => {
    expect(
      groundedChatTurnResponseSchema.parse(groundedChatTurnResponseFixture),
    ).toEqual(groundedChatTurnResponseFixture)

    const citation =
      groundedChatTurnResponseFixture.assistantMessage.citations[0]
    for (const malformed of [
      { ...citation, sourceAvailable: false },
      { ...citation, evidence: [{ ...citation.evidence[0], rank: 0 }] },
      {
        ...citation,
        evidence: [{ ...citation.evidence[0], similarityScore: 1.1 }],
      },
      { ...citation, evidence: [{ ...citation.evidence[0], chunkNumber: 0 }] },
      { ...citation, evidence: [{ ...citation.evidence[0], score: 0.9 }] },
    ]) {
      expect(() =>
        groundedChatTurnResponseSchema.parse({
          ...groundedChatTurnResponseFixture,
          assistantMessage: {
            ...groundedChatTurnResponseFixture.assistantMessage,
            citations: [malformed],
          },
        }),
      ).toThrow()
    }
  })

  it('rejects duplicated retrieval evidence and unordered material citations', () => {
    const citation =
      groundedChatTurnResponseFixture.assistantMessage.citations[0]
    const duplicatedEvidence = {
      ...citation,
      evidence: [citation.evidence[0], { ...citation.evidence[0], rank: 2 }],
    }
    const unorderedCitations = [
      citation,
      {
        ...citation,
        materialId: 'd9025891-76d7-4e2d-97d5-b9ff32183217',
      },
    ]

    for (const citations of [[duplicatedEvidence], unorderedCitations]) {
      expect(() =>
        groundedChatTurnResponseSchema.parse({
          ...groundedChatTurnResponseFixture,
          assistantMessage: {
            ...groundedChatTurnResponseFixture.assistantMessage,
            citations,
          },
        }),
      ).toThrow()
    }
  })

  it('rejects cross-shaped and non-terminal complete grounded turns', () => {
    for (const response of [
      {
        ...groundedChatTurnResponseFixture,
        studentMessage: {
          ...groundedChatTurnResponseFixture.studentMessage,
          role: 'ASSISTANT',
        },
      },
      {
        ...groundedChatTurnResponseFixture,
        assistantMessage: {
          ...groundedChatTurnResponseFixture.assistantMessage,
          responseToMessageId: null,
        },
      },
      {
        ...groundedChatTurnResponseFixture,
        assistantMessage: {
          ...groundedChatTurnResponseFixture.assistantMessage,
          status: 'PENDING',
        },
      },
    ]) {
      expect(groundedChatTurnResponseSchema.safeParse(response).success).toBe(
        false,
      )
    }
  })

  it('rejects message history that is not in stable sequence order', () => {
    expect(() =>
      chatMessageHistoryResponseSchema.parse({
        messages: [...chatMessageHistoryResponseFixture.messages].reverse(),
        nextCursor: null,
      }),
    ).toThrow(/increasing sequence/)

    expect(() =>
      chatMessageHistoryResponseSchema.parse({
        messages: [
          chatMessageHistoryResponseFixture.messages[0],
          {
            ...chatMessageHistoryResponseFixture.messages[0],
            sequence: 2,
          },
        ],
        nextCursor: null,
      }),
    ).toThrow(/duplicate messages/)
  })

  it('accepts only the approved create and rename request fields', () => {
    expect(createChatSessionRequestSchema.parse({})).toEqual({})
    expect(
      createChatSessionRequestSchema.parse({ title: '  List practice  ' }),
    ).toEqual({ title: 'List practice' })
    expect(
      renameChatSessionRequestSchema.parse({ title: '  New title  ' }),
    ).toEqual({ title: 'New title' })

    expect(() =>
      createChatSessionRequestSchema.parse({
        title: 'Private chat',
        ownerId: '8f9c19d1-eed5-43de-8bd9-995919825f9f',
      }),
    ).toThrow()
    expect(() =>
      renameChatSessionRequestSchema.parse({ title: '   ' }),
    ).toThrow()
  })

  it('accepts only trimmed grounded-chat content within 4,000 Unicode code points', () => {
    expect(
      sendStudentChatMessageRequestSchema.parse({
        clientMessageId: studentChatIds.studentMessage,
        content: '  Explain lists  ',
        problemId: studentChatIds.primaryTopic,
        conceptId: '8e8a2e4a-f2f5-4d63-9dc8-4f7f5c02b2a6',
        title: '  List iteration  ',
      }),
    ).toEqual({
      clientMessageId: studentChatIds.studentMessage,
      content: 'Explain lists',
      problemId: studentChatIds.primaryTopic,
      conceptId: '8e8a2e4a-f2f5-4d63-9dc8-4f7f5c02b2a6',
      title: 'List iteration',
    })
    expect(
      sendStudentChatMessageRequestSchema.safeParse({
        clientMessageId: studentChatIds.studentMessage,
        content: '😀'.repeat(4_000),
      }).success,
    ).toBe(true)

    for (const input of [
      { clientMessageId: studentChatIds.studentMessage, content: ' ' },
      {
        clientMessageId: studentChatIds.studentMessage,
        content: '😀'.repeat(4_001),
      },
      {
        clientMessageId: studentChatIds.studentMessage,
        content: 'Question',
        courseId: 'client-course',
      },
      {
        clientMessageId: studentChatIds.studentMessage,
        content: 'Question',
        studentId: 'client-student',
      },
      {
        clientMessageId: studentChatIds.studentMessage,
        content: 'Question',
        chunks: [],
      },
      {
        clientMessageId: studentChatIds.studentMessage,
        content: 'Question',
        ranks: [1],
      },
      {
        clientMessageId: studentChatIds.studentMessage,
        content: 'Question',
        citations: [],
      },
      {
        clientMessageId: studentChatIds.studentMessage,
        content: 'Question',
        provider: 'client-provider',
      },
      {
        clientMessageId: studentChatIds.studentMessage,
        content: 'Question',
        model: 'client-model',
      },
      { clientMessageId: 'not-a-uuid', content: 'Question' },
      { content: 'Question' },
      {
        clientMessageId: studentChatIds.studentMessage,
        content: 'Question',
        problemId: 'not-a-uuid',
      },
      {
        clientMessageId: studentChatIds.studentMessage,
        content: 'Question',
        title: '   ',
      },
    ]) {
      expect(sendStudentChatMessageRequestSchema.safeParse(input).success).toBe(
        false,
      )
    }
  })

  it('models the delete contract as an empty 204 response', () => {
    expect(deleteChatSessionResponseSchema.parse(undefined)).toBeUndefined()
    expect(() => deleteChatSessionResponseSchema.parse({})).toThrow()
  })

  it('supports explicit latest and backward pagination without mixed cursors', () => {
    expect(
      listChatMessagesInputSchema.parse({ limit: 50, before: 101 }),
    ).toEqual({ limit: 50, before: 101 })
    expect(
      listChatMessagesInputSchema.parse({ limit: 50, page: 'latest' }),
    ).toEqual({ limit: 50, page: 'latest' })
    expect(
      listChatMessagesInputSchema.safeParse({ after: 50, before: 101 }).success,
    ).toBe(false)
    expect(
      listChatMessagesInputSchema.safeParse({ after: 50, page: 'latest' })
        .success,
    ).toBe(false)
  })

  it('validates optional AI Tutor course and session search state', () => {
    expect(studentAiTutorSearchSchema.parse({})).toEqual({})
    expect(
      studentAiTutorSearchSchema.parse({
        courseId: 'course-id',
        sessionId: 'session-id',
      }),
    ).toEqual({ courseId: 'course-id', sessionId: 'session-id' })
    expect(() => studentAiTutorSearchSchema.parse({ courseId: '' })).toThrow()
    expect(() => studentAiTutorSearchSchema.parse({ sessionId: '' })).toThrow()
  })
})
