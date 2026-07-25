import { config as loadEnv } from 'dotenv'

import { validateEnv } from '../src/modules/config/env.schema.js'
import { createCompletionProvider } from '../src/modules/completion/completion-provider.factory.js'
import { ITI_BEDROCK_LIVE_SMOKE_FIXTURE } from '../test/fixtures/iti-bedrock-live-smoke.fixture.js'

loadEnv({
  path: ['server/.env', '.env', '../.env'],
  quiet: true,
})

const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 500
const REDACTED = '[redacted]'

// Every string the operator must never see in a diagnostic line: the credential
// itself and the exact synthetic prompt texts. Collected once so the failure
// reporter below cannot forget one.
function collectSensitiveStrings(): readonly string[] {
  return [
    process.env.ITI_BEDROCK_GATEWAY_API_KEY,
    ITI_BEDROCK_LIVE_SMOKE_FIXTURE.studentQuestion,
    ...ITI_BEDROCK_LIVE_SMOKE_FIXTURE.context.map((chunk) => chunk.content),
    ...ITI_BEDROCK_LIVE_SMOKE_FIXTURE.context.map((chunk) => chunk.sourceTitle),
  ].filter(
    (value): value is string => typeof value === 'string' && value !== '',
  )
}

async function main(): Promise<void> {
  const env = validateEnv(process.env)
  if (
    env.COMPLETION_PROVIDER !== 'aws-bedrock' ||
    env.ITI_BEDROCK_GATEWAY_API_KEY === undefined
  ) {
    throw new Error('ITI Bedrock smoke configuration is incomplete')
  }

  const provider = createCompletionProvider({
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
  const result = await provider.complete(ITI_BEDROCK_LIVE_SMOKE_FIXTURE)

  process.stdout.write(
    `${JSON.stringify({
      outcome: 'success',
      provider: result.provider,
      model: result.model,
      promptVersion: result.promptVersion,
      // The gateway reports no usage, so length is the only signal that the
      // answer is non-trivial. The text itself is never printed.
      contentLength: result.content.length,
    })}\n`,
  )
}

// Reports what the operator has to act on — error type, HTTP status, and a
// bounded message — while never emitting the credential or any prompt/response
// text. Only these three fields are read; the completion result and the request
// fixture are never touched.
function describeFailure(error: unknown): string {
  const sensitive = collectSensitiveStrings()
  const name =
    error instanceof Error && error.name !== '' ? error.name : typeof error
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''
  const causeName =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.name
      : null

  return JSON.stringify({
    outcome: 'failure',
    error: name,
    cause: causeName,
    code: readCode(error),
    message: redact(rawMessage, sensitive),
  })
}

function readCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }
  const value: unknown = Reflect.get(error, 'code')
  return typeof value === 'string' ? value : null
}

function redact(message: string, sensitive: readonly string[]): string {
  let redacted = message
  for (const secret of sensitive) {
    redacted = redacted.split(secret).join(REDACTED)
  }
  // Belt and braces for a credential shape that reached the message in an
  // encoded or truncated form rather than verbatim.
  redacted = redacted.replace(/\bsbg_[0-9A-Za-z_-]{10,}/gu, REDACTED)
  redacted = redacted.replace(/\bBearer\s+\S+/giu, `Bearer ${REDACTED}`)

  return redacted.length > MAX_DIAGNOSTIC_MESSAGE_LENGTH
    ? `${redacted.slice(0, MAX_DIAGNOSTIC_MESSAGE_LENGTH)}…`
    : redacted
}

main().catch((error: unknown) => {
  process.stderr.write(`${describeFailure(error)}\n`)
  process.exitCode = 1
})
