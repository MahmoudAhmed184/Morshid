import { CourseMembershipRole, Prisma } from '../../generated/prisma/client'

export interface AuthorizedStudentChatInput {
  courseId: string
  sessionId: string
  studentId: string
}

export interface LockedStudentChatSession {
  id: string
  courseId: string
  studentId: string
  lastSequence: number
  deletedAt: Date | null
}

export type LockedStudentChatAuthorizationResult =
  | { kind: 'ok'; session: LockedStudentChatSession }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }

/**
 * Locks the authoritative session before its student membership. Every
 * student-chat write that re-checks authorization must use this order so
 * membership removal and session deletion cannot race a response commit.
 */
export async function lockAuthorizedStudentChat(
  tx: Prisma.TransactionClient,
  input: AuthorizedStudentChatInput,
): Promise<LockedStudentChatAuthorizationResult> {
  const sessions = await tx.$queryRaw<LockedStudentChatSession[]>(Prisma.sql`
    SELECT
      id,
      course_id AS "courseId",
      student_id AS "studentId",
      last_sequence AS "lastSequence",
      deleted_at AS "deletedAt"
    FROM chat_sessions
    WHERE id = ${input.sessionId}::uuid
    FOR UPDATE
  `)
  const session = sessions.at(0)
  if (session?.courseId !== input.courseId || session.deletedAt !== null) {
    return { kind: 'session_not_found' }
  }

  const memberships = await tx.$queryRaw<
    { role: CourseMembershipRole; removedAt: Date | null }[]
  >(Prisma.sql`
    SELECT
      role,
      removed_at AS "removedAt"
    FROM course_memberships
    WHERE course_id = ${session.courseId}::uuid
      AND user_id = ${input.studentId}::uuid
    FOR UPDATE
  `)
  const membership = memberships.at(0)
  if (
    membership?.role !== CourseMembershipRole.STUDENT ||
    membership.removedAt !== null
  ) {
    return { kind: 'membership_missing' }
  }

  if (session.studentId !== input.studentId) {
    return { kind: 'session_not_found' }
  }

  return { kind: 'ok', session }
}

export async function lockStudentOwnedChat(
  tx: Prisma.TransactionClient,
  input: AuthorizedStudentChatInput,
): Promise<
  Extract<
    LockedStudentChatAuthorizationResult,
    { kind: 'ok' | 'session_not_found' }
  >
> {
  const sessions = await tx.$queryRaw<LockedStudentChatSession[]>(Prisma.sql`
    SELECT
      id,
      course_id AS "courseId",
      student_id AS "studentId",
      last_sequence AS "lastSequence",
      deleted_at AS "deletedAt"
    FROM chat_sessions
    WHERE id = ${input.sessionId}::uuid
      AND course_id = ${input.courseId}::uuid
      AND student_id = ${input.studentId}::uuid
    FOR UPDATE
  `)
  const session = sessions.at(0)
  if (session === undefined) {
    return { kind: 'session_not_found' }
  }
  return { kind: 'ok', session }
}
