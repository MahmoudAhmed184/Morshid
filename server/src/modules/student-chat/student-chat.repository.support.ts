import { CourseMembershipRole, Prisma } from '../../generated/prisma/client'

export const chatSessionSelect = {
  id: true,
  courseId: true,
  title: true,
  lastSequence: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChatSessionSelect

export const chatMessageSelect = {
  id: true,
  sequence: true,
  role: true,
  authorUserId: true,
  responseToMessageId: true,
  content: true,
  status: true,
  requestKind: true,
  guidanceLabel: true,
  hintLevel: true,
  errorCode: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.MessageSelect

export function ownedActiveSessionWhere(
  courseId: string,
  sessionId: string,
  studentId: string,
): Prisma.ChatSessionWhereInput {
  return {
    id: sessionId,
    courseId,
    studentId,
    deletedAt: null,
  }
}

export function hasActiveStudentMembershipInTransaction(
  database: Pick<Prisma.TransactionClient, 'courseMembership'>,
  courseId: string,
  studentId: string,
): Promise<boolean> {
  return database.courseMembership
    .findFirst({
      where: {
        courseId,
        userId: studentId,
        role: CourseMembershipRole.STUDENT,
        removedAt: null,
      },
      select: {
        id: true,
      },
    })
    .then((membership) => membership !== null)
}

export async function currentDatabaseTime(
  database: Pick<Prisma.TransactionClient, '$queryRaw'>,
): Promise<Date> {
  const rows = await database.$queryRaw<{ now: Date }[]>`SELECT now() AS now`

  return rows[0].now
}
