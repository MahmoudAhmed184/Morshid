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

export interface InstructorReviewAcceptanceFixture {
  instructorEmail: string
  otherInstructorEmail: string
  emptyInstructorEmail: string
  reviewCaseId: string
  otherReviewCaseId: string
  ownedCourseTitle: string
  otherCourseTitle: string
  studentLabel: string
  secrets: {
    studentEmail: string
    unrelatedPrevious: string
    unrelatedFollowing: string
    document: string
    storagePath: string
  }
  softDeleteOwnedSession(): Promise<void>
  dispose(): Promise<void>
}

export interface ReviewCleanupResult {
  removed: {
    notifications: number
    auditLogs: number
    idempotencyRecords: number
    evidenceSnapshots: number
    actions: number
    triggers: number
    cases: number
  }
  remaining: {
    notifications: number
    triggers: number
    cases: number
  }
}

export async function clearAllReviewData(
  client: Client,
): Promise<ReviewCleanupResult> {
  await client.query('BEGIN')
  try {
    const notifications = await client.query(
      'DELETE FROM notifications WHERE review_case_id IS NOT NULL',
    )
    const auditLogs = await client.query(
      `DELETE FROM audit_logs
       WHERE action LIKE 'review.%' OR target_type LIKE 'review_%'`,
    )
    const idempotencyRecords = await client.query(
      `DELETE FROM idempotency_records
       WHERE operation_scope IN (
         'review.create.manual', 'review.resolve', 'review.reject'
       )`,
    )
    const evidenceSnapshots = await client.query(
      'DELETE FROM review_evidence_snapshots',
    )
    const actions = await client.query('DELETE FROM review_actions')
    const triggers = await client.query('DELETE FROM review_triggers')
    const cases = await client.query('DELETE FROM review_cases')
    const verification = await client.query<{
      cases: string
      triggers: string
      notifications: string
    }>(
      `SELECT
         (SELECT COUNT(*) FROM review_cases)::text AS cases,
         (SELECT COUNT(*) FROM review_triggers)::text AS triggers,
         (SELECT COUNT(*) FROM notifications
          WHERE review_case_id IS NOT NULL)::text AS notifications`,
    )
    const row = verification.rows[0]
    const remaining = {
      cases: Number(row.cases),
      triggers: Number(row.triggers),
      notifications: Number(row.notifications),
    }
    if (Object.values(remaining).some((count) => count !== 0)) {
      throw new Error(
        `Review cleanup verification failed: ${JSON.stringify(remaining)}`,
      )
    }

    await client.query('COMMIT')
    return {
      removed: {
        notifications: notifications.rowCount ?? 0,
        auditLogs: auditLogs.rowCount ?? 0,
        idempotencyRecords: idempotencyRecords.rowCount ?? 0,
        evidenceSnapshots: evidenceSnapshots.rowCount ?? 0,
        actions: actions.rowCount ?? 0,
        triggers: triggers.rowCount ?? 0,
        cases: cases.rowCount ?? 0,
      },
      remaining,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function createInstructorReviewAcceptanceFixture(): Promise<InstructorReviewAcceptanceFixture> {
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  const suffix = randomUUID().slice(0, 8)
  const instructorEmail = `review-owner-${suffix}@morshid.test`
  const otherInstructorEmail = `review-other-${suffix}@morshid.test`
  const emptyInstructorEmail = `review-empty-${suffix}@morshid.test`
  const ownedCourseTitle = `Owned Review Course ${suffix}`
  const otherCourseTitle = `Private Other Course ${suffix}`
  const studentLabel = `Review Student ${suffix}`
  const studentEmail = `private-student-${suffix}@morshid.test`
  const ids = {
    instructor: randomUUID(),
    otherInstructor: randomUUID(),
    emptyInstructor: randomUUID(),
    student: randomUUID(),
    ownedCourse: randomUUID(),
    otherCourse: randomUUID(),
    ownedSession: randomUUID(),
    otherSession: randomUUID(),
    reviewCase: randomUUID(),
    otherReviewCase: randomUUID(),
    material: randomUUID(),
    chunk: randomUUID(),
  }
  const template = await client.query<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE email = 'instructor@morshid.demo'`,
  )
  const passwordHash = template.rows[0]?.password_hash
  if (!passwordHash) throw new Error('Demo Instructor is not seeded')

  for (const [id, email, displayName, role] of [
    [ids.instructor, instructorEmail, `Review Owner ${suffix}`, 'INSTRUCTOR'],
    [
      ids.otherInstructor,
      otherInstructorEmail,
      `Other Instructor ${suffix}`,
      'INSTRUCTOR',
    ],
    [
      ids.emptyInstructor,
      emptyInstructorEmail,
      `Empty Instructor ${suffix}`,
      'INSTRUCTOR',
    ],
    [ids.student, studentEmail, studentLabel, 'STUDENT'],
  ] as const) {
    await client.query(
      `INSERT INTO users (id, email, display_name, role, status, password_hash)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5)`,
      [id, email, displayName, role, passwordHash],
    )
  }

  const admin = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE email = 'admin@morshid.demo'`,
  )
  const adminId = admin.rows[0]?.id
  if (!adminId) throw new Error('Demo Admin is not seeded')

  await client.query(
    `INSERT INTO courses (id, code, title, created_by)
     VALUES ($1, $2, $3, $4), ($5, $6, $7, $4)`,
    [
      ids.ownedCourse,
      `OWN-${suffix}`,
      ownedCourseTitle,
      adminId,
      ids.otherCourse,
      `OTHER-${suffix}`,
      otherCourseTitle,
    ],
  )
  for (const [courseId, userId, role] of [
    [ids.ownedCourse, ids.instructor, 'INSTRUCTOR'],
    [ids.ownedCourse, ids.student, 'STUDENT'],
    [ids.otherCourse, ids.otherInstructor, 'INSTRUCTOR'],
    [ids.otherCourse, ids.student, 'STUDENT'],
  ] as const) {
    await client.query(
      `INSERT INTO course_memberships
        (id, course_id, user_id, role, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), courseId, userId, role, adminId],
    )
  }

  await client.query(
    `INSERT INTO chat_sessions
      (id, course_id, student_id, title, last_sequence)
     VALUES ($1, $2, $3, 'Bounded owned review', 8),
            ($4, $5, $3, 'Other Instructor review', 2)`,
    [
      ids.ownedSession,
      ids.ownedCourse,
      ids.student,
      ids.otherSession,
      ids.otherCourse,
    ],
  )

  const ownedMessages = [
    ['STUDENT', 'Previous bounded question'],
    ['ASSISTANT', 'Previous bounded answer'],
    ['STUDENT', 'Flagged acceptance question'],
    ['ASSISTANT', 'Flagged acceptance assistant response'],
    ['STUDENT', 'Following bounded question'],
    ['ASSISTANT', 'Following bounded answer'],
    ['STUDENT', `UNRELATED-PREVIOUS-${suffix}`],
    ['ASSISTANT', `UNRELATED-FOLLOWING-${suffix}`],
  ] as const
  const ownedMessageIds: string[] = []
  for (const [index, [role, content]] of ownedMessages.entries()) {
    const messageId = randomUUID()
    ownedMessageIds.push(messageId)
    await client.query(
      `INSERT INTO messages
        (id, session_id, sequence, role, author_user_id, response_to_message_id,
         content, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED', now())`,
      [
        messageId,
        ids.ownedSession,
        index + 1,
        role,
        role === 'STUDENT' ? ids.student : null,
        role === 'ASSISTANT' ? ownedMessageIds[index - 1] : null,
        content,
      ],
    )
  }

  const otherStudentMessage = randomUUID()
  const otherAssistantMessage = randomUUID()
  await client.query(
    `INSERT INTO messages
      (id, session_id, sequence, role, author_user_id, content, status, completed_at)
     VALUES ($1, $2, 1, 'STUDENT', $3, 'Other private question', 'COMPLETED', now())`,
    [otherStudentMessage, ids.otherSession, ids.student],
  )
  await client.query(
    `INSERT INTO messages
      (id, session_id, sequence, role, response_to_message_id, content, status, completed_at)
     VALUES ($1, $2, 2, 'ASSISTANT', $3, 'Other private answer', 'COMPLETED', now())`,
    [otherAssistantMessage, ids.otherSession, otherStudentMessage],
  )

  const documentSecret = `PRIVATE-DOCUMENT-${suffix}`
  const storagePathSecret = `PRIVATE-STORAGE-${suffix}.pdf`
  await client.query(
    `INSERT INTO materials
      (id, course_id, uploaded_by, title, original_filename, storage_path,
       status, extracted_text_length, chunk_count)
     VALUES ($1, $2, $3, 'Bounded review source', $4, $5, 'READY', 800, 1)`,
    [
      ids.material,
      ids.ownedCourse,
      ids.instructor,
      documentSecret,
      storagePathSecret,
    ],
  )
  await client.query(
    `INSERT INTO material_chunks
      (id, material_id, chunk_index, content, embedding, embedding_model)
     VALUES ($1, $2, 0, $3, $4::vector, 'acceptance-model')`,
    [
      ids.chunk,
      ids.material,
      `Bounded citation snippet ${'x'.repeat(520)} ${documentSecret}`,
      `[${Array.from({ length: 1_536 }, () => '0').join(',')}]`,
    ],
  )
  await client.query(
    `INSERT INTO message_citations (id, message_id, material_id, citation_order)
     VALUES ($1, $2, $3, 1)`,
    [randomUUID(), ownedMessageIds[3], ids.material],
  )
  await client.query(
    `INSERT INTO message_retrievals
      (id, message_id, chunk_id, rank, similarity_score)
     VALUES ($1, $2, $3, 1, 0.91)`,
    [randomUUID(), ownedMessageIds[3], ids.chunk],
  )

  for (const [reviewCaseId, messageId, courseId, note] of [
    [
      ids.reviewCase,
      ownedMessageIds[3],
      ids.ownedCourse,
      'Acceptance student note',
    ],
    [
      ids.otherReviewCase,
      otherAssistantMessage,
      ids.otherCourse,
      'Other private note',
    ],
  ] as const) {
    await client.query(
      `INSERT INTO review_cases
        (id, target_message_id, course_id, requested_by_user_id, status, created_at)
       VALUES ($1, $2, $3, $4, 'PENDING', now() - interval '5 minutes')`,
      [reviewCaseId, messageId, courseId, ids.student],
    )
    await client.query(
      `INSERT INTO review_triggers
        (id, review_case_id, type, actor_user_id, reason, created_at)
       VALUES ($1, $2, 'STUDENT_REQUEST', $3, $4, now() - interval '5 minutes')`,
      [randomUUID(), reviewCaseId, ids.student, note],
    )
  }

  return {
    instructorEmail,
    otherInstructorEmail,
    emptyInstructorEmail,
    reviewCaseId: ids.reviewCase,
    otherReviewCaseId: ids.otherReviewCase,
    ownedCourseTitle,
    otherCourseTitle,
    studentLabel,
    secrets: {
      studentEmail,
      unrelatedPrevious: ownedMessages[6][1],
      unrelatedFollowing: ownedMessages[7][1],
      document: documentSecret,
      storagePath: storagePathSecret,
    },
    async softDeleteOwnedSession() {
      await client.query(
        'UPDATE chat_sessions SET deleted_at = now() WHERE id = $1',
        [ids.ownedSession],
      )
    },
    async dispose() {
      await client.query(
        'DELETE FROM review_cases WHERE id = ANY($1::uuid[])',
        [[ids.reviewCase, ids.otherReviewCase]],
      )
      await client.query(
        'DELETE FROM messages WHERE session_id = ANY($1::uuid[])',
        [[ids.ownedSession, ids.otherSession]],
      )
      await client.query(
        'DELETE FROM chat_sessions WHERE id = ANY($1::uuid[])',
        [[ids.ownedSession, ids.otherSession]],
      )
      await client.query('DELETE FROM materials WHERE id = $1', [ids.material])
      await client.query(
        'DELETE FROM course_memberships WHERE course_id = ANY($1::uuid[])',
        [[ids.ownedCourse, ids.otherCourse]],
      )
      await client.query('DELETE FROM courses WHERE id = ANY($1::uuid[])', [
        [ids.ownedCourse, ids.otherCourse],
      ])
      await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
        [ids.instructor, ids.otherInstructor, ids.emptyInstructor, ids.student],
      ])
      await client.end()
    },
  }
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
    `DELETE FROM notifications
     WHERE review_case_id IN (
       SELECT id FROM review_cases WHERE requested_by_user_id = $1
     )`,
    [studentId],
  )
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
