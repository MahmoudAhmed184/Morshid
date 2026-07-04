import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

const localDatabaseUrl =
  'postgresql://morshid:morshid_local_password@localhost:5432/morshid'

for (const path of ['server/.env', '.env', '../.env']) {
  loadEnv({ path })
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl,
  },
})
