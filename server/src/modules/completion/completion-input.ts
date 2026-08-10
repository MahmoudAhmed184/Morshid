import type {
  CompletionStrategy,
  CompletionContextEntry,
  NonEmptyCompletionContext,
  StaticCodeDiagnosis,
} from './completion-provider'
import {
  COMPLETION_STRATEGIES,
  CompletionProviderError,
} from './completion-provider'

export const MAX_COMPLETION_QUESTION_CODE_POINTS = 4_000
export const MAX_COMPLETION_CONTEXT_ENTRIES = 50
export const MAX_COMPLETION_SOURCE_TITLE_CODE_POINTS = 300
export const MAX_COMPLETION_CONTEXT_ENTRY_CODE_POINTS = 8_000
export const MAX_COMPLETION_CONTEXT_CODE_POINTS = 32_000

const GROUNDED_COMPLETION_INPUT_KEYS = ['studentQuestion', 'context'] as const
const DIAGNOSIS_COMPLETION_INPUT_KEYS = [
  'studentQuestion',
  'context',
  'diagnosis',
] as const
const CONTEXT_ENTRY_KEYS = ['sourceTitle', 'chunkIndex', 'content'] as const
const DIAGNOSIS_KEYS = [
  'likelyDefect',
  'location',
  'conceptExplanation',
  'nextInspectionStep',
] as const

export interface GroundedExplanationCompletionInput {
  readonly studentQuestion: string
  readonly context: NonEmptyCompletionContext
}

export interface CodeDiagnosisCompletionInput extends GroundedExplanationCompletionInput {
  readonly diagnosis: StaticCodeDiagnosis
}

export type GroundedCompletionInput =
  GroundedExplanationCompletionInput | CodeDiagnosisCompletionInput

export type SnapshottedCompletionRequest = GroundedCompletionInput & {
  readonly strategy: CompletionStrategy
  readonly signal?: AbortSignal
}

// This is the single ownership point for the provider input contract. It reads
// every untrusted allowed value once, copies it into inert data, and enforces
// code-point budgets before normalization or envelope serialization occurs.
export function snapshotCompletionRequest(
  value: unknown,
): SnapshottedCompletionRequest {
  let errorCode: 'COMPLETION_INVALID_REQUEST' | 'COMPLETION_EMPTY_CONTEXT' =
    'COMPLETION_INVALID_REQUEST'

  try {
    const record = requireRecord(value)
    const studentQuestion = Reflect.get(record, 'studentQuestion')
    const context = Reflect.get(record, 'context')
    const strategy = Reflect.get(record, 'strategy')
    const diagnosis = Reflect.get(record, 'diagnosis')
    const signal = Reflect.get(record, 'signal')
    const resolvedStrategy = snapshotCompletionStrategy(strategy)
    const snapshot = snapshotCompletionInputValues(
      studentQuestion,
      context,
      () => {
        errorCode = 'COMPLETION_EMPTY_CONTEXT'
      },
      resolvedStrategy,
      diagnosis,
    )

    if (signal !== undefined && !isGenuineAbortSignal(signal)) {
      throw new TypeError('Invalid signal')
    }

    return Object.freeze({
      ...snapshot,
      strategy: resolvedStrategy,
      ...(signal === undefined ? {} : { signal }),
    })
  } catch {
    throw new CompletionProviderError(errorCode)
  }
}

export function snapshotGroundedCompletionInput(
  value: unknown,
): GroundedCompletionInput {
  try {
    const record = requireRecord(value)
    const codeDiagnosis = Object.hasOwn(record, 'diagnosis')
    requireExactKeys(
      record,
      codeDiagnosis
        ? DIAGNOSIS_COMPLETION_INPUT_KEYS
        : GROUNDED_COMPLETION_INPUT_KEYS,
    )
    const studentQuestion = Reflect.get(record, 'studentQuestion')
    const context = Reflect.get(record, 'context')
    const diagnosis = Reflect.get(record, 'diagnosis')

    return snapshotCompletionInputValues(
      studentQuestion,
      context,
      () => {
        throw new TypeError('Empty context')
      },
      codeDiagnosis ? 'PYTHON_CODE_DIAGNOSIS' : 'GROUNDED_EXPLANATION',
      diagnosis,
    )
  } catch {
    throw new CompletionProviderError('COMPLETION_INVALID_REQUEST')
  }
}

export function hasAtMostCodePoints(value: string, maximum: number): boolean {
  let codePoints = 0
  for (let index = 0; index < value.length; index += 1) {
    const firstCodeUnit = value.charCodeAt(index)
    if (
      firstCodeUnit >= 0xd800 &&
      firstCodeUnit <= 0xdbff &&
      index + 1 < value.length
    ) {
      const secondCodeUnit = value.charCodeAt(index + 1)
      if (secondCodeUnit >= 0xdc00 && secondCodeUnit <= 0xdfff) {
        index += 1
      }
    }

    codePoints += 1
    if (codePoints > maximum) {
      return false
    }
  }

  return true
}

export function readAbortSignalAborted(signal: AbortSignal): boolean {
  const abortedDescriptor = Object.getOwnPropertyDescriptor(
    AbortSignal.prototype,
    'aborted',
  )
  if (abortedDescriptor?.get === undefined) {
    throw new TypeError('AbortSignal.aborted is unavailable')
  }

  const aborted: unknown = abortedDescriptor.get.call(signal)
  if (typeof aborted !== 'boolean') {
    throw new TypeError('Invalid AbortSignal state')
  }
  return aborted
}

function snapshotCompletionInputValues(
  studentQuestionValue: unknown,
  contextValue: unknown,
  onEmptyContext: () => void,
  strategy: CompletionStrategy,
  diagnosisValue: unknown,
): GroundedCompletionInput {
  if (
    !isNonBlankStringWithin(
      studentQuestionValue,
      MAX_COMPLETION_QUESTION_CODE_POINTS,
    )
  ) {
    throw new TypeError('Invalid question')
  }

  if (!Array.isArray(contextValue)) {
    throw new TypeError('Invalid context')
  }

  const length = Reflect.get(contextValue, 'length')
  if (
    typeof length !== 'number' ||
    !Number.isSafeInteger(length) ||
    length < 0
  ) {
    throw new TypeError('Invalid context length')
  }
  if (length === 0) {
    onEmptyContext()
    throw new TypeError('Empty context')
  }
  if (length > MAX_COMPLETION_CONTEXT_ENTRIES) {
    throw new TypeError('Oversized context')
  }

  requireDenseArrayKeys(contextValue, length)

  const entries: CompletionContextEntry[] = []
  let aggregateCodePoints = 0
  for (let index = 0; index < length; index += 1) {
    const entryValue: unknown = Reflect.get(contextValue, String(index))
    const entry = snapshotContextEntry(entryValue)
    aggregateCodePoints += countCodePoints(entry.sourceTitle)
    aggregateCodePoints += countCodePoints(entry.content)
    if (aggregateCodePoints > MAX_COMPLETION_CONTEXT_CODE_POINTS) {
      throw new TypeError('Oversized aggregate context')
    }
    entries.push(entry)
  }

  const base = Object.freeze({
    studentQuestion: studentQuestionValue,
    context: Object.freeze(entries) as NonEmptyCompletionContext,
  })

  if (strategy === 'GROUNDED_EXPLANATION') {
    if (diagnosisValue !== undefined) {
      throw new TypeError('Unexpected diagnosis')
    }
    return base
  }

  return Object.freeze({
    ...base,
    diagnosis: snapshotStaticCodeDiagnosis(diagnosisValue),
  })
}

function snapshotCompletionStrategy(value: unknown): CompletionStrategy {
  if (value === undefined) {
    return 'GROUNDED_EXPLANATION'
  }
  if (
    typeof value !== 'string' ||
    !COMPLETION_STRATEGIES.includes(value as CompletionStrategy)
  ) {
    throw new TypeError('Invalid strategy')
  }
  return value as CompletionStrategy
}

function snapshotStaticCodeDiagnosis(value: unknown): StaticCodeDiagnosis {
  const record = requireExactRecord(value, DIAGNOSIS_KEYS)
  const likelyDefect = Reflect.get(record, 'likelyDefect')
  const location = Reflect.get(record, 'location')
  const conceptExplanation = Reflect.get(record, 'conceptExplanation')
  const nextInspectionStep = Reflect.get(record, 'nextInspectionStep')

  if (
    !isNonBlankStringWithin(likelyDefect, 1_000) ||
    !isNonBlankStringWithin(location, 500) ||
    !isNonBlankStringWithin(conceptExplanation, 2_000) ||
    !isNonBlankStringWithin(nextInspectionStep, 1_000)
  ) {
    throw new TypeError('Invalid diagnosis')
  }

  return Object.freeze({
    likelyDefect,
    location,
    conceptExplanation,
    nextInspectionStep,
  })
}

function snapshotContextEntry(value: unknown): CompletionContextEntry {
  const record = requireExactRecord(value, CONTEXT_ENTRY_KEYS)
  const sourceTitle = Reflect.get(record, 'sourceTitle')
  const chunkIndex = Reflect.get(record, 'chunkIndex')
  const content = Reflect.get(record, 'content')

  if (
    !isNonBlankStringWithin(
      sourceTitle,
      MAX_COMPLETION_SOURCE_TITLE_CODE_POINTS,
    ) ||
    typeof chunkIndex !== 'number' ||
    !Number.isSafeInteger(chunkIndex) ||
    chunkIndex < 0 ||
    !isNonBlankStringWithin(content, MAX_COMPLETION_CONTEXT_ENTRY_CODE_POINTS)
  ) {
    throw new TypeError('Invalid context entry')
  }

  return Object.freeze({
    sourceTitle,
    chunkIndex,
    content,
  })
}

function requireRecord(value: unknown): Record<PropertyKey, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected record')
  }

  return value as Record<PropertyKey, unknown>
}

function requireExactRecord<const Key extends string>(
  value: unknown,
  allowedKeys: readonly Key[],
): Record<Key, unknown> {
  const record = requireRecord(value)
  requireExactKeys(record, allowedKeys)

  return record
}

function requireExactKeys(
  record: Record<PropertyKey, unknown>,
  allowedKeys: readonly string[],
): void {
  const ownKeys = Reflect.ownKeys(record)
  if (
    ownKeys.length !== allowedKeys.length ||
    !ownKeys.every(
      (key) => typeof key === 'string' && allowedKeys.includes(key),
    )
  ) {
    throw new TypeError('Unexpected record keys')
  }
}

function requireDenseArrayKeys(
  value: readonly unknown[],
  length: number,
): void {
  const ownKeys = Reflect.ownKeys(value)
  if (ownKeys.length !== length + 1 || !ownKeys.includes('length')) {
    throw new TypeError('Unexpected context keys')
  }

  for (let index = 0; index < length; index += 1) {
    if (!ownKeys.includes(String(index))) {
      throw new TypeError('Sparse context')
    }
  }
}

function isNonBlankStringWithin(
  value: unknown,
  maximumCodePoints: number,
): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    hasAtMostCodePoints(value, maximumCodePoints)
  )
}

function countCodePoints(value: string): number {
  let codePoints = 0
  for (let index = 0; index < value.length; index += 1) {
    const firstCodeUnit = value.charCodeAt(index)
    if (
      firstCodeUnit >= 0xd800 &&
      firstCodeUnit <= 0xdbff &&
      index + 1 < value.length
    ) {
      const secondCodeUnit = value.charCodeAt(index + 1)
      if (secondCodeUnit >= 0xdc00 && secondCodeUnit <= 0xdfff) {
        index += 1
      }
    }
    codePoints += 1
  }

  return codePoints
}

function isGenuineAbortSignal(value: unknown): value is AbortSignal {
  if (!(value instanceof AbortSignal)) {
    return false
  }

  readAbortSignalAborted(value)
  return true
}
