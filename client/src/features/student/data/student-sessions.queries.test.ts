import { describe, expect, it } from 'vitest'

import {
  studentSessionKeys,
  studentSessionMessagesQueryOptions,
  studentSessionsQueryOptions,
} from './student-sessions.queries'

const studentId = '8f9c19d1-eed5-43de-8bd9-995919825f9f'
const otherStudentId = '96f2fa84-7cd0-4488-8b18-439b0ce7a0f8'
const courseId = '17d1a78d-60be-4f5f-a03d-e3ee326ec796'
const otherCourseId = '5cf0a2f6-f1ab-4b83-971a-fcd4cd6a92ee'
const sessionId = 'eff4bf27-cce3-45d9-b245-4f1d913f0a27'

describe('Student session query options', () => {
  it('partitions session lists by authenticated Student and course', () => {
    const primary = studentSessionsQueryOptions({
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
      {},
    ])
    expect(
      studentSessionsQueryOptions({
        studentId: otherStudentId,
        courseId,
      }).queryKey,
    ).not.toEqual(primary)
    expect(
      studentSessionsQueryOptions({
        studentId,
        courseId: otherCourseId,
      }).queryKey,
    ).not.toEqual(primary)
  })

  it('partitions history by Student, course, session, and page', () => {
    const primary = studentSessionMessagesQueryOptions({
      studentId,
      courseId,
      sessionId,
      input: { after: 2 },
    }).queryKey

    expect(primary).toEqual([
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      sessionId,
      'messages',
      { after: 2 },
    ])
    expect(
      studentSessionMessagesQueryOptions({
        studentId: otherStudentId,
        courseId,
        sessionId,
        input: { after: 2 },
      }).queryKey,
    ).not.toEqual(primary)
    expect(
      studentSessionMessagesQueryOptions({
        studentId,
        courseId,
        sessionId,
        input: { after: 3 },
      }).queryKey,
    ).not.toEqual(primary)
  })

  it('keeps list and message prefixes separate for scoped cache updates', () => {
    expect(studentSessionKeys.sessionLists({ studentId, courseId })).toEqual([
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      'list',
    ])
    expect(
      studentSessionKeys.messages({ studentId, courseId, sessionId }),
    ).toEqual([
      'student-chat',
      studentId,
      'courses',
      courseId,
      'sessions',
      sessionId,
      'messages',
    ])
  })
})
