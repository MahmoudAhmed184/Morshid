import {
  CourseMembershipRole,
  ReviewStatus,
  ReviewTriggerType,
  StudentFlagReason,
} from '../../generated/prisma/client'
import type { PrismaService } from '../prisma/prisma.service'
import { PrismaInstructorReviewQueueRepository } from './instructor-review-queue.repository'

describe('PrismaInstructorReviewQueueRepository', () => {
  const findMany = jest.fn()
  const count = jest.fn()
  const findFirst = jest.fn()
  const transaction = jest.fn((operations: unknown[]) =>
    Promise.all(operations),
  )
  const repository = new PrismaInstructorReviewQueueRepository({
    reviewCase: { findMany, count },
    course: { findFirst },
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

  it('authorizes a requested course only through an active Instructor assignment', async () => {
    findFirst.mockResolvedValue(null)

    await expect(
      repository.isOwnedCourse('instructor-1', 'unavailable-course'),
    ).resolves.toBe(false)
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'unavailable-course',
        memberships: {
          some: {
            userId: 'instructor-1',
            role: CourseMembershipRole.INSTRUCTOR,
            removedAt: null,
          },
        },
      },
      select: { id: true },
    })
  })
})
