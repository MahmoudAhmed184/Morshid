import { describe, expect, it } from 'vitest'

import {
  instructorReviewDetailSchema,
  instructorReviewQueueItemSchema,
} from './instructor-review.schema'

const studentFlagReasons = [
  'INCORRECT',
  'CONFUSING',
  'UNHELPFUL',
  'COURSE_MISMATCH',
  'TOO_MUCH_ANSWER',
  'OTHER',
] as const

const reviewCaseId = '10000000-0000-4000-8000-000000000001'
const courseId = '20000000-0000-4000-8000-000000000001'
const studentId = '30000000-0000-4000-8000-000000000001'

describe('Instructor review Student flag reason contract', () => {
  it.each(studentFlagReasons)('queue accepts %s', (studentFlagReason) => {
    expect(
      instructorReviewQueueItemSchema.parse({
        ...queueItem,
        studentFlagReason,
      }).studentFlagReason,
    ).toBe(studentFlagReason)
  })

  it.each(studentFlagReasons)('detail accepts %s', (studentFlagReason) => {
    expect(
      instructorReviewDetailSchema.parse({
        ...detail,
        studentFlagReason,
      }).studentFlagReason,
    ).toBe(studentFlagReason)
  })

  it('queue and detail accept a null Student flag reason', () => {
    expect(
      instructorReviewQueueItemSchema.parse({
        ...queueItem,
        studentFlagReason: null,
      }).studentFlagReason,
    ).toBeNull()
    expect(
      instructorReviewDetailSchema.parse({
        ...detail,
        studentFlagReason: null,
      }).studentFlagReason,
    ).toBeNull()
  })

  it('queue and detail reject an unknown Student flag reason', () => {
    expect(() =>
      instructorReviewQueueItemSchema.parse({
        ...queueItem,
        studentFlagReason: 'UNKNOWN_REASON',
      }),
    ).toThrow()
    expect(() =>
      instructorReviewDetailSchema.parse({
        ...detail,
        studentFlagReason: 'UNKNOWN_REASON',
      }),
    ).toThrow()
  })
})

const queueItem = {
  reviewCaseId,
  status: 'PENDING',
  trigger: 'STUDENT_REQUEST',
  triggers: ['STUDENT_REQUEST'],
  studentFlagReason: null,
  studentNote: 'student note',
  createdAt: '2026-07-29T10:00:00.000Z',
  age: 120,
  course: { id: courseId, code: 'C1', title: 'Course One' },
  student: { id: studentId, displayName: 'Safe Student' },
  pending: true,
}

const detail = {
  reviewCaseId,
  status: 'PENDING',
  version: 3,
  canReject: true,
  trigger: 'STUDENT_REQUEST',
  triggers: ['STUDENT_REQUEST'],
  studentFlagReason: null,
  createdAt: '2026-07-29T10:00:00.000Z',
  requestedAt: '2026-07-29T10:00:01.000Z',
  studentNote: 'student note',
  course: queueItem.course,
  student: queueItem.student,
  flaggedExchange: message('STUDENT', 'Flagged question'),
  assistantResponse: {
    ...message('ASSISTANT', 'Flagged answer'),
    citations: [],
  },
  previousExchange: null,
  followingExchange: null,
  reviewSummary: {
    reviewCaseId,
    status: 'PENDING',
    outcome: null,
    resolvedAt: null,
  },
}

function message(role: 'STUDENT' | 'ASSISTANT', content: string) {
  return {
    role,
    content,
    createdAt: '2026-07-29T09:00:00.000Z',
  }
}
