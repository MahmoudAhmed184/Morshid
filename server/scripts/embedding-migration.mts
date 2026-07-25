import type { ConfigService } from '@nestjs/config'
import { GoogleGenAI } from '@google/genai'
import { createClient } from 'redis'
import { config as loadEnv } from 'dotenv'

import { GeminiQuotaService } from '../src/common/gemini/gemini-quota.service.js'
import type { AppEnvironment } from '../src/modules/config/env.schema.js'
import { validateEnv } from '../src/modules/config/env.schema.js'
import { migrateEmbeddings } from '../src/modules/embedding/embedding-migration.runner.js'
import type { EmbeddingMigrationEvent } from '../src/modules/embedding/embedding-migration.runner.js'
import type { EmbeddingProvider } from '../src/modules/embedding/embedding-provider.js'
import { PrismaEmbeddingMigrationCorpus } from '../src/modules/embedding/prisma-embedding-migration.corpus.js'
import { GeminiEmbeddingAdapter } from '../src/modules/embedding/providers/gemini/gemini-embedding.adapter.js'
import {
  GEMINI_EMBEDDING_API_VERSION,
  GEMINI_EMBEDDING_QUOTA_NAMESPACE,
} from '../src/modules/embedding/providers/gemini/gemini-embedding.constants.js'
import { DeterministicEmbeddingProvider } from '../src/modules/embedding/deterministic-embedding.provider.js'
import { ValidatedEmbeddingProvider } from '../src/modules/embedding/validated-embedding.provider.js'
import { PrismaService } from '../src/modules/prisma/prisma.service.js'
import { PrismaRagPersistenceRepository } from '../src/modules/rag-persistence/rag-persistence.repository.js'

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
  const env = validateEnv(process.env)
  const target = readTarget()

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
    const persistence = new PrismaRagPersistenceRepository(prismaService)

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
    return new ValidatedEmbeddingProvider(new DeterministicEmbeddingProvider())
  }

  // Validated here rather than by the env schema, because the schema gates
  // these on EMBEDDING_PROVIDER=gemini and the whole point of this command is
  // to run while it is still something else.
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

  const quota = new GeminiQuotaService(
    {
      eval: (script, options) =>
        redis.eval(script, {
          keys: [...options.keys],
          arguments: [...options.arguments],
        }),
    },
    {
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
    { project: quotaProjectId },
    GEMINI_EMBEDDING_QUOTA_NAMESPACE,
  )

  const sdk = new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: GEMINI_EMBEDDING_API_VERSION,
      retryOptions: { attempts: 1 },
    },
  })

  // Wrapped exactly as the runtime factory wraps it, so a migration cannot
  // persist a vector the running application would have rejected.
  return new ValidatedEmbeddingProvider(
    new GeminiEmbeddingAdapter({
      client: { embedContent: (request) => sdk.models.embedContent(request) },
      quota: {
        reserveGeneration: (units) => quota.reserveGeneration(units),
      },
      options: {
        queryTimeoutMs: env.EMBEDDING_QUERY_TIMEOUT_MS,
        documentTimeoutMs: env.EMBEDDING_DOCUMENT_TIMEOUT_MS,
        requestTimeoutMs: env.EMBEDDING_REQUEST_TIMEOUT_MS,
      },
    }),
  )
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
      message: error instanceof Error ? error.message : '',
    })}\n`,
  )
  process.exitCode = 1
})
