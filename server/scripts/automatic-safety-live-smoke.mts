import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

import { GoogleGenAI } from '@google/genai'
import { Logger } from '@nestjs/common'
import { config as loadEnv } from 'dotenv'

import { createCompletionProvider } from '../src/modules/completion/completion-provider.factory.js'
import { validateEnv } from '../src/modules/config/env.schema.js'
import {
  GEMINI_EMBEDDING_API_VERSION,
  type GeminiEmbeddingRequest,
} from '../src/modules/embedding/embedding-configuration.js'
import { createEmbeddingProvider } from '../src/modules/embedding/embedding-provider.factory.js'
import { AutomaticSafetyRiskDetector } from '../src/modules/output-policy/automatic-safety-risk.detector.js'
import { AUTOMATIC_SAFETY_FIXTURES } from '../src/modules/output-policy/automatic-safety.fixtures.js'
import {
  serializeAutomaticSafetySmokeFailure,
  serializeAutomaticSafetySmokeSuccess,
  type AutomaticSafetySmokeStage,
} from '../src/modules/output-policy/automatic-safety-smoke-report.js'
import { OutputPolicyService } from '../src/modules/output-policy/output-policy.service.js'

loadEnv({ path: ['server/.env', '.env', '../.env'], quiet: true })
Logger.overrideLogger([])

const FIXTURE_IDENTIFIER = 'automatic-safety-scn-01-08-v1'
const LIVE_COMPLETION_SCENARIO_IDS = new Set(['SCN-01', 'SCN-04', 'SCN-08'])
const LIVE_EMBEDDING_SCENARIO_IDS = new Set(
  AUTOMATIC_SAFETY_FIXTURES.filter(({ id }) => id !== 'SCN-05').map(
    ({ id }) => id,
  ),
)
const SYNTHETIC_CONTEXT =
  'This synthetic context supports a small course-policy learning step only.'

let stage: AutomaticSafetySmokeStage = 'configuration'

async function main(): Promise<void> {
  if (process.env.AUTOMATIC_SAFETY_LIVE_SMOKE_ACKNOWLEDGED !== 'true') {
    throw new Error('Automatic safety live smoke is not acknowledged')
  }
  const env = validateEnv(process.env)
  if (
    env.COMPLETION_PROVIDER !== 'aws-bedrock' ||
    env.ITI_BEDROCK_GATEWAY_API_KEY === undefined ||
    env.EMBEDDING_PROVIDER !== 'gemini' ||
    env.GEMINI_EMBEDDING_API_KEY === undefined
  ) {
    throw new Error('Automatic safety live smoke configuration is incomplete')
  }
  const testedCommitSha = requireCleanCommitSha()

  const completion = createCompletionProvider({
    provider: 'aws-bedrock',
    timeoutMs: env.COMPLETION_TIMEOUT_MS,
    awsBedrock: {
      baseUrl: env.ITI_BEDROCK_GATEWAY_BASE_URL,
      apiKey: env.ITI_BEDROCK_GATEWAY_API_KEY,
      modelId: env.AWS_BEDROCK_MODEL_ID,
      allowedModelIds: env.AWS_BEDROCK_ALLOWED_MODEL_IDS,
      maxTokens: env.AWS_BEDROCK_MAX_TOKENS,
      allowInsecureHttp: env.ITI_BEDROCK_ALLOW_INSECURE_HTTP,
      environment: env.NODE_ENV,
    },
  })
  const sdk = new GoogleGenAI({
    apiKey: env.GEMINI_EMBEDDING_API_KEY,
    httpOptions: {
      apiVersion: GEMINI_EMBEDDING_API_VERSION,
      retryOptions: { attempts: 1 },
    },
  })
  const embedding = createEmbeddingProvider('gemini', {
    gemini: {
      client: {
        embedContent: (request: GeminiEmbeddingRequest) =>
          sdk.models.embedContent(request),
      },
      quota: { reserveGeneration: () => Promise.resolve() },
      options: {
        queryTimeoutMs: env.EMBEDDING_QUERY_TIMEOUT_MS,
        documentTimeoutMs: env.EMBEDDING_DOCUMENT_TIMEOUT_MS,
        requestTimeoutMs: env.EMBEDDING_REQUEST_TIMEOUT_MS,
      },
    },
  })

  stage = 'validation'
  const outputPolicy = new OutputPolicyService()
  for (const fixture of AUTOMATIC_SAFETY_FIXTURES) {
    const decision = outputPolicy.evaluate(fixture.input)
    if (
      decision.reasons.length !== fixture.expectedReasons.length ||
      decision.reasons.some(
        (reason, index) => reason !== fixture.expectedReasons[index],
      )
    ) {
      throw new Error('Automatic safety deterministic policy preflight failed')
    }
  }

  const completionFixtures = AUTOMATIC_SAFETY_FIXTURES.filter(({ id }) =>
    LIVE_COMPLETION_SCENARIO_IDS.has(id),
  )
  stage = 'completion'
  const completions = []
  for (const fixture of completionFixtures) {
    completions.push(
      await completion.complete({
        studentQuestion: fixture.studentQuestion,
        context: [
          {
            sourceTitle: 'Synthetic automatic safety fixture',
            chunkIndex: 0,
            content: SYNTHETIC_CONTEXT,
          },
        ],
      }),
    )
  }

  const embeddingFixtures = AUTOMATIC_SAFETY_FIXTURES.filter(({ id }) =>
    LIVE_EMBEDDING_SCENARIO_IDS.has(id),
  )
  stage = 'embedding'
  const vectors = []
  for (const fixture of embeddingFixtures) {
    vectors.push(await embedding.embedQuery(fixture.studentQuestion))
  }

  stage = 'validation'
  const firstCompletion = completions.at(0)
  if (
    firstCompletion === undefined ||
    completions.some(
      (result) =>
        result.provider !== firstCompletion.provider ||
        result.model !== firstCompletion.model ||
        result.promptVersion !== firstCompletion.promptVersion ||
        result.content.trim().length === 0,
    ) ||
    vectors.some((vector) => vector.length === 0)
  ) {
    throw new Error('Automatic safety live smoke contract failed')
  }

  const riskDetector = new AutomaticSafetyRiskDetector()
  for (const [index, result] of completions.entries()) {
    const fixture = completionFixtures[index]
    const detected = riskDetector.detectOutput(
      result.content,
      fixture.behavior === 'direct_final_answer',
    )
    if (detected === null) continue
    const decision = outputPolicy.evaluate({
      proposedContent: result.content,
      assessment: {
        support: 'SUPPORTED',
        policyCheck: detected.risks.some(
          (risk) => risk !== 'FINAL_ANSWER_DELIVERY',
        )
          ? 'FAILED'
          : 'PASSED',
        answerRisk: detected.risks.includes('FINAL_ANSWER_DELIVERY')
          ? 'FINAL_ANSWER'
          : 'NONE',
        citations: 'NOT_REQUIRED',
      },
    })
    if (decision.display !== 'SAFE_REPLACEMENT') {
      throw new Error('Automatic safety live completion containment failed')
    }
  }

  const report = serializeAutomaticSafetySmokeSuccess({
    fixtureIdentifier: FIXTURE_IDENTIFIER,
    testedCommitSha,
    executedAt: new Date().toISOString(),
    scenarioIds: AUTOMATIC_SAFETY_FIXTURES.map(({ id }) => id),
    completionProvider: firstCompletion.provider,
    completionModel: firstCompletion.model,
    promptVersion: firstCompletion.promptVersion,
    embeddingProvider: 'gemini',
    embeddingModel: embedding.model,
    embeddingProtocol: embedding.queryProtocol,
    fixtureHash: `sha256:${createHash('sha256')
      .update(JSON.stringify(AUTOMATIC_SAFETY_FIXTURES))
      .digest('hex')}`,
    completionCount: completions.length,
    embeddingCount: vectors.length,
  })
  assertReportContainsNoPrivateValues(report, [
    ...AUTOMATIC_SAFETY_FIXTURES.map(({ studentQuestion }) => studentQuestion),
    ...completions.map(({ content }) => content),
    SYNTHETIC_CONTEXT,
    env.ITI_BEDROCK_GATEWAY_API_KEY,
    env.GEMINI_EMBEDDING_API_KEY,
    env.ITI_BEDROCK_GATEWAY_BASE_URL,
  ])
  process.stdout.write(`${report}\n`)
}

function assertReportContainsNoPrivateValues(
  report: string,
  privateValues: readonly string[],
): void {
  if (
    privateValues.some((value) => value.length > 0 && report.includes(value))
  ) {
    throw new Error('Automatic safety smoke report redaction failed')
  }
}

function requireCleanCommitSha(): string {
  const worktreeStatus = execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  })
  if (worktreeStatus.trim().length > 0) {
    throw new Error('Automatic safety live smoke requires a clean worktree')
  }
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${serializeAutomaticSafetySmokeFailure(stage, error)}\n`,
  )
  process.exitCode = 1
})
