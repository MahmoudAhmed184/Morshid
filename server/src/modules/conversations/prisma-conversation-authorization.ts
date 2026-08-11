import { Prisma } from '../../generated/prisma/client'
import { CourseMembershipRole } from '../courses/course-access.public'
import type {
  ConversationAuthorizationInput,
  ConversationAuthorizationResult,
  LockedConversationSession,
} from './conversation-authorization'

/**
 * Locks the authoritative session before its student membership. Every
 * conversation write that re-checks authorization must use this order so
 * membership removal and session deletion cannot race a response commit.
 */
export async function lockAuthorizedConversation(
  tx: Prisma.TransactionClient,
  input: ConversationAuthorizationInput,
): Promise<ConversationAuthorizationResult> {
  const sessions = await tx.$queryRaw<LockedConversationSession[]>(Prisma.sql`
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

export async function lockConversationSessionOwner(
  tx: Prisma.TransactionClient,
  input: ConversationAuthorizationInput,
): Promise<
  Extract<ConversationAuthorizationResult, { kind: 'ok' | 'session_not_found' }>
> {
  const sessions = await tx.$queryRaw<LockedConversationSession[]>(Prisma.sql`
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
