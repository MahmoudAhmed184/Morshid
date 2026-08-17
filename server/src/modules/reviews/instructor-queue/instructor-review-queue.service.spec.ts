import { UserRole, UserStatus } from '../../identity/identity.roles'
import {
  ReviewStatus,
  ReviewTriggerType,
  StudentFlagReason,
} from '../interface/review-values'
import type { AuthenticatedUser } from '../../identity/identity.types'
import { InstructorReviewQueueService } from './instructor-review-queue.service'

describe('InstructorReviewQueueService', () => {
  const user: AuthenticatedUser = {
    id: 'instructor-1',
    email: 'instructor@example.test',
    displayName: 'Instructor',
    role: UserRole.INSTRUCTOR,
    status: UserStatus.ACTIVE,
  }
  const canManageCourse = jest.fn()
  const list = jest.fn()
  const getWorkloadSummary = jest.fn()
  const service = new InstructorReviewQueueService(
    {
      list,
      getWorkloadSummary,
    },
    { canManageCourse } as never,
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('conceals missing and other-Instructor courses with the same not-found error', async () => {
    canManageCourse.mockResolvedValue(false)

    await expect(
      service.list(user, { courseId: 'course-x', limit: 25 }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'REVIEW_NOT_FOUND' },
    })
    expect(list).not.toHaveBeenCalled()
  })

  it('returns a stable page, safe queue fields, age, pending state, and count', async () => {
    canManageCourse.mockResolvedValue(true)
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
          trigger: ReviewTriggerType.STUDENT_REQUEST,
          triggers: [ReviewTriggerType.STUDENT_REQUEST],
          studentFlagReason: StudentFlagReason.INCORRECT,
          studentNote: 'Please verify this answer',
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
      'triggers',
      'studentFlagReason',
      'studentNote',
      'createdAt',
      'age',
      'course',
      'student',
      'pending',
    ])
  })

  it('rejects workload summary for unauthorized courses with not-found error', async () => {
    canManageCourse.mockResolvedValue(false)

    await expect(
      service.getWorkloadSummary(user, { courseId: 'unassigned-course' }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'REVIEW_NOT_FOUND' },
    })
  })

  it('computes workload summary, age calculation, and reason breakdowns', async () => {
    canManageCourse.mockResolvedValue(true)
    const oldestPendingDate = new Date('2026-07-29T11:50:00.000Z')
    getWorkloadSummary.mockResolvedValue({
      pendingCount: 4,
      inReviewCount: 2,
      claimedByMeCount: 1,
      totalActiveCount: 6,
      oldestPendingCreatedAt: oldestPendingDate,
      byStudentFlagReason: [
        { reason: StudentFlagReason.INCORRECT, count: 3 },
        { reason: StudentFlagReason.CONFUSING, count: 1 },
      ],
      byTriggerType: [
        { trigger: ReviewTriggerType.STUDENT_REQUEST, count: 4 },
        { trigger: ReviewTriggerType.CITATION_MISSING, count: 2 },
      ],
    })

    const summary = await service.getWorkloadSummary(
      user,
      { courseId: 'course-1' },
      new Date('2026-07-29T12:00:00.000Z'),
    )

    expect(getWorkloadSummary).toHaveBeenCalledWith({
      instructorId: user.id,
      courseId: 'course-1',
    })
    expect(summary).toEqual({
      pendingCount: 4,
      inReviewCount: 2,
      claimedByMeCount: 1,
      totalActiveCount: 6,
      oldestPendingCreatedAt: oldestPendingDate.toISOString(),
      oldestPendingAge: 600,
      byStudentFlagReason: [
        { reason: StudentFlagReason.INCORRECT, count: 3 },
        { reason: StudentFlagReason.CONFUSING, count: 1 },
      ],
      byTriggerType: [
        { trigger: ReviewTriggerType.STUDENT_REQUEST, count: 4 },
        { trigger: ReviewTriggerType.CITATION_MISSING, count: 2 },
      ],
    })
  })

  it('returns null oldestPendingCreatedAt and oldestPendingAge when no pending cases exist', async () => {
    canManageCourse.mockResolvedValue(true)
    getWorkloadSummary.mockResolvedValue({
      pendingCount: 0,
      inReviewCount: 0,
      claimedByMeCount: 0,
      totalActiveCount: 0,
      oldestPendingCreatedAt: null,
      byStudentFlagReason: [],
      byTriggerType: [],
    })

    const summary = await service.getWorkloadSummary(user, {})
    expect(summary.oldestPendingCreatedAt).toBeNull()
    expect(summary.oldestPendingAge).toBeNull()
    expect(summary.totalActiveCount).toBe(0)
  })

  function record(id: string, status: ReviewStatus, createdAt: string) {
    return {
      id,
      status,
      trigger: ReviewTriggerType.STUDENT_REQUEST,
      triggers: [ReviewTriggerType.STUDENT_REQUEST],
      studentFlagReason: StudentFlagReason.INCORRECT,
      studentNote: 'Please verify this answer',
      createdAt: new Date(createdAt),
      course: { id: 'course-1', code: 'C1', title: 'Course One' },
      student: { id: 'student-1', displayName: 'Safe Student' },
    }
  }
})
