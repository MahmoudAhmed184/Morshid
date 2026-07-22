import { describe, expect, it } from 'vitest'

import {
  chatMessageHistoryResponseSchema,
  chatSessionListResponseSchema,
  chatSessionResponseSchema,
  createChatSessionRequestSchema,
  deleteChatSessionResponseSchema,
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
  primaryChatSessionFixture,
} from '../testing/student-chat.fixtures'

describe('Student chat contract schemas', () => {
  it('accepts valid session list and ordered message history responses', () => {
    expect(
      chatSessionListResponseSchema.parse(chatSessionListResponseFixture),
    ).toEqual(chatSessionListResponseFixture)
    expect(
      chatMessageHistoryResponseSchema.parse(chatMessageHistoryResponseFixture),
    ).toEqual(chatMessageHistoryResponseFixture)
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

  it('rejects message history that is not in stable sequence order', () => {
    expect(() =>
      chatMessageHistoryResponseSchema.parse({
        messages: [...chatMessageHistoryResponseFixture.messages].reverse(),
        nextCursor: null,
      }),
    ).toThrow(/increasing sequence/)
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
        content: '  Explain lists  ',
      }),
    ).toEqual({ content: 'Explain lists' })
    expect(
      sendStudentChatMessageRequestSchema.safeParse({
        content: '😀'.repeat(4_000),
      }).success,
    ).toBe(true)

    for (const input of [
      { content: ' ' },
      { content: '😀'.repeat(4_001) },
      { content: 'Question', courseId: 'client-course' },
      { content: 'Question', studentId: 'client-student' },
      { content: 'Question', chunks: [] },
      { content: 'Question', ranks: [1] },
      { content: 'Question', citations: [] },
      { content: 'Question', provider: 'client-provider' },
      { content: 'Question', model: 'client-model' },
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
