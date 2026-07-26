import { PrismaPg } from '@prisma/adapter-pg'
import { config as loadEnv } from 'dotenv'

import { PrismaClient } from '../src/generated/prisma/client'
import { seedP0DemoData } from '../src/seeds/p0-demo.seed'

const localDatabaseUrl =
  'postgresql://morshid:morshid_local_password@localhost:5432/morshid'

for (const path of ['server/.env', '.env', '../.env']) {
  loadEnv({ path })
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? localDatabaseUrl,
    }),
  })

  try {
    const result = await seedP0DemoData(prisma)

    console.log(
      `Seeded ${result.users.length.toString()} P0 demo users, course ${result.courses.pythonProgramming.code}, and isolation course ${result.courses.hiddenIsolation.code}.`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
