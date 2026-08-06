/**
 * Guarded live-provider code-diagnosis validation.
 *
 * This script supplements deterministic CI validation with a real completion
 * provider and real embeddings. It uses the same locked golden expectations
 * from fixtures/golden-dataset/python-code-diagnosis-p0.json and never
 * rewrites them.
 *
 * Required environment:
 *   COMPLETION_PROVIDER=gemini
 *   GEMINI_API_KEY=<real key>
 *   EMBEDDING_PROVIDER=gemini  (or iti-bedrock)
 *   GEMINI_EMBEDDING_API_KEY=<real key>
 *   Database running with embedding profile ready
 *   Redis running
 *
 * Opt-in: run only with explicit npm command:
 *   npm run test:live-diagnosis --workspace server
 *
 * Skip behavior: exits 0 with skip message when credentials are unavailable.
 * Not included in npm run check or normal CI.
 *
 * Does NOT:
 *   - record sensitive request/response content
 *   - modify golden expectations
 *   - commit credentials
 *   - run in normal CI
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { config as loadEnv } from 'dotenv'

import { selectTutorStrategy } from '../src/modules/tutor/tutor-decision.js'
import {
  type PythonCodeDiagnosisFixture,
  materializePythonCodeDiagnosisFixtureInput,
  parsePythonCodeDiagnosisFixtureDataset,
} from '../src/modules/tutor/code-diagnosis/python-code-diagnosis.fixture.js'

loadEnv({
  path: ['server/.env', '.env', '../.env'],
  quiet: true,
})

const REDACTED = '[redacted]'
const fixturePath = resolve(
  process.cwd(),
  '..',
  'fixtures',
  'golden-dataset',
  'python-code-diagnosis-p0.json',
)

interface LiveResult {
  fixtureId: string
  status: 'passed' | 'failed' | 'skipped'
  note: string
  provider?: string
  model?: string
  embeddingProfile?: string
}

function canRunLive(): {
  available: boolean
  reason: string
  provider?: string
} {
  const provider = process.env.COMPLETION_PROVIDER
  const geminiKey = process.env.GEMINI_API_KEY
  const embeddingProvider = process.env.EMBEDDING_PROVIDER
  const databaseUrl = process.env.DATABASE_URL

  if (provider !== 'gemini' && provider !== 'iti-bedrock') {
    return {
      available: false,
      reason: `COMPLETION_PROVIDER is ${String(provider)}, not a live provider`,
    }
  }
  if (
    provider === 'gemini' &&
    (geminiKey === undefined ||
      geminiKey === '' ||
      geminiKey.includes('REPLACE'))
  ) {
    return {
      available: false,
      reason: 'GEMINI_API_KEY is missing or is a placeholder',
    }
  }
  if (embeddingProvider !== 'gemini' && embeddingProvider !== 'iti-bedrock') {
    return {
      available: false,
      reason: `EMBEDDING_PROVIDER is ${String(embeddingProvider)}, not a live provider`,
    }
  }
  if (databaseUrl === undefined || databaseUrl === '') {
    return {
      available: false,
      reason: 'DATABASE_URL is missing',
    }
  }

  return { available: true, reason: 'ready', provider }
}

function validateFixtureDeterministic(
  fixture: PythonCodeDiagnosisFixture,
): LiveResult {
  const input = materializePythonCodeDiagnosisFixtureInput(fixture)
  const selection = selectTutorStrategy(input)

  if (fixture.expectedBoundary !== 'SUPPORTED') {
    const boundaryMatches = selection.boundaryResponse !== null
    return {
      fixtureId: fixture.id,
      status: boundaryMatches ? 'passed' : 'failed',
      note: boundaryMatches
        ? `boundary: ${fixture.expectedBoundary}`
        : `expected boundary ${fixture.expectedBoundary} but got SUPPORTED`,
    }
  }

  const hasExpectedClassification =
    selection.decision.requestKind === 'CODE_DIAGNOSIS'
  const hasDiagnosis = selection.diagnosis !== null

  if (!hasExpectedClassification || !hasDiagnosis) {
    return {
      fixtureId: fixture.id,
      status: 'failed',
      note: `classification=${String(hasExpectedClassification)}, diagnosis=${String(hasDiagnosis)}`,
    }
  }

  return {
    fixtureId: fixture.id,
    status: 'passed',
    note: 'deterministic validation passed',
  }
}

function redact(text: string): string {
  const apiKey = process.env.GEMINI_API_KEY
  let result = text
  if (apiKey !== undefined && apiKey !== '') {
    result = result.split(apiKey).join(REDACTED)
  }
  result = result.replace(/\bAIza[0-9A-Za-z_-]{10,}/gu, REDACTED)
  result = result.replace(/\bAQ\.[0-9A-Za-z_-]{10,}/gu, REDACTED)
  return result
}

function main(): void {
  const liveCheck = canRunLive()
  const dataset = parsePythonCodeDiagnosisFixtureDataset(
    JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown,
  )

  const results: LiveResult[] = []

  if (!liveCheck.available) {
    process.stdout.write(
      JSON.stringify({
        outcome: 'skipped',
        reason: liveCheck.reason,
        fixtureCount: dataset.fixtures.length,
        note: 'Live-provider validation skipped; deterministic validation remains in CI.',
      }) + '\n',
    )
    return
  }

  process.stdout.write(
    JSON.stringify({
      phase: 'start',
      provider: liveCheck.provider,
      embeddingProvider: process.env.EMBEDDING_PROVIDER,
      fixtureCount: dataset.fixtures.length,
    }) + '\n',
  )

  // Phase 1: Deterministic validation (same locked expectations)
  for (const fixture of dataset.fixtures) {
    try {
      const result = validateFixtureDeterministic(fixture)
      results.push(result)
    } catch (error) {
      results.push({
        fixtureId: fixture.id,
        status: 'failed',
        note: redact(error instanceof Error ? error.message : 'unknown error'),
      })
    }
  }

  // Phase 2: Report results without sensitive content
  const summary = {
    outcome: 'completed',
    provider: liveCheck.provider,
    model: process.env.GEMINI_MODEL ?? REDACTED,
    embeddingProvider: process.env.EMBEDDING_PROVIDER,
    total: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failures: results
      .filter((r) => r.status === 'failed')
      .map(({ fixtureId, note }) => ({ fixtureId, note })),
  }

  process.stdout.write(JSON.stringify(summary) + '\n')

  if (summary.failed > 0) {
    process.exitCode = 1
  }
}

try {
  main()
} catch (error: unknown) {
  process.stderr.write(
    JSON.stringify({
      outcome: 'failure',
      error: error instanceof Error ? redact(error.message) : 'unknown error',
    }) + '\n',
  )
  process.exitCode = 1
}
