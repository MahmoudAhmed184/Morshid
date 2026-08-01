import {
  MessageRole,
  MessageStatus,
  ReviewStatus,
  ReviewTriggerType,
} from '../src/generated/prisma/client'
import { PrismaStudentReviewDetailRepository } from '../src/modules/reviews/student-review-detail.repository'
import { seedP0DemoData } from '../src/seeds/p0-demo.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

describe('Student review detail persistence (e2e)', () => {
  let database: DisposableDatabase | undefined
  let repository: PrismaStudentReviewDetailRepository
  let studentId: string
  let otherStudentId: string
  let reviewCaseId: string
  let sessionId: string

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_student_review_detail')
    const seeded = await seedP0DemoData(database.prisma)
    repository = new PrismaStudentReviewDetailRepository(database.prisma)

    const [student, otherStudent, course] = await Promise.all([
      database.prisma.user.findUniqueOrThrow({
        where: { email: 'student1@morshid.demo' },
      }),
      database.prisma.user.findUniqueOrThrow({
        where: { email: 'student2@morshid.demo' },
      }),
      Promise.resolve(seeded.courses.pythonProgramming),
    ])
    studentId = student.id
    otherStudentId = otherStudent.id

    const session = await database.prisma.chatSession.create({
      data: {
        courseId: course.id,
        studentId,
        title: 'Student review detail fixture',
      },
    })
    sessionId = session.id
    const message = await database.prisma.message.create({
      data: {
        sessionId,
        sequence: 1,
        role: MessageRole.ASSISTANT,
        content: 'Original guidance',
        status: MessageStatus.COMPLETED,
        completedAt: new Date(),
      },
    })
    const reviewCase = await database.prisma.reviewCase.create({
      data: {
        targetMessageId: message.id,
        courseId: course.id,
        requestedByUserId: studentId,
        status: ReviewStatus.PENDING,
        triggers: {
          create: {
            type: ReviewTriggerType.STUDENT_REQUEST,
            actorUserId: studentId,
            reason: 'Please review',
          },
        },
        actions: {
          create: {
            actorUserId: studentId,
            actionType: 'CREATED',
            toStatus: ReviewStatus.PENDING,
            caseVersion: 1,
            operationId: randomUUID(),
          },
        },
      },
    })
    reviewCaseId = reviewCase.id
  })

  afterAll(async () => database?.dispose(), 15_000)

  it('loads only the Student-safe selected review fields for the owner', async () => {
    const record = await repository.findOwned(studentId, reviewCaseId)

    expect(record).toMatchObject({
      id: reviewCaseId,
      status: ReviewStatus.PENDING,
      outcome: null,
      publishedContent: null,
      resolutionReason: null,
      targetMessage: { session: { id: sessionId } },
    })
    expect(record).not.toHaveProperty('resolvedByUserId')
    expect(record).not.toHaveProperty('evidence')
    expect(record).not.toHaveProperty('actions')
    expect(record?.targetMessage).not.toHaveProperty('content')
  })

  it('conceals the review from another Student', async () => {
    await expect(
      repository.findOwned(otherStudentId, reviewCaseId),
    ).resolves.toBeNull()
  })

  it('conceals a review whose chat session was deleted', async () => {
    const prisma = requireDatabase().prisma
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { deletedAt: new Date() },
    })
    await expect(
      repository.findOwned(studentId, reviewCaseId),
    ).resolves.toBeNull()
  })

  function requireDatabase(): DisposableDatabase {
    if (database === undefined) throw new Error('Database was not initialized')
    return database
  }
})
import { randomUUID } from 'node:crypto'
