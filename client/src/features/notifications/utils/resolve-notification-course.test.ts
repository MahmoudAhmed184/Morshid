import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getStudentSession } from '@/features/student/data/student-sessions.api'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import { ApiError } from '@/lib/api/http'

import { resolveNotificationCourseId } from './resolve-notification-course'

vi.mock('@/features/student/data/student-sessions.api')

const getStudentSessionMock = vi.mocked(getStudentSession)
const sessionId = '40000000-0000-4000-8000-000000000001'
const courses: StudentCourse[] = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    code: 'C1',
    title: 'Course One',
    membershipRole: 'STUDENT',
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    code: 'C2',
    title: 'Course Two',
    membershipRole: 'STUDENT',
  },
]

describe('resolveNotificationCourseId', () => {
  beforeEach(() => vi.resetAllMocks())

  it('finds the owning course without relying on the active course', async () => {
    getStudentSessionMock
      .mockRejectedValueOnce(
        new ApiError(
          'Session not found',
          404,
          'STUDENT_CHAT_SESSION_NOT_FOUND',
        ),
      )
      .mockResolvedValueOnce({
        id: sessionId,
        courseId: courses[1].id,
        title: 'Reviewed chat',
        lastMessageAt: null,
        createdAt: '2026-07-31T10:00:00.000Z',
        updatedAt: '2026-07-31T10:00:00.000Z',
      })

    await expect(
      resolveNotificationCourseId({ courses, sessionId }),
    ).resolves.toBe(courses[1].id)
    expect(getStudentSessionMock).toHaveBeenNthCalledWith(1, {
      courseId: courses[0].id,
      sessionId,
    })
    expect(getStudentSessionMock).toHaveBeenNthCalledWith(2, {
      courseId: courses[1].id,
      sessionId,
    })
  })

  it('returns null when no assigned course owns the session', async () => {
    getStudentSessionMock.mockRejectedValue(
      new ApiError('Session not found', 404, 'STUDENT_CHAT_SESSION_NOT_FOUND'),
    )

    await expect(
      resolveNotificationCourseId({ courses, sessionId }),
    ).resolves.toBeNull()
  })

  it('does not conceal non-not-found failures as a course mismatch', async () => {
    getStudentSessionMock.mockRejectedValue(new Error('Network unavailable'))

    await expect(
      resolveNotificationCourseId({ courses, sessionId }),
    ).rejects.toThrow('Network unavailable')
    expect(getStudentSessionMock).toHaveBeenCalledOnce()
  })
})
