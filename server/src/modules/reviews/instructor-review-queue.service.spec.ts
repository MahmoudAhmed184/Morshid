import {
  ReviewStatus,
  ReviewTriggerType,
  StudentFlagReason,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { InstructorReviewQueueService } from './instructor-review-queue.service'

describe('InstructorReviewQueueService', () => {
  const user: AuthenticatedRequestUser = {
    id: 'instructor-1',
    email: 'instructor@example.test',
    displayName: 'Instructor',
    role: UserRole.INSTRUCTOR,
    status: UserStatus.ACTIVE,
  }
  const isOwnedCourse = jest.fn()
  const list = jest.fn()
  const service = new InstructorReviewQueueService({
    isOwnedCourse,
    list,
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('conceals missing and other-Instructor courses with the same not-found error', async () => {
    isOwnedCourse.mockResolvedValue(false)

    await expect(
      service.list(user, { courseId: 'course-x', limit: 25 }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'REVIEW_NOT_FOUND' },
    })
    expect(list).not.toHaveBeenCalled()
  })

  it('returns a stable page, safe queue fields, age, pending state, and count', async () => {
    list.mockResolvedValue({
      pendingCount: 7,
      records: [
        record('case-3', ReviewStatus.PENDING, '2026-07-29T11:59:00.000Z'),
        record('case-2', ReviewStatus.PENDING, '2026-07-29T11:58:00.000Z'),
        record('case-1', ReviewStatus.IN_REVIEW, '2026-07-29T11:57:00.000Z'),
      ],
    })

    const result = await service.list(
      user,
      { cursor: 'previous-case', limit: 2 },
      new Date('2026-07-29T12:00:00.000Z'),
    )

    expect(list).toHaveBeenCalledWith({
      instructorId: user.id,
      courseId: undefined,
      cursor: 'previous-case',
      studentFlagReason: undefined,
      take: 3,
    })
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          reviewCaseId: 'case-3',
          age: 60,
          pending: true,
        }),
        expect.objectContaining({
          reviewCaseId: 'case-2',
          age: 120,
          pending: true,
        }),
      ],
      pendingCount: 7,
      nextCursor: 'case-2',
    })
    expect(Object.keys(result.items[0] ?? {})).toEqual([
      'reviewCaseId',
      'status',
      'trigger',
      'studentFlagReason',
      'createdAt',
      'age',
      'course',
      'student',
      'pending',
    ])
  })

  function record(id: string, status: ReviewStatus, createdAt: string) {
    return {
      id,
      status,
      trigger: ReviewTriggerType.STUDENT_REQUEST,
      studentFlagReason: StudentFlagReason.INCORRECT,
      createdAt: new Date(createdAt),
      course: { id: 'course-1', code: 'C1', title: 'Course One' },
      student: { id: 'student-1', displayName: 'Safe Student' },
    }
  }
})
