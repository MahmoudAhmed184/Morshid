import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { Client } from 'pg'

import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

const PRE_AUDIT_MIGRATION = '20260808133701'
const RESPONSE_AUDIT_MIGRATION = '20260810023000_add_socratic_response_audit'

describe('Socratic response audit migration compatibility (e2e)', () => {
  it('backfills legacy completions and enforces new completion metadata', async () => {
    let database: DisposableDatabase | undefined
    try {
      database = await setUpDisposableDatabase(
        'morshid_response_audit_compat',
        {
          throughMigration: PRE_AUDIT_MIGRATION,
        },
      )
      const client = new Client({ connectionString: database.databaseUrl })
      await client.connect()

      try {
        const fixture = await seedPreAuditTurns(client)
        const migrationSql = await readFile(
          join(
            process.cwd(),
            'prisma',
            'migrations',
            RESPONSE_AUDIT_MIGRATION,
            'migration.sql',
          ),
          'utf8',
        )

        await client.query(migrationSql)

        const migrated = await client.query<{
          id: string
          approval_source: string | null
          approved_candidate_attempt: number | null
          safe_fallback_reason: string | null
          validation_policy_version: string | null
        }>(
          `
            SELECT
              id::text,
              approval_source::text,
              approved_candidate_attempt,
              safe_fallback_reason::text,
              validation_policy_version
            FROM tutor_turns
            WHERE id = ANY($1::uuid[])
            ORDER BY id
          `,
          [
            [
              fixture.candidateTurnId,
              fixture.fallbackTurnId,
              fixture.pendingTurnId,
            ],
          ],
        )

        expect(migrated.rows).toEqual(
          [
            {
              id: fixture.candidateTurnId,
              approval_source: 'VALIDATED_CANDIDATE',
              approved_candidate_attempt: null,
              safe_fallback_reason: null,
              validation_policy_version: 'legacy-unversioned',
            },
            {
              id: fixture.fallbackTurnId,
              approval_source: 'SAFE_FALLBACK',
              approved_candidate_attempt: null,
              safe_fallback_reason: 'LEGACY_UNCLASSIFIED',
              validation_policy_version: 'legacy-unversioned',
            },
            {
              id: fixture.pendingTurnId,
              approval_source: null,
              approved_candidate_attempt: null,
              safe_fallback_reason: null,
              validation_policy_version: null,
            },
          ].sort((left, right) => left.id.localeCompare(right.id)),
        )

        const objects = await client.query<{ table_name: string }>(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = current_schema()
            AND table_name IN ('tutor_candidate_attempts', 'guard_results')
          ORDER BY table_name
        `)
        expect(objects.rows.map(({ table_name }) => table_name)).toEqual([
          'guard_results',
          'tutor_candidate_attempts',
        ])

        await expect(
          client.query(
            `
              INSERT INTO tutor_turns (
                session_id,
                idempotency_key,
                status,
                completed_at
              )
              VALUES ($1::uuid, $2, 'COMPLETED', now())
            `,
            [fixture.sessionId, `invalid-${randomUUID()}`],
          ),
        ).rejects.toMatchObject({ code: '23514' })
      } finally {
        await client.end()
      }
    } finally {
      await database?.dispose()
    }
  })
})

async function seedPreAuditTurns(client: Client): Promise<{
  sessionId: string
  candidateTurnId: string
  fallbackTurnId: string
  pendingTurnId: string
}> {
  const studentId = randomUUID()
  const courseId = randomUUID()
  const sessionId = randomUUID()
  const candidateTurnId = randomUUID()
  const fallbackTurnId = randomUUID()
  const pendingTurnId = randomUUID()

  await client.query(
    `
      INSERT INTO users (id, email, display_name, role, password_hash)
      VALUES ($1::uuid, $2, 'Migration student', 'STUDENT', 'hash')
    `,
    [studentId, `migration-${randomUUID()}@morshid.test`],
  )
  await client.query(
    `
      INSERT INTO courses (id, code, title, created_by)
      VALUES ($1::uuid, $2, 'Migration course', $3::uuid)
    `,
    [courseId, `MIG-${randomUUID().slice(0, 24)}`, studentId],
  )
  await client.query(
    `
      INSERT INTO course_memberships (course_id, user_id, role, created_by)
      VALUES ($1::uuid, $2::uuid, 'STUDENT', $2::uuid)
    `,
    [courseId, studentId],
  )
  await client.query(
    `
      INSERT INTO chat_sessions (id, course_id, student_id, title)
      VALUES ($1::uuid, $2::uuid, $3::uuid, 'Migration compatibility')
    `,
    [sessionId, courseId, studentId],
  )
  await client.query(
    `
      INSERT INTO tutor_turns (
        id,
        session_id,
        idempotency_key,
        status,
        safe_fallback_used,
        completed_at
      )
      VALUES
        ($1::uuid, $4::uuid, 'legacy-candidate', 'COMPLETED', false, now()),
        ($2::uuid, $4::uuid, 'legacy-fallback', 'COMPLETED', true, now()),
        ($3::uuid, $4::uuid, 'legacy-pending', 'VALIDATING', false, NULL)
    `,
    [candidateTurnId, fallbackTurnId, pendingTurnId, sessionId],
  )

  return { sessionId, candidateTurnId, fallbackTurnId, pendingTurnId }
}
