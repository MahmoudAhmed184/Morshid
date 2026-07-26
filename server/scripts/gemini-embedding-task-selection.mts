import { GoogleGenAI } from '@google/genai'
import { config as loadEnv } from 'dotenv'

import { validateEnv } from '../src/modules/config/env.schema.js'
import {
  buildGeminiDocumentInput,
  GEMINI_EMBEDDING_API_VERSION,
  GEMINI_EMBEDDING_MODEL,
  GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY,
} from '../src/modules/embedding/embedding-configuration.js'
import { EMBEDDING_DIMENSIONS } from '../src/modules/embedding/embedding-provider.js'
import {
  GEMINI_EMBEDDING_TASK_CALIBRATION_DISTRACTORS,
  GEMINI_EMBEDDING_TASK_CALIBRATION_FIXTURES,
  GEMINI_EMBEDDING_TASK_FIXTURE_TITLE,
  GEMINI_EMBEDDING_TASK_VALIDATION_DISTRACTORS,
  GEMINI_EMBEDDING_TASK_VALIDATION_FIXTURES,
  type GeminiEmbeddingTaskFixture,
} from '../test/fixtures/gemini-embedding-task-selection.fixture.js'

loadEnv({
  path: ['server/.env', '.env', '../.env'],
  quiet: true,
})

const TASKS = ['search result', 'question answering'] as const
type Task = (typeof TASKS)[number]

interface TaskMetrics {
  readonly recallAt5: number
  readonly meanReciprocalRank: number
  readonly topOneAccuracy: number
  readonly meanCosineMargin: number
  readonly minimumCosineMargin: number
  readonly liveSmokeCosineMargin: number
}

interface EvaluationCorpus {
  readonly fixtures: readonly GeminiEmbeddingTaskFixture[]
  readonly documentVectors: readonly (readonly number[])[]
}

async function main(): Promise<void> {
  const env = validateEnv({
    ...process.env,
    EMBEDDING_PROVIDER: 'gemini',
  })
  const apiKey = env.GEMINI_EMBEDDING_API_KEY
  if (apiKey === undefined) {
    throw new Error('Gemini embedding task-selection configuration is invalid')
  }

  const sdk = new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: GEMINI_EMBEDDING_API_VERSION,
      retryOptions: { attempts: 1 },
    },
  })

  const calibrationInputs = buildDocumentInputs(
    GEMINI_EMBEDDING_TASK_CALIBRATION_FIXTURES,
    GEMINI_EMBEDDING_TASK_CALIBRATION_DISTRACTORS,
  )
  const validationInputs = buildDocumentInputs(
    GEMINI_EMBEDDING_TASK_VALIDATION_FIXTURES,
    GEMINI_EMBEDDING_TASK_VALIDATION_DISTRACTORS,
  )
  const allDocumentVectors = await embedInputs(sdk, [
    ...calibrationInputs,
    ...validationInputs,
  ])
  const calibration: EvaluationCorpus = {
    fixtures: GEMINI_EMBEDDING_TASK_CALIBRATION_FIXTURES,
    documentVectors: allDocumentVectors.slice(0, calibrationInputs.length),
  }
  const validation: EvaluationCorpus = {
    fixtures: GEMINI_EMBEDDING_TASK_VALIDATION_FIXTURES,
    documentVectors: allDocumentVectors.slice(calibrationInputs.length),
  }

  const results = Object.fromEntries(
    await Promise.all(
      TASKS.map(async (task) => {
        const queryVectors = await embedInputs(sdk, [
          ...buildQueryInputs(task, calibration.fixtures),
          ...buildQueryInputs(task, validation.fixtures),
        ])
        const calibrationQueryCount = calibration.fixtures.length
        return [
          task,
          {
            calibration: calculateMetrics(
              calibration,
              queryVectors.slice(0, calibrationQueryCount),
            ),
            validation: calculateMetrics(
              validation,
              queryVectors.slice(calibrationQueryCount),
            ),
          },
        ] as const
      }),
    ),
  )

  process.stdout.write(
    `${JSON.stringify({
      provider: 'gemini',
      model: GEMINI_EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      calibrationFixtureCount: calibration.fixtures.length,
      validationFixtureCount: validation.fixtures.length,
      results,
    })}\n`,
  )
}

function buildDocumentInputs(
  fixtures: readonly GeminiEmbeddingTaskFixture[],
  distractors: readonly string[],
): readonly string[] {
  return [
    ...fixtures.map((fixture) =>
      buildGeminiDocumentInput(
        fixture.relevantDocument,
        GEMINI_EMBEDDING_TASK_FIXTURE_TITLE,
      ),
    ),
    ...distractors.map((document) =>
      buildGeminiDocumentInput(document, GEMINI_EMBEDDING_TASK_FIXTURE_TITLE),
    ),
  ]
}

function buildQueryInputs(
  task: Task,
  fixtures: readonly GeminiEmbeddingTaskFixture[],
): readonly string[] {
  return fixtures.map((fixture) => `task: ${task} | query: ${fixture.query}`)
}

async function embedInputs(
  sdk: GoogleGenAI,
  inputs: readonly string[],
): Promise<readonly (readonly number[])[]> {
  const response = await sdk.models.embedContent({
    model: GEMINI_EMBEDDING_MODEL,
    contents: inputs.map((text) => ({ parts: [{ text }] })),
    config: {
      outputDimensionality: GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY,
      httpOptions: {
        apiVersion: GEMINI_EMBEDDING_API_VERSION,
        retryOptions: { attempts: 1 },
      },
    },
  })
  const embeddings: unknown = Reflect.get(response, 'embeddings')
  if (!Array.isArray(embeddings) || embeddings.length !== inputs.length) {
    throw new Error('Gemini embedding task-selection response is invalid')
  }

  return embeddings.map((embedding) => {
    const values: unknown =
      typeof embedding === 'object' && embedding !== null
        ? Reflect.get(embedding, 'values')
        : undefined
    if (
      !Array.isArray(values) ||
      values.length !== EMBEDDING_DIMENSIONS ||
      !values.every(
        (component) =>
          typeof component === 'number' && Number.isFinite(component),
      )
    ) {
      throw new Error('Gemini embedding task-selection vector is invalid')
    }
    return values as number[]
  })
}

function calculateMetrics(
  corpus: EvaluationCorpus,
  queryVectors: readonly (readonly number[])[],
): TaskMetrics {
  const reciprocalRanks: number[] = []
  const margins: number[] = []
  let recalledAt5 = 0
  let topOne = 0

  queryVectors.forEach((queryVector, relevantIndex) => {
    const ranked = corpus.documentVectors
      .map((documentVector, documentIndex) => ({
        documentIndex,
        similarity: cosineSimilarity(queryVector, documentVector),
      }))
      .sort(
        (left, right) =>
          right.similarity - left.similarity ||
          left.documentIndex - right.documentIndex,
      )
    const rank =
      ranked.findIndex(
        (candidate) => candidate.documentIndex === relevantIndex,
      ) + 1
    const relevantSimilarity =
      ranked.find((candidate) => candidate.documentIndex === relevantIndex)
        ?.similarity ?? Number.NEGATIVE_INFINITY
    const strongestIrrelevantSimilarity = Math.max(
      ...ranked
        .filter((candidate) => candidate.documentIndex !== relevantIndex)
        .map((candidate) => candidate.similarity),
    )

    reciprocalRanks.push(1 / rank)
    margins.push(relevantSimilarity - strongestIrrelevantSimilarity)
    if (rank <= 5) {
      recalledAt5 += 1
    }
    if (rank === 1) {
      topOne += 1
    }
  })

  return {
    recallAt5: recalledAt5 / queryVectors.length,
    meanReciprocalRank: mean(reciprocalRanks),
    topOneAccuracy: topOne / queryVectors.length,
    meanCosineMargin: mean(margins),
    minimumCosineMargin: Math.min(...margins),
    liveSmokeCosineMargin:
      margins[
        corpus.fixtures.findIndex(
          (fixture) => fixture.id === 'validation-live-smoke',
        )
      ] ?? Number.NaN,
  }
}

function cosineSimilarity(
  left: readonly number[],
  right: readonly number[],
): number {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftNorm += left[index] * left[index]
    rightNorm += right[index] * right[index]
  }
  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm)
  return denominator === 0 ? 0 : dot / denominator
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
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
