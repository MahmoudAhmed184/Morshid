import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { Client } from 'pg'

import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

describe('solution protection migration backfill (e2e)', () => {
  let database: DisposableDatabase | undefined

  afterAll(async () => {
    await database?.dispose()
  })

  it('backfills authoritative tasks, accepted task history, concepts, and conservative unknowns', async () => {
    database = await setUpDisposableDatabase('morshid_protection_backfill', {
      applyMigrations: false,
    })
    const client = new Client({ connectionString: database.databaseUrl })
    await client.connect()

    try {
      await client.query(await migrationSql('20260811150000_initial'))
      const ids = await seedPreProtectionRows(client)
      await client.query(
        await migrationSql('20260815050000_add_solution_protection'),
      )

      const topics = await client.query<{
        id: string
        status: string
        source: string | null
      }>(`
        SELECT
          "id"::text,
          "solution_protection_status"::text AS "status",
          "solution_protection_source"::text AS "source"
        FROM "topics"
        ORDER BY "title"
      `)
      const byId = new Map(topics.rows.map((row) => [row.id, row]))

      expect(byId.get(ids.authoritativeProblemTopicId)).toMatchObject({
        status: 'PROTECTED',
        source: 'AUTHORITATIVE_TASK_METADATA',
      })
      expect(byId.get(ids.historicalTaskTopicId)).toMatchObject({
        status: 'PROTECTED',
        source: 'MIGRATED_TOPIC_HISTORY',
      })
      expect(byId.get(ids.conceptTopicId)).toMatchObject({
        status: 'UNPROTECTED',
        source: 'MIGRATED_CONCEPT_TOPIC',
      })
      expect(byId.get(ids.ambiguousTopicId)).toMatchObject({
        status: 'UNKNOWN',
        source: null,
      })
    } finally {
      await client.end()
    }
  })
})

async function migrationSql(directory: string): Promise<string> {
  return readFile(
    resolve(__dirname, `../../prisma/migrations/${directory}/migration.sql`),
    'utf8',
  )
}

async function seedPreProtectionRows(client: Client) {
  const universityId = randomUUID()
  const userId = randomUUID()
  const courseId = randomUUID()
  const sessionId = randomUUID()
  const authoritativeProblemTopicId = randomUUID()
  const historicalTaskTopicId = randomUUID()
  const conceptTopicId = randomUUID()
  const ambiguousTopicId = randomUUID()
  const attemptId = randomUUID()
  const messageId = randomUUID()

  await client.query(
    `INSERT INTO "universities" ("id", "name", "code")
     VALUES ($1, 'Backfill University', $2)`,
    [universityId, `BFU-${universityId.slice(0, 8)}`],
  )
  await client.query(
    `INSERT INTO "users" ("id", "email", "display_name", "role", "password_hash", "university_id")
     VALUES ($1, $2, 'Backfill Student', 'STUDENT', 'not-a-real-hash', $3)`,
    [userId, `backfill-${userId}@example.test`, universityId],
  )
  await client.query(
    `INSERT INTO "courses" ("id", "code", "title", "university_id")
     VALUES ($1, $2, 'Backfill Course', $3)`,
    [courseId, `BF-${courseId.slice(0, 8)}`, universityId],
  )
  await client.query(
    `INSERT INTO "course_memberships" ("course_id", "user_id", "role")
     VALUES ($1, $2, 'STUDENT')`,
    [courseId, userId],
  )
  await client.query(
    `INSERT INTO "chat_sessions" ("id", "course_id", "student_id", "title")
     VALUES ($1, $2, $3, 'Backfill Session')`,
    [sessionId, courseId, userId],
  )
  await client.query(
    `INSERT INTO "topics"
       ("id", "session_id", "course_id", "problem_id", "title", "topic_type", "status")
     VALUES
       ($1, $2, $3, $4, 'A authoritative problem', 'PROBLEM', 'PAUSED'),
       ($5, $2, $3, NULL, 'B historical task', 'UNCLASSIFIED', 'PAUSED'),
       ($6, $2, $3, NULL, 'C concept', 'CONCEPT', 'PAUSED'),
       ($7, $2, $3, NULL, 'D ambiguous', 'UNCLASSIFIED', 'ACTIVE')`,
    [
      authoritativeProblemTopicId,
      sessionId,
      courseId,
      randomUUID(),
      historicalTaskTopicId,
      conceptTopicId,
      ambiguousTopicId,
    ],
  )
  await client.query(
    `INSERT INTO "tutoring_attempts"
       ("id", "session_id", "topic_id", "client_message_id", "status")
     VALUES ($1, $2, $3, $4, 'FAILED')`,
    [attemptId, sessionId, historicalTaskTopicId, randomUUID()],
  )
  await client.query(
    `INSERT INTO "messages"
       ("id", "session_id", "attempt_id", "topic_id", "sequence", "role", "author_user_id", "content", "status")
     VALUES ($1, $2, $3, $4, 1, 'STUDENT', $5, 'Historical task prompt', 'COMPLETED')`,
    [messageId, sessionId, attemptId, historicalTaskTopicId, userId],
  )
  await client.query(
    `UPDATE "tutoring_attempts" SET "student_message_id" = $1 WHERE "id" = $2`,
    [messageId, attemptId],
  )
  await client.query(
    `INSERT INTO "educational_analyses" (
       "attempt_id", "topic_id", "student_message_id", "request_kind", "student_state",
       "effort_present", "effort_quality", "effort_addresses_previous_tutor_action",
       "effort_is_repeated", "learning_evidence_present", "learning_evidence_strength",
       "topic_relation", "recommended_strategy", "recommended_technique",
       "recommended_guidance_level", "confidence", "provider", "model",
       "prompt_version", "schema_version", "analysis_source"
     ) VALUES (
       $1, $2, $3, 'PROBLEM_LIKE', 'NO_PRIOR_KNOWLEDGE', false, 'NONE', false,
       false, false, 'NONE', 'CREATE_NEW_TOPIC', 'GUIDED_EXPLANATION',
       'ORIENTATION_QUESTION', 1, 0.9, 'migration-test', 'migration-test',
       'migration-test.v1', 'educational-analysis.v1', 'model'
     )`,
    [attemptId, historicalTaskTopicId, messageId],
  )

  return {
    authoritativeProblemTopicId,
    historicalTaskTopicId,
    conceptTopicId,
    ambiguousTopicId,
  }
}
