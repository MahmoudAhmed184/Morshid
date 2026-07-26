import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { Client } from 'pg'

import { Prisma } from '../src/generated/prisma/client'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

const PRE_IDENTITY_MIGRATION = '20260721110000_add_material_processing_commands'
const IDENTITY_MIGRATION =
  '20260722015955_enforce_grounded_chat_response_identity'

describe('Grounded chat identity migration (e2e)', () => {
  let database: DisposableDatabase | undefined

  afterEach(async () => {
    await database?.dispose()
    database = undefined
  })

  it('rejects duplicate legacy responses before replacing the old index and succeeds after explicit reconciliation', async () => {
    database = await setUpDisposableDatabase('morshid_issue88_upgrade', {
      throughMigration: PRE_IDENTITY_MIGRATION,
    })
    const ids = await seedDuplicateLegacyResponses(database)
    const migrationSql = await readFile(
      join(
        process.cwd(),
        'prisma',
        'migrations',
        IDENTITY_MIGRATION,
        'migration.sql',
      ),
      'utf8',
    )
    const client = new Client({ connectionString: database.databaseUrl })
    await client.connect()

    try {
      let migrationError: unknown
      try {
        await client.query(migrationSql)
      } catch (error) {
        migrationError = error
      }
      expect(migrationError).toMatchObject({
        code: '23505',
        message:
          'Cannot enforce one response per message: duplicate legacy response_to_message_id values exist',
      })
      if (!isPostgresError(migrationError)) {
        throw new Error('Expected the migration to return a PostgreSQL error')
      }
      expect(migrationError.detail).toContain(ids.studentMessageId)
      await client.query('ROLLBACK')

      const indexesBefore = await client.query<{ indexname: string }>(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'messages'
      `)
      expect(indexesBefore.rows.map(({ indexname }) => indexname)).toContain(
        'idx_messages_response_to',
      )
      expect(
        indexesBefore.rows.map(({ indexname }) => indexname),
      ).not.toContain('messages_response_to_message_id_key')

      await client.query('DELETE FROM messages WHERE id = $1::uuid', [
        ids.discardedAssistantId,
      ])
      await client.query(migrationSql)

      const indexesAfter = await client.query<{ indexname: string }>(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'messages'
      `)
      expect(indexesAfter.rows.map(({ indexname }) => indexname)).toContain(
        'messages_response_to_message_id_key',
      )
      expect(indexesAfter.rows.map(({ indexname }) => indexname)).toContain(
        'idx_messages_grounding_lease',
      )
      expect(indexesAfter.rows.map(({ indexname }) => indexname)).not.toContain(
        'idx_messages_response_to',
      )

      const attemptColumns = await client.query<{
        column_name: string
        data_type: string
        is_nullable: string
      }>(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'messages'
          AND column_name IN (
            'grounding_attempt_id',
            'grounding_lease_expires_at'
          )
        ORDER BY column_name
      `)
      expect(attemptColumns.rows).toEqual([
        {
          column_name: 'grounding_attempt_id',
          data_type: 'uuid',
          is_nullable: 'YES',
        },
        {
          column_name: 'grounding_lease_expires_at',
          data_type: 'timestamp with time zone',
          is_nullable: 'YES',
        },
      ])

      await expect(
        client.query(
          `
            INSERT INTO messages (
              session_id,
              sequence,
              role,
              response_to_message_id,
              content,
              status
            ) VALUES ($1::uuid, 4, 'ASSISTANT', $2::uuid, '', 'FAILED')
          `,
          [ids.sessionId, ids.studentMessageId],
        ),
      ).rejects.toMatchObject({ code: '23505' })
    } finally {
      await client.end()
    }
  })
})

async function seedDuplicateLegacyResponses(
  database: DisposableDatabase,
): Promise<{
  sessionId: string
  studentMessageId: string
  discardedAssistantId: string
}> {
  const userId = randomUUID()
  const courseId = randomUUID()
  const membershipId = randomUUID()
  const sessionId = randomUUID()
  const studentMessageId = randomUUID()
  const firstAssistantId = randomUUID()
  const discardedAssistantId = randomUUID()

  await database.prisma.$executeRaw(Prisma.sql`
    INSERT INTO users (id, email, display_name, role, password_hash)
    VALUES (
      ${userId}::uuid,
      ${`legacy-${userId}@morshid.test`}::citext,
      'Legacy Student',
      'STUDENT',
      'test-password-hash'
    )
  `)
  await database.prisma.$executeRaw(Prisma.sql`
    INSERT INTO courses (id, code, title, created_by)
    VALUES (${courseId}::uuid, ${`LEG-${courseId.slice(0, 20)}`}, 'Legacy Course', ${userId}::uuid)
  `)
  await database.prisma.$executeRaw(Prisma.sql`
    INSERT INTO course_memberships (id, course_id, user_id, role, created_by)
    VALUES (${membershipId}::uuid, ${courseId}::uuid, ${userId}::uuid, 'STUDENT', ${userId}::uuid)
  `)
  await database.prisma.$executeRaw(Prisma.sql`
    INSERT INTO chat_sessions (
      id,
      course_id,
      student_id,
      title,
      last_sequence
    ) VALUES (${sessionId}::uuid, ${courseId}::uuid, ${userId}::uuid, 'Legacy Chat', 3)
  `)
  await database.prisma.$executeRaw(Prisma.sql`
    INSERT INTO messages (
      id,
      session_id,
      sequence,
      role,
      author_user_id,
      content,
      status
    ) VALUES (
      ${studentMessageId}::uuid,
      ${sessionId}::uuid,
      1,
      'STUDENT',
      ${userId}::uuid,
      'Legacy question',
      'COMPLETED'
    )
  `)
  await database.prisma.$executeRaw(Prisma.sql`
    INSERT INTO messages (
      id,
      session_id,
      sequence,
      role,
      response_to_message_id,
      content,
      status
    ) VALUES
      (${firstAssistantId}::uuid, ${sessionId}::uuid, 2, 'ASSISTANT', ${studentMessageId}::uuid, 'First legacy answer', 'COMPLETED'),
      (${discardedAssistantId}::uuid, ${sessionId}::uuid, 3, 'ASSISTANT', ${studentMessageId}::uuid, 'Second legacy answer', 'COMPLETED')
  `)

  return { sessionId, studentMessageId, discardedAssistantId }
}

function isPostgresError(
  error: unknown,
): error is Error & { code: string; detail: string } {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    'detail' in error &&
    typeof error.detail === 'string'
  )
}
