import { Client } from 'pg'

import { clearAllReviewData } from '../tests/acceptance/support/review-fixture.ts'

const confirmation = 'clear-local-reviews'
if (process.env.MORSHID_REVIEW_CLEANUP_CONFIRM !== confirmation) {
  console.error(
    `Refusing to clear review data. Set MORSHID_REVIEW_CLEANUP_CONFIRM=${confirmation} to continue.`,
  )
  process.exit(1)
}

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://morshid:morshid_local_password@localhost:5432/morshid'
const parsedDatabaseUrl = new URL(databaseUrl)
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
if (!localHosts.has(parsedDatabaseUrl.hostname)) {
  console.error(
    `Refusing to clear review data on non-local host ${parsedDatabaseUrl.hostname}.`,
  )
  process.exit(1)
}

const client = new Client({ connectionString: databaseUrl })
try {
  await client.connect()
  const result = await clearAllReviewData(client)
  console.log('Removed review-related records:', result.removed)
  console.log('Verified remaining review records:', result.remaining)
} finally {
  await client.end()
}
