import { randomUUID } from 'node:crypto'

import { PrismaNotificationsRepository } from '../src/modules/notifications/notifications.repository'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

describe('Notifications persistence (e2e)', () => {
  let database: DisposableDatabase | undefined
  let repository: PrismaNotificationsRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue139_notifications')
    repository = new PrismaNotificationsRepository(requireDatabase().prisma)
  })

  afterAll(async () => database?.dispose())

  it('lists and counts only the authenticated recipient notifications', async () => {
    const first = await createNotification('REVIEW_RESOLVED')
    const second = await createNotification('REVIEW_REJECTED')
    await createNotification('REVIEW_RESOLVED')

    const page = await repository.list(first.studentId, undefined, 25)

    expect(page.records).toHaveLength(1)
    expect(page.records[0]).toMatchObject({
      id: first.notificationId,
      reviewCaseId: first.reviewCaseId,
      messageId: first.assistantMessageId,
      sessionId: first.sessionId,
      status: 'UNREAD',
      type: 'REVIEW_RESOLVED',
    })
    await expect(repository.countUnread(first.studentId)).resolves.toBe(1)
    await expect(repository.countUnread(second.studentId)).resolves.toBe(1)
  })

  it('marks a notification read idempotently and preserves the first readAt', async () => {
    const fixture = await createNotification('REVIEW_RESOLVED')

    const first = await repository.markRead(
      fixture.studentId,
      fixture.notificationId,
    )
    const second = await repository.markRead(
      fixture.studentId,
      fixture.notificationId,
    )

    expect(first).toMatchObject({ status: 'READ' })
    expect(first?.readAt).toBeInstanceOf(Date)
    expect(second?.readAt).toEqual(first?.readAt)
    await expect(repository.countUnread(fixture.studentId)).resolves.toBe(0)
  })

  it('excludes dismissed notifications from the active list', async () => {
    const fixture = await createNotification('REVIEW_RESOLVED')
    await requireDatabase().prisma.notification.update({
      where: { id: fixture.notificationId },
      data: { status: 'DISMISSED', dismissedAt: new Date() },
    })

    await expect(
      repository.list(fixture.studentId, undefined, 25),
    ).resolves.toEqual({ records: [], nextCursor: null })
  })

  it('conceals another recipient notification', async () => {
    const owner = await createNotification('REVIEW_REJECTED')
    const other = await createNotification('REVIEW_RESOLVED')

    await expect(
      repository.markRead(other.studentId, owner.notificationId),
    ).resolves.toBeNull()
    expect(
      await requireDatabase().prisma.notification.findUniqueOrThrow({
        where: { id: owner.notificationId },
        select: { status: true, readAt: true },
      }),
    ).toEqual({ status: 'UNREAD', readAt: null })
  })

  async function createNotification(
    type: 'REVIEW_RESOLVED' | 'REVIEW_REJECTED',
  ) {
    const prisma = requireDatabase().prisma
    const studentId = randomUUID()
    const courseId = randomUUID()
    const sessionId = randomUUID()
    const studentMessageId = randomUUID()
    const assistantMessageId = randomUUID()
    await prisma.user.create({
      data: {
        id: studentId,
        email: `${studentId}@notification.test`,
        displayName: 'Student',
        role: 'STUDENT',
        passwordHash: 'hash',
      },
    })
    await prisma.course.create({
      data: {
        id: courseId,
        code: `NOT-${courseId.slice(0, 8)}`,
        title: 'Notification course',
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
        title: 'Notification session',
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
    const notification = await prisma.notification.create({
      data: {
        recipientUserId: studentId,
        reviewCaseId: reviewCase.id,
        type,
        metadata: { messageId: assistantMessageId, sessionId },
      },
    })
    return {
      studentId,
      sessionId,
      assistantMessageId,
      reviewCaseId: reviewCase.id,
      notificationId: notification.id,
    }
  }

  function requireDatabase() {
    if (database === undefined) throw new Error('Database is not initialized')
    return database
  }
})
