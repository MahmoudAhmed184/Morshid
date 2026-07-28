import { randomUUID } from 'node:crypto'

import { Client } from 'pg'

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://morshid:morshid_local_password@localhost:5432/morshid'

export interface ReviewBrowserFixture {
  courseId: string
  sessionId: string
  messageIds: string[]
  dispose(): Promise<void>
  countCases(): Promise<number>
}

export async function createReviewBrowserFixture(
  email: string,
): Promise<ReviewBrowserFixture> {
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  const sessionId = randomUUID()
  const user = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [email],
  )
  const course = await client.query<{ id: string }>(
    `SELECT c.id FROM courses c
     JOIN course_memberships cm ON cm.course_id = c.id
     WHERE cm.user_id = $1 AND cm.removed_at IS NULL
     ORDER BY c.created_at LIMIT 1`,
    [user.rows[0]?.id],
  )
  const studentId = user.rows[0]?.id
  const courseId = course.rows[0]?.id
  if (!studentId || !courseId)
    throw new Error('Review test Student is not seeded')

  await clearStudentReviews(client, studentId)
  await client.query(
    `INSERT INTO chat_sessions
      (id, course_id, student_id, title, last_sequence)
     VALUES ($1, $2, $3, $4, 8)`,
    [sessionId, courseId, studentId, 'Review request acceptance'],
  )
  const messageIds: string[] = []
  for (let index = 0; index < 4; index += 1) {
    const studentMessageId = randomUUID()
    const assistantMessageId = randomUUID()
    messageIds.push(assistantMessageId)
    await client.query(
      `INSERT INTO messages
        (id, session_id, sequence, role, author_user_id, content, status, completed_at)
       VALUES ($1, $2, $3, 'STUDENT', $4, $5, 'COMPLETED', now())`,
      [
        studentMessageId,
        sessionId,
        index * 2 + 1,
        studentId,
        `Question ${String(index + 1)}`,
      ],
    )
    await client.query(
      `INSERT INTO messages
        (id, session_id, sequence, role, response_to_message_id, content, status, completed_at)
       VALUES ($1, $2, $3, 'ASSISTANT', $4, $5, 'COMPLETED', now())`,
      [
        assistantMessageId,
        sessionId,
        index * 2 + 2,
        studentMessageId,
        `Eligible review response ${String(index + 1)}`,
      ],
    )
  }

  return {
    courseId,
    sessionId,
    messageIds,
    async countCases() {
      const result = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM review_cases
         WHERE requested_by_user_id = $1`,
        [studentId],
      )
      return Number(result.rows[0]?.count ?? 0)
    },
    async dispose() {
      await clearStudentReviews(client, studentId)
      await client.query('DELETE FROM messages WHERE session_id = $1', [
        sessionId,
      ])
      await client.query('DELETE FROM chat_sessions WHERE id = $1', [sessionId])
      await client.end()
    },
  }
}

async function clearStudentReviews(client: Client, studentId: string) {
  await client.query(
    `DELETE FROM idempotency_records
     WHERE actor_user_id = $1 AND operation_scope = 'review.create.manual'`,
    [studentId],
  )
  await client.query(
    'DELETE FROM review_cases WHERE requested_by_user_id = $1',
    [studentId],
  )
}
