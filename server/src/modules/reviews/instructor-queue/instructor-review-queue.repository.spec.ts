import { CourseMembershipRole } from '../../courses/interface/course-membership-role'
import {
  ReviewStatus,
  ReviewTriggerType,
  StudentFlagReason,
} from '../interface/review-values'
import type { PrismaService } from '../../../platform/database/prisma.service'
import { PrismaInstructorReviewQueueRepository } from './instructor-review-queue.repository'

describe('PrismaInstructorReviewQueueRepository', () => {
  const findMany = jest.fn()
  const findFirst = jest.fn()
  const count = jest.fn()
  const transaction = jest.fn((operations: unknown[]) =>
    Promise.all(operations),
  )
  const repository = new PrismaInstructorReviewQueueRepository({
    reviewCase: { findMany, findFirst, count },
    $transaction: transaction,
  } as unknown as PrismaService)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('includes an Admin-created course assigned to the Instructor', async () => {
    findMany.mockResolvedValue([])
    count.mockResolvedValue(3)

    await expect(
      repository.list({
        instructorId: 'instructor-1',
        courseId: 'course-1',
        take: 26,
      }),
    ).resolves.toEqual({ records: [], pendingCount: 3 })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          targetMessage: { session: { deletedAt: null } },
          course: {
            id: 'course-1',
            memberships: {
              some: {
                userId: 'instructor-1',
                role: CourseMembershipRole.INSTRUCTOR,
                removedAt: null,
              },
            },
          },
        },
      }),
    )
    expect(count).toHaveBeenCalledWith({
      where: {
        targetMessage: { session: { deletedAt: null } },
        course: {
          id: 'course-1',
          memberships: {
            some: {
              userId: 'instructor-1',
              role: CourseMembershipRole.INSTRUCTOR,
              removedAt: null,
            },
          },
        },
        status: ReviewStatus.PENDING,
      },
    })
  })

  it('uses pending-first deterministic ordering and a stable cursor', async () => {
    findMany.mockResolvedValue([
      {
        id: 'case-1',
        status: ReviewStatus.PENDING,
        createdAt: new Date('2026-07-28T12:00:00.000Z'),
        course: { id: 'course-1', code: 'C1', title: 'Course' },
        targetMessage: {
          session: { student: { id: 'student-1', displayName: 'Student' } },
        },
        triggers: [
          {
            type: ReviewTriggerType.STUDENT_REQUEST,
            studentFlagReason: 'INCORRECT',
            reason: 'Please verify this answer',
          },
        ],
      },
    ])
    count.mockResolvedValue(1)

    await expect(
      repository.list({
        instructorId: 'instructor-1',
        cursor: 'case-0',
        take: 26,
      }),
    ).resolves.toMatchObject({
      records: [
        {
          trigger: ReviewTriggerType.STUDENT_REQUEST,
          triggers: [ReviewTriggerType.STUDENT_REQUEST],
          studentFlagReason: StudentFlagReason.INCORRECT,
          studentNote: 'Please verify this answer',
        },
      ],
    })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        cursor: { id: 'case-0' },
        skip: 1,
        take: 26,
      }),
    )
  })

  it.each(Object.values(StudentFlagReason))(
    'filters and paginates %s through Student requests only',
    async (studentFlagReason) => {
      findMany.mockResolvedValue([])
      count.mockResolvedValue(0)

      await repository.list({
        instructorId: 'instructor-1',
        cursor: 'case-0',
        studentFlagReason,
        take: 26,
      })

      const filteredWhere = {
        targetMessage: { session: { deletedAt: null } },
        course: {
          memberships: {
            some: {
              userId: 'instructor-1',
              role: CourseMembershipRole.INSTRUCTOR,
              removedAt: null,
            },
          },
        },
        triggers: {
          some: {
            type: ReviewTriggerType.STUDENT_REQUEST,
            studentFlagReason,
          },
        },
      }
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: filteredWhere,
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
          cursor: { id: 'case-0' },
          skip: 1,
          take: 26,
        }),
      )
      expect(count).toHaveBeenCalledWith({
        where: { ...filteredWhere, status: ReviewStatus.PENDING },
      })
    },
  )

  it('aggregates workload summary metrics in a single atomic transaction', async () => {
    const oldestDate = new Date('2026-07-28T09:00:00.000Z')
    count
      .mockResolvedValueOnce(3) // pendingCount
      .mockResolvedValueOnce(2) // inReviewCount
      .mockResolvedValueOnce(1) // claimedByMeCount
    findFirst.mockResolvedValueOnce({ createdAt: oldestDate })
    findMany.mockResolvedValueOnce([
      {
        id: 'case-1',
        triggers: [
          {
            type: ReviewTriggerType.STUDENT_REQUEST,
            studentFlagReason: StudentFlagReason.INCORRECT,
          },
        ],
      },
      {
        id: 'case-2',
        triggers: [
          {
            type: ReviewTriggerType.STUDENT_REQUEST,
            studentFlagReason: StudentFlagReason.CONFUSING,
          },
          {
            type: ReviewTriggerType.CITATION_MISSING,
            studentFlagReason: null,
          },
        ],
      },
      {
        id: 'case-3',
        triggers: [
          {
            type: ReviewTriggerType.STUDENT_REQUEST,
            studentFlagReason: StudentFlagReason.INCORRECT,
          },
          {
            type: ReviewTriggerType.SOURCE_CONFLICT,
            studentFlagReason: null,
          },
        ],
      },
    ])

    const summary = await repository.getWorkloadSummary({
      instructorId: 'instructor-1',
      courseId: 'course-1',
    })

    expect(summary.pendingCount).toBe(3)
    expect(summary.inReviewCount).toBe(2)
    expect(summary.claimedByMeCount).toBe(1)
    expect(summary.totalActiveCount).toBe(5)
    expect(summary.oldestPendingCreatedAt).toEqual(oldestDate)

    const incorrectReason = summary.byStudentFlagReason.find(
      (r) => r.reason === StudentFlagReason.INCORRECT,
    )
    const confusingReason = summary.byStudentFlagReason.find(
      (r) => r.reason === StudentFlagReason.CONFUSING,
    )
    const unhelpfulReason = summary.byStudentFlagReason.find(
      (r) => r.reason === StudentFlagReason.UNHELPFUL,
    )
    expect(incorrectReason?.count).toBe(2)
    expect(confusingReason?.count).toBe(1)
    expect(unhelpfulReason?.count).toBe(0)

    const studentRequestTrigger = summary.byTriggerType.find(
      (t) => t.trigger === ReviewTriggerType.STUDENT_REQUEST,
    )
    const citationTrigger = summary.byTriggerType.find(
      (t) => t.trigger === ReviewTriggerType.CITATION_MISSING,
    )
    const conflictTrigger = summary.byTriggerType.find(
      (t) => t.trigger === ReviewTriggerType.SOURCE_CONFLICT,
    )
    const policyTrigger = summary.byTriggerType.find(
      (t) => t.trigger === ReviewTriggerType.POLICY_CHECK_FAILED,
    )
    expect(studentRequestTrigger?.count).toBe(3)
    expect(citationTrigger?.count).toBe(1)
    expect(conflictTrigger?.count).toBe(1)
    expect(policyTrigger?.count).toBe(0)
  })
})
