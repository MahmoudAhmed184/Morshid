import { randomUUID } from 'node:crypto'

import { PrismaStudentReviewInboxRepository } from '../../src/modules/reviews/student-inbox/student-review-inbox.repository'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

describe('Student review inbox persistence (e2e)', () => {
  let database: DisposableDatabase | undefined
  let repository: PrismaStudentReviewInboxRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue139_review_inbox')
    repository = new PrismaStudentReviewInboxRepository(
      requireDatabase().prisma,
    )
  })

  afterAll(async () => database?.dispose())

  it('lists and counts only the authenticated recipient review inbox items', async () => {
    const first = await createInboxItem('REVIEW_RESOLVED')
    const second = await createInboxItem('REVIEW_REJECTED')
    await createInboxItem('REVIEW_RESOLVED')

    const page = await repository.list(first.studentId, undefined, 25)

    expect(page.records).toHaveLength(1)
    expect(page.records[0]).toMatchObject({
      id: first.inboxItemId,
      reviewCaseId: first.reviewCaseId,
      courseId: first.courseId,
      messageId: first.assistantMessageId,
      sessionId: first.sessionId,
      status: 'UNREAD',
      type: 'REVIEW_RESOLVED',
    })
    await expect(repository.countUnread(first.studentId)).resolves.toBe(1)
    await expect(repository.countUnread(second.studentId)).resolves.toBe(1)
  })

  it('marks a review inbox item read idempotently and preserves the first readAt', async () => {
    const fixture = await createInboxItem('REVIEW_RESOLVED')

    const first = await repository.markRead(
      fixture.studentId,
      fixture.inboxItemId,
    )
    const second = await repository.markRead(
      fixture.studentId,
      fixture.inboxItemId,
    )

    expect(first).toMatchObject({ status: 'READ' })
    expect(first?.readAt).toBeInstanceOf(Date)
    expect(second?.readAt).toEqual(first?.readAt)
    await expect(repository.countUnread(fixture.studentId)).resolves.toBe(0)
  })

  it('keeps the current read states and direct navigation identifiers in the list', async () => {
    const fixture = await createInboxItem('REVIEW_RESOLVED')
    await requireDatabase().prisma.reviewInboxItem.update({
      where: { id: fixture.inboxItemId },
      data: { status: 'READ', readAt: new Date() },
    })

    await expect(
      repository.list(fixture.studentId, undefined, 25),
    ).resolves.toMatchObject({
      records: [
        expect.objectContaining({
          courseId: fixture.courseId,
          sessionId: fixture.sessionId,
          messageId: fixture.assistantMessageId,
          status: 'READ',
        }),
      ],
      nextCursor: null,
    })
  })

  it('conceals another recipient review inbox item', async () => {
    const owner = await createInboxItem('REVIEW_REJECTED')
    const other = await createInboxItem('REVIEW_RESOLVED')

    await expect(
      repository.markRead(other.studentId, owner.inboxItemId),
    ).resolves.toBeNull()
    expect(
      await requireDatabase().prisma.reviewInboxItem.findUniqueOrThrow({
        where: { id: owner.inboxItemId },
        select: { status: true, readAt: true },
      }),
    ).toEqual({ status: 'UNREAD', readAt: null })
  })

  async function createInboxItem(type: 'REVIEW_RESOLVED' | 'REVIEW_REJECTED') {
    const prisma = requireDatabase().prisma
    const university = await prisma.university.upsert({
      where: { code: 'TEST-REVIEW-INBOX-UNIV' },
      update: {},
      create: {
        name: 'Test Review Inbox University',
        code: 'TEST-REVIEW-INBOX-UNIV',
        status: 'ACTIVE',
      },
    })
    const studentId = randomUUID()
    const courseId = randomUUID()
    const sessionId = randomUUID()
    const studentMessageId = randomUUID()
    const assistantMessageId = randomUUID()
    await prisma.user.create({
      data: {
        id: studentId,
        email: `${studentId}@review-inbox.test`,
        displayName: 'Student',
        role: 'STUDENT',
        universityId: university.id,
        passwordHash: 'hash',
      },
    })
    await prisma.course.create({
      data: {
        id: courseId,
        code: `RIN-${courseId.slice(0, 8)}`,
        title: 'Review inbox course',
        universityId: university.id,
        createdById: studentId,
      },
    })
    await prisma.courseMembership.create({
      data: { courseId, userId: studentId, role: 'STUDENT' },
    })
    await prisma.chatSession.create({
      data: {
        id: sessionId,
        courseId,
        studentId,
        title: 'Review inbox session',
        lastSequence: 2,
      },
    })
    await prisma.message.createMany({
      data: [
        {
          id: studentMessageId,
          sessionId,
          sequence: 1,
          role: 'STUDENT',
          authorUserId: studentId,
          content: 'Question',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        {
          id: assistantMessageId,
          sessionId,
          sequence: 2,
          role: 'ASSISTANT',
          responseToMessageId: studentMessageId,
          content: 'Answer',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      ],
    })
    const reviewCase = await prisma.reviewCase.create({
      data: {
        targetMessageId: assistantMessageId,
        courseId,
        requestedByUserId: studentId,
      },
    })
    const inboxItem = await prisma.reviewInboxItem.create({
      data: {
        recipientUserId: studentId,
        reviewCaseId: reviewCase.id,
        courseId,
        sessionId,
        messageId: assistantMessageId,
        type,
      },
    })
    return {
      studentId,
      courseId,
      sessionId,
      assistantMessageId,
      reviewCaseId: reviewCase.id,
      inboxItemId: inboxItem.id,
    }
  }

  function requireDatabase() {
    if (database === undefined) throw new Error('Database is not initialized')
    return database
  }
})
