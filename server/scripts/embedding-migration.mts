import type { ConfigService } from '@nestjs/config'
import { createClient } from 'redis'
import { config as loadEnv } from 'dotenv'

import type { AppEnvironment } from '../src/modules/config/env.schema.js'
import { validateEnv } from '../src/modules/config/env.schema.js'
import { createEmbeddingProvider } from '../src/modules/embedding/embedding-provider.factory.js'
import { migrateEmbeddings } from '../src/modules/embedding/embedding-migration.runner.js'
import type { EmbeddingMigrationEvent } from '../src/modules/embedding/embedding-migration.runner.js'
import type { EmbeddingProvider } from '../src/modules/embedding/embedding-provider.js'
import { composeGeminiEmbeddingConfiguration } from '../src/modules/embedding/gemini-embedding-runtime.js'
import { PrismaEmbeddingMigrationCorpus } from '../src/modules/embedding/prisma-embedding-migration.corpus.js'
import { PrismaService } from '../src/modules/prisma/prisma.service.js'
import { PrismaMaterialChunkRepository } from '../src/modules/materials/material-chunk.repository.js'

loadEnv({
  path: ['server/.env', '.env', '../.env'],
  quiet: true,
})

const TARGETS = ['deterministic', 'gemini'] as const
type Target = (typeof TARGETS)[number]

/**
 * Re-embeds the corpus under a target provider's document profile.
 *
 * **Run this under maintenance mode, not alongside normal traffic.** Material
 * processing uses lease records and would not participate in any lock this
 * script could take, so a lock would protect nothing. The procedure is in
 * `server/README.md`: disable retrieval, scale processing workers to zero,
 * verify no unexpired leases, run this, verify coverage, then switch
 * `EMBEDDING_PROVIDER`.
 *
 * The target is an explicit argument and its configuration is validated
 * **independently of `EMBEDDING_PROVIDER`** — the whole point is to migrate
 * *before* switching, so the target is deliberately not the configured
 * provider.
 */
async function main(): Promise<void> {
  const target = readTarget()
  // Force validation through the target provider's complete startup gate,
  // independently of the provider currently serving traffic. A migration to
  // Gemini must not bypass the production refusal, acknowledgement,
  // placeholder/distinct-key rules, quota-project syntax, or cap ordering just
  // because EMBEDDING_PROVIDER is still deterministic before activation.
  const env = validateEnv({
    ...process.env,
    EMBEDDING_PROVIDER: target,
  })

  // PrismaService reads its connection string through ConfigService; this
  // script has no Nest container, so it supplies the one value that needs.
  const prismaService = new PrismaService({
    get: () => env.DATABASE_URL,
  } as unknown as ConfigService<AppEnvironment, true>)
  await prismaService.$connect()

  const teardown: (() => Promise<void>)[] = [() => prismaService.$disconnect()]

  try {
    const provider = await buildTarget(target, env, teardown)
    const corpus = new PrismaEmbeddingMigrationCorpus(prismaService)
    const persistence = new PrismaMaterialChunkRepository(prismaService)

    const summary = await migrateEmbeddings({
      target: provider,
      corpus,
      persistence,
      report: (event) => {
        process.stdout.write(`${JSON.stringify(describeEvent(event))}\n`)
      },
    })

    process.stdout.write(
      `${JSON.stringify({
        outcome: summary.complete ? 'complete' : 'incomplete',
        targetModel: summary.targetModel,
        candidateCount: summary.candidateCount,
        migratedCount: summary.migratedCount,
        skippedCount: summary.skippedCount,
        failedMaterialCount: summary.failedMaterialIds.length,
      })}\n`,
    )

    // Non-zero unless the whole target corpus is covered: an operator must not
    // be able to switch providers off a partially successful run.
    if (!summary.complete) {
      process.exitCode = 1
    }
  } finally {
    for (const dispose of teardown) {
      await dispose().catch(() => undefined)
    }
  }
}

function readTarget(): Target {
  const requested = process.argv[2]
  if (!isTarget(requested)) {
    throw new Error(
      `Usage: embedding-migration <${TARGETS.join('|')}>. The target is explicit and is validated independently of EMBEDDING_PROVIDER.`,
    )
  }
  return requested
}

function isTarget(value: unknown): value is Target {
  return (TARGETS as readonly unknown[]).includes(value)
}

async function buildTarget(
  target: Target,
  env: ReturnType<typeof validateEnv>,
  teardown: (() => Promise<void>)[],
): Promise<EmbeddingProvider> {
  if (target === 'deterministic') {
    return createEmbeddingProvider('deterministic')
  }

  const apiKey = requireValue(
    env.GEMINI_EMBEDDING_API_KEY,
    'GEMINI_EMBEDDING_API_KEY',
  )
  const quotaProjectId = requireValue(
    env.GEMINI_EMBEDDING_QUOTA_PROJECT_ID,
    'GEMINI_EMBEDDING_QUOTA_PROJECT_ID',
  )

  const redis = createClient({ url: env.REDIS_URL })
  await redis.connect()
  teardown.push(() => redis.quit().then(() => undefined))

  const gemini = composeGeminiEmbeddingConfiguration({
    apiKey,
    quotaProjectId,
    redis: {
      eval: (script, options) =>
        redis.eval(script, {
          keys: [...options.keys],
          arguments: [...options.arguments],
        }),
    },
    quotaCaps: {
      requestsPerMinute: requireValue(
        env.GEMINI_EMBEDDING_REQUESTS_PER_MINUTE,
        'GEMINI_EMBEDDING_REQUESTS_PER_MINUTE',
      ),
      inputTokensPerMinute: requireValue(
        env.GEMINI_EMBEDDING_INPUT_TOKENS_PER_MINUTE,
        'GEMINI_EMBEDDING_INPUT_TOKENS_PER_MINUTE',
      ),
      requestsPerHour: requireValue(
        env.GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_HOUR,
        'GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_HOUR',
      ),
      requestsPerDay: requireValue(
        env.GEMINI_EMBEDDING_REQUESTS_PER_DAY,
        'GEMINI_EMBEDDING_REQUESTS_PER_DAY',
      ),
      requestsPerMonth: requireValue(
        env.GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS,
        'GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS',
      ),
    },
    options: {
      queryTimeoutMs: env.EMBEDDING_QUERY_TIMEOUT_MS,
      documentTimeoutMs: env.EMBEDDING_DOCUMENT_TIMEOUT_MS,
      requestTimeoutMs: env.EMBEDDING_REQUEST_TIMEOUT_MS,
    },
  })

  // The same factory and collaborator composer as runtime startup: migration
  // cannot persist a vector the running application would reject.
  return createEmbeddingProvider('gemini', { gemini })
}

function requireValue<Value>(value: Value | undefined, name: string): Value {
  if (value === undefined) {
    throw new Error(`${name} is required to migrate to the gemini profile`)
  }
  return value
}

// Material ids only — never chunk text, titles, or vector values.
function describeEvent(event: EmbeddingMigrationEvent): unknown {
  return event.kind === 'skipped_complete' || event.kind === 'migrated'
    ? {
        kind: event.kind,
        materialId: event.materialId,
        chunks: event.chunkCount,
      }
    : { kind: event.kind, materialId: event.materialId }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      outcome: 'failure',
      error: error instanceof Error ? error.name : typeof error,
    })}\n`,
  )
  process.exitCode = 1
})
