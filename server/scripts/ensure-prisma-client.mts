import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync, type Dirent } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'

const PRISMA_CONFIG_PATH = 'prisma.config.ts'
const PRISMA_SCHEMA_DIRECTORY = 'prisma'
const PRISMA_CLIENT_OUTPUT_DIRECTORY = join('src', 'generated', 'prisma')
const PRISMA_GENERATE_ARGS = [
  'generate',
  '--config',
  PRISMA_CONFIG_PATH,
] as const

export interface EnsurePrismaClientOptions {
  readonly cwd?: string
  readonly runGenerate?: (cwd: string) => number
}

/**
 * Returns whether the generated Prisma client covers the current schema and
 * Prisma configuration.
 *
 * The repository's Prisma config loads the schema folder from `prisma`, and
 * the client generator writes to `src/generated/prisma`. A client is current
 * only when every generated file is newer than every generation input.
 */
export function isPrismaClientCurrent(cwd = process.cwd()): boolean {
  const configPath = resolve(cwd, PRISMA_CONFIG_PATH)
  const schemaDirectory = resolve(cwd, PRISMA_SCHEMA_DIRECTORY)
  const generatedOutputDirectory = resolve(cwd, PRISMA_CLIENT_OUTPUT_DIRECTORY)
  const schemaFiles = collectFiles(schemaDirectory).filter((path) =>
    path.endsWith('.prisma'),
  )
  const inputFiles = [configPath, ...schemaFiles]

  if (schemaFiles.length === 0) {
    return false
  }

  const generatedFiles = collectFiles(generatedOutputDirectory)
  if (generatedFiles.length === 0) {
    return false
  }

  const inputMtimes: number[] = []
  for (const path of inputFiles) {
    const mtime = readMtime(path)
    if (mtime === undefined) {
      return false
    }
    inputMtimes.push(mtime)
  }

  const outputMtimes: number[] = []
  for (const path of generatedFiles) {
    const mtime = readMtime(path)
    if (mtime === undefined) {
      return false
    }
    outputMtimes.push(mtime)
  }

  const latestInputMtime = Math.max(...inputMtimes)
  const oldestOutputMtime = Math.min(...outputMtimes)
  return oldestOutputMtime > latestInputMtime
}

/**
 * Ensures the generated Prisma client exists and reflects the current inputs.
 * The return value is suitable for assigning to `process.exitCode`.
 */
export function ensurePrismaClient(
  options: EnsurePrismaClientOptions = {},
): number {
  const cwd = options.cwd ?? process.cwd()
  if (isPrismaClientCurrent(cwd)) {
    return 0
  }

  return (options.runGenerate ?? runLocalPrismaGenerate)(cwd)
}

function runLocalPrismaGenerate(cwd: string): number {
  let prismaCliPath: string
  try {
    prismaCliPath = createRequire(import.meta.url).resolve(
      'prisma/build/index.js',
    )
  } catch (error: unknown) {
    process.stderr.write(
      `Unable to resolve the local Prisma CLI: ${describeError(error)}\n`,
    )
    return 1
  }

  const result = spawnSync(
    process.execPath,
    [prismaCliPath, ...PRISMA_GENERATE_ARGS],
    {
      cwd,
      stdio: 'inherit',
    },
  )
  if (result.error !== undefined) {
    process.stderr.write(
      `Unable to run local Prisma generate: ${describeError(result.error)}\n`,
    )
    return 1
  }

  return result.status ?? 1
}

function collectFiles(path: string): string[] {
  const stats = readStats(path)
  if (stats === undefined) {
    return []
  }
  if (stats.isFile()) {
    return [path]
  }
  if (!stats.isDirectory()) {
    return []
  }

  const entries = readdirSync(path, { withFileTypes: true })
  return entries.flatMap((entry) => collectDirentFiles(path, entry))
}

function collectDirentFiles(directory: string, entry: Dirent): string[] {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? collectFiles(path) : entry.isFile() ? [path] : []
}

function readMtime(path: string): number | undefined {
  return readStats(path)?.mtimeMs
}

function readStats(path: string) {
  try {
    return statSync(path)
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isInvokedDirectly(): boolean {
  return resolve(process.argv[1]) === fileURLToPath(import.meta.url)
}

if (isInvokedDirectly()) {
  process.exitCode = ensurePrismaClient()
}
