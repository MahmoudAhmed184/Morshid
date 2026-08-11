import { describe, expect, it } from 'vitest'

import {
  chatSessionKeys,
  chatSessionQueryOptions,
  chatMessagesQueryOptions,
  chatSessionsQueryOptions,
} from './chat-sessions.queries'

const studentId = '8f9c19d1-eed5-43de-8bd9-995919825f9f'
const otherStudentId = '96f2fa84-7cd0-4488-8b18-439b0ce7a0f8'
const courseId = '17d1a78d-60be-4f5f-a03d-e3ee326ec796'
const otherCourseId = '5cf0a2f6-f1ab-4b83-971a-fcd4cd6a92ee'
const sessionId = 'eff4bf27-cce3-45d9-b245-4f1d913f0a27'

describe('Student session query options', () => {
  it('partitions session lists by authenticated Student and course', () => {
    const primary = chatSessionsQueryOptions({
      studentId,
      courseId,
    }).queryKey

    expect(primary).toEqual([
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      'list',
    ])
    expect(
      chatSessionsQueryOptions({
        studentId: otherStudentId,
        courseId,
      }).queryKey,
    ).not.toEqual(primary)
    expect(
      chatSessionsQueryOptions({
        studentId,
        courseId: otherCourseId,
      }).queryKey,
    ).not.toEqual(primary)
  })

  it('partitions history by Student, course, and session', () => {
    const primary = chatMessagesQueryOptions({
      studentId,
      courseId,
      sessionId,
    }).queryKey

    expect(primary).toEqual([
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      sessionId,
      'messages',
    ])
    expect(
      chatMessagesQueryOptions({
        studentId: otherStudentId,
        courseId,
        sessionId,
      }).queryKey,
    ).not.toEqual(primary)
    expect(
      chatMessagesQueryOptions({
        studentId,
        courseId,
        sessionId: '25587e6e-4e6a-4533-9d4f-97be9e63bd96',
      }).queryKey,
    ).not.toEqual(primary)
  })

  it('partitions session details by Student, course, and session', () => {
    const primary = chatSessionQueryOptions({
      studentId,
      courseId,
      sessionId,
    }).queryKey

    expect(primary).toEqual([
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      sessionId,
      'detail',
    ])
    expect(
      chatSessionQueryOptions({
        studentId: otherStudentId,
        courseId,
        sessionId,
      }).queryKey,
    ).not.toEqual(primary)
    expect(
      chatSessionQueryOptions({
        studentId,
        courseId: otherCourseId,
        sessionId,
      }).queryKey,
    ).not.toEqual(primary)
  })

  it('keeps list and message prefixes separate for scoped cache updates', () => {
    expect(chatSessionKeys.sessionLists({ studentId, courseId })).toEqual([
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      'list',
    ])
    expect(
      chatSessionKeys.messages({ studentId, courseId, sessionId }),
    ).toEqual([
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      sessionId,
      'messages',
    ])
    expect(chatSessionKeys.detail({ studentId, courseId, sessionId })).toEqual([
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      sessionId,
      'detail',
    ])
  })
})
