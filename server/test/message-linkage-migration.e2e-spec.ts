import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { Client } from 'pg'

import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

const PRE_LINKAGE_MIGRATION = '20260803125913_add_socratic_tutor_persistence'
const LINKAGE_MIGRATION =
  '20260803190200_link_messages_to_tutor_turns_and_topics'

describe('Message linkage migration compatibility (e2e)', () => {
  it('applies over existing messages and leaves historical linkage columns null', async () => {
    let compatibilityDatabase: DisposableDatabase | undefined
    try {
      compatibilityDatabase = await setUpDisposableDatabase(
        'morshid_issue167_compat',
        { throughMigration: PRE_LINKAGE_MIGRATION },
      )
      const client = new Client({
        connectionString: compatibilityDatabase.databaseUrl,
      })
      await client.connect()

      try {
        const historical = await seedHistoricalMessage(client)
        const migrationSql = await readFile(
          join(
            process.cwd(),
            'prisma',
            'migrations',
            LINKAGE_MIGRATION,
            'migration.sql',
          ),
          'utf8',
        )

        await client.query(migrationSql)

        const columns = await client.query<{ column_name: string }>(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'messages'
            AND column_name IN ('turn_id', 'topic_id')
          ORDER BY column_name
        `)
        const indexes = await client.query<{ indexname: string }>(`
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = current_schema()
            AND indexname IN ('idx_messages_turn', 'idx_messages_topic')
          ORDER BY indexname
        `)
        const message =
          await compatibilityDatabase.prisma.message.findUniqueOrThrow({
            where: { id: historical.messageId },
            select: {
              content: true,
              turnId: true,
              topicId: true,
            },
          })

        expect(columns.rows.map(({ column_name }) => column_name)).toEqual([
          'topic_id',
          'turn_id',
        ])
        expect(indexes.rows.map(({ indexname }) => indexname)).toEqual([
          'idx_messages_topic',
          'idx_messages_turn',
        ])
        expect(message).toEqual({
          content: 'Historical question',
          turnId: null,
          topicId: null,
        })
      } finally {
        await client.end()
      }
    } finally {
      await compatibilityDatabase?.dispose()
    }
  })
})

async function seedHistoricalMessage(
  client: Client,
): Promise<{ messageId: string }> {
  const userId = randomUUID()
  const courseId = randomUUID()
  const sessionId = randomUUID()
  const messageId = randomUUID()
  await client.query(
    `
      INSERT INTO users (id, email, display_name, role, status, password_hash)
      VALUES ($1::uuid, $2, 'Historical student', 'STUDENT', 'ACTIVE', 'hash')
    `,
    [userId, `historical-${randomUUID()}@morshid.test`],
  )
  await client.query(
    `
      INSERT INTO courses (id, code, title, created_by)
      VALUES ($1::uuid, $2, 'Historical course', $3::uuid)
    `,
    [courseId, `HIST-${randomUUID().slice(0, 24)}`, userId],
  )
  await client.query(
    `
      INSERT INTO course_memberships (course_id, user_id, role, created_by)
      VALUES ($1::uuid, $2::uuid, 'STUDENT', $2::uuid)
    `,
    [courseId, userId],
  )
  await client.query(
    `
      INSERT INTO chat_sessions (id, course_id, student_id, title, last_sequence)
      VALUES ($1::uuid, $2::uuid, $3::uuid, 'Historical session', 1)
    `,
    [sessionId, courseId, userId],
  )
  await client.query(
    `
      INSERT INTO messages (
        id,
        session_id,
        sequence,
        role,
        author_user_id,
        content,
        status
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        1,
        'STUDENT',
        $3::uuid,
        'Historical question',
        'COMPLETED'
      )
    `,
    [messageId, sessionId, userId],
  )

  return { messageId }
}
