import { config as loadEnv } from 'dotenv'

import { readBoundedResponseBody } from '../src/platform/ai/upstream/bounded-response-body.js'
import {
  isValidItiGatewayApiKey,
  validateItiGatewayBaseUrl,
  type UpstreamEnvironment,
} from '../src/platform/ai/upstream/iti-gateway-transport.js'

loadEnv({
  path: ['server/.env', '.env', '../.env'],
  quiet: true,
})

const MODEL = 'us.cohere.embed-v4:0'
const INPUT_TYPE = 'search_document'
const SYNTHETIC_TEXT =
  'A synthetic glossary says that a queue processes items in first-in, first-out order.'
const MAX_PROBE_RESPONSE_BYTES = 1024 * 1024
const PROBE_TIMEOUT_MS = 60_000

interface NumericMatrix {
  readonly count: number
  readonly dimensions: readonly number[]
}

async function main(): Promise<void> {
  const baseUrl = process.env.ITI_BEDROCK_GATEWAY_BASE_URL
  const apiKey = process.env.ITI_BEDROCK_GATEWAY_API_KEY
  const environment = readEnvironment(process.env.NODE_ENV)
  const allowInsecureHttp =
    process.env.ITI_BEDROCK_ALLOW_INSECURE_HTTP === 'true'

  if (
    typeof baseUrl !== 'string' ||
    !isValidItiGatewayApiKey(apiKey) ||
    !apiKey.startsWith('sbg_') ||
    apiKey.toLowerCase().startsWith('replace-with')
  ) {
    throw new Error('ITI embedding probe configuration is incomplete')
  }

  const normalizedBaseUrl = validateItiGatewayBaseUrl(
    baseUrl,
    environment,
    allowInsecureHttp,
  )
    .toString()
    .replace(/\/+$/u, '')
  const body = JSON.stringify({
    model_id: MODEL,
    texts: [SYNTHETIC_TEXT],
    input_type: INPUT_TYPE,
  })

  const response = await fetch(`${normalizedBaseUrl}/student/embed`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  })
  const responseText = await readBoundedResponseBody(
    response,
    MAX_PROBE_RESPONSE_BYTES,
    () => new Error('ITI embedding probe response was not readable'),
  )

  if (!response.ok) {
    throw new ProbeHttpError(response.status)
  }

  const parsed: unknown = JSON.parse(responseText)
  const matrices = findNumericMatrices(parsed)
  const selectedMatrix = matrices.length === 1 ? matrices[0] : undefined

  process.stdout.write(
    `${JSON.stringify({
      topLevelProperties: readTopLevelProperties(parsed),
      responseShape: describeShape(parsed),
      embeddingCount: selectedMatrix?.count ?? null,
      dimensions: selectedMatrix?.dimensions ?? [],
      inputTextEchoed: containsString(parsed, SYNTHETIC_TEXT),
    })}\n`,
  )
}

class ProbeHttpError extends Error {
  constructor(readonly status: number) {
    super('ITI embedding probe request failed')
    this.name = 'ProbeHttpError'
  }
}

function readEnvironment(value: unknown): UpstreamEnvironment {
  return value === 'test' || value === 'production' ? value : 'development'
}

function readTopLevelProperties(value: unknown): readonly string[] {
  if (!isRecord(value)) {
    return []
  }
  return Object.keys(value).sort()
}

function describeShape(value: unknown, depth = 0): string {
  if (depth >= 6) {
    return '…'
  }
  if (Array.isArray(value)) {
    return value.length === 0
      ? 'array[]'
      : `array[${describeShape(value[0], depth + 1)}]`
  }
  if (isRecord(value)) {
    const fields = Object.keys(value)
      .sort()
      .map(
        (key) => `${key}:${describeShape(Reflect.get(value, key), depth + 1)}`,
      )
    return `object{${fields.join(',')}}`
  }
  if (value === null) {
    return 'null'
  }
  return typeof value
}

function findNumericMatrices(value: unknown): readonly NumericMatrix[] {
  const matrices: NumericMatrix[] = []

  const visit = (candidate: unknown): void => {
    if (isNumericMatrix(candidate)) {
      matrices.push({
        count: candidate.length,
        dimensions: candidate.map((row) => row.length),
      })
      return
    }

    if (Array.isArray(candidate)) {
      candidate.forEach(visit)
      return
    }
    if (isRecord(candidate)) {
      Object.values(candidate).forEach(visit)
    }
  }

  visit(value)
  return matrices
}

function containsString(value: unknown, expected: string): boolean {
  if (value === expected) {
    return true
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsString(item, expected))
  }
  return (
    isRecord(value) &&
    Object.values(value).some((item) => containsString(item, expected))
  )
}

function isNumericMatrix(
  value: unknown,
): value is readonly (readonly number[])[] {
  return (
    Array.isArray(value) && value.length > 0 && value.every(isFiniteNumberArray)
  )
}

function isFiniteNumberArray(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.every(
      (component): component is number =>
        typeof component === 'number' && Number.isFinite(component),
    )
  )
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      outcome: 'failure',
      error: error instanceof Error ? error.name : typeof error,
      status: error instanceof ProbeHttpError ? error.status : null,
    })}\n`,
  )
  process.exitCode = 1
})
