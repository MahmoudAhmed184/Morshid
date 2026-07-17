import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import type { ConfigService } from '@nestjs/config'
import { Client } from 'pg'

import type { AppEnvironment } from '../../src/modules/config/env.schema'
import { PrismaService } from '../../src/modules/prisma/prisma.service'

export interface DisposableDatabase {
  prisma: PrismaService
  databaseName: string
  // Disconnects the Prisma client (when it was created) and force-drops the
  // disposable database. Safe to call from afterAll even when setup failed.
  dispose(): Promise<void>
}

// Creates a uniquely named database on the server DATABASE_URL points at,
// applies every committed migration to it from empty, and returns a connected
// PrismaService. If any step after CREATE DATABASE fails, the database is
// dropped before the error propagates so failed runs cannot orphan databases.
export async function setUpDisposableDatabase(
  namePrefix: string,
): Promise<DisposableDatabase> {
  const originalDatabaseUrl = requireDatabaseUrl()
  const databaseName = `${namePrefix}_${randomUUID().replaceAll('-', '')}`
  await runDatabaseAdminStatement(
    originalDatabaseUrl,
    `CREATE DATABASE "${databaseName}"`,
  )

  let prisma: PrismaService | undefined
  const dispose = async (): Promise<void> => {
    try {
      await prisma?.$disconnect()
    } finally {
      await runDatabaseAdminStatement(
        originalDatabaseUrl,
        `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
      )
    }
  }

  try {
    const databaseUrl = databaseUrlFor(originalDatabaseUrl, databaseName)
    await applyMigrations(databaseUrl)

    const configService = {
      get: () => databaseUrl,
    } as unknown as ConfigService<AppEnvironment, true>
    prisma = new PrismaService(configService)
    await prisma.$connect()

    return { prisma, databaseName, dispose }
  } catch (error) {
    await dispose()
    throw error
  }
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required for persistence e2e tests')
  }

  return databaseUrl
}

function databaseUrlFor(databaseUrl: string, databaseName: string): string {
  const url = new URL(databaseUrl)
  url.pathname = `/${databaseName}`
  url.searchParams.delete('schema')
  return url.toString()
}

async function runDatabaseAdminStatement(
  databaseUrl: string,
  statement: string,
): Promise<void> {
  const client = new Client({
    connectionString: databaseUrlFor(databaseUrl, 'postgres'),
  })
  await client.connect()

  try {
    await client.query(statement)
  } finally {
    await client.end()
  }
}

async function applyMigrations(databaseUrl: string): Promise<void> {
  const migrationsDirectory = join(process.cwd(), 'prisma', 'migrations')
  const migrationDirectories = (
    await readdir(migrationsDirectory, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    for (const migrationDirectory of migrationDirectories) {
      const sql = await readFile(
        join(migrationsDirectory, migrationDirectory, 'migration.sql'),
        'utf8',
      )
      await client.query(sql)
    }
  } finally {
    await client.end()
  }
}
