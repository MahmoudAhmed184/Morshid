import { Inject, Injectable, Optional } from '@nestjs/common'

import {
  readUpstreamFailure,
  waitForRetry,
} from '../../../../platform/ai/upstream/upstream-retry-policy'
import {
  DEBUGGING_DIAGNOSIS_SCHEMA_VERSION,
  parseDebuggingDiagnosis,
  type DebuggingDiagnosis,
  type EvidenceReference,
} from './debugging-diagnosis.contract'
import {
  DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE,
  DEBUGGING_DIAGNOSIS_MODEL_PORT,
  DebuggingDiagnosisModelError,
  type DebuggingDiagnosisModelPort,
  type DebuggingDiagnosisModelResponse,
} from './debugging-diagnosis-model.port'
import { debuggingDiagnosisModelOutputSchema } from './debugging-diagnosis-model.schema'
import { validateDebuggingDiagnosisModelOutput } from './debugging-diagnosis-model.validator'
import { buildDebuggingDiagnosisModelRequest } from './debugging-diagnosis.prompt'
import {
  DEBUGGING_DIAGNOSIS_RETRY_POLICY,
  DebuggingDiagnosisRetryPolicy,
} from './debugging-diagnosis-retry.policy'
import {
  DebuggingDiagnosisRepository,
  type PersistedDebuggingDiagnosis,
} from './debugging-diagnosis.repository'
import { prepareDebuggingGuidance } from './debugging-guidance.strategy'

const FALLBACK_REASON = {
  NO_DETERMINISTIC_MATCH: 'NO_DETERMINISTIC_MATCH',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  MODEL_RATE_LIMITED: 'MODEL_RATE_LIMITED',
  MODEL_TRANSPORT_FAILURE: 'MODEL_TRANSPORT_FAILURE',
  MODEL_MALFORMED: 'MODEL_MALFORMED',
  MODEL_VALIDATION_FAILED: 'MODEL_VALIDATION_FAILED',
  MODEL_LOW_CONFIDENCE: 'MODEL_LOW_CONFIDENCE',
  MODEL_UNCERTAIN: 'MODEL_UNCERTAIN',
} as const

export type DebuggingDiagnosisServiceResult =
  | {
      readonly success: true
      readonly diagnosis: PersistedDebuggingDiagnosis
      readonly reused: boolean
    }
  | {
      readonly success: false
      readonly errorCode: 'DEBUGGING_DIAGNOSIS_RELATIONSHIP_MISMATCH'
    }

@Injectable()
export class DebuggingDiagnosisService {
  constructor(
    private readonly repository: DebuggingDiagnosisRepository,
    @Optional()
    @Inject(DEBUGGING_DIAGNOSIS_MODEL_PORT)
    private readonly modelPort?: DebuggingDiagnosisModelPort,
    @Optional()
    @Inject(DEBUGGING_DIAGNOSIS_RETRY_POLICY)
    private readonly retryPolicy: DebuggingDiagnosisRetryPolicy = new DebuggingDiagnosisRetryPolicy(),
  ) {}

  async resolve(input: {
    attemptId: string
    studentMessageId: string
    studentMessage: string
  }): Promise<DebuggingDiagnosisServiceResult> {
    const existing = await this.repository.findByAttemptId(input.attemptId)
    if (existing !== null) {
      if (existing.location.messageId !== input.studentMessageId) {
        return {
          success: false,
          errorCode: 'DEBUGGING_DIAGNOSIS_RELATIONSHIP_MISMATCH',
        }
      }
      return { success: true, diagnosis: existing, reused: true }
    }

    const prepared = prepareDebuggingGuidance(input.studentMessage)
    const language = languageFromStudentMessage(input.studentMessage)
    const resolution =
      prepared !== null && prepared.resolution === 'MATCH'
        ? deterministicDiagnosis(input.studentMessageId, input.studentMessage, {
            likelyDefect: prepared.diagnosis.likelyDefect,
            category: categoryFor(prepared.suspectedCategory),
            concept: prepared.diagnosis.conceptExplanation,
            inspectionGoal: prepared.diagnosis.nextInspectionStep,
            location: prepared.diagnosis.location,
          })
        : await this.modelDiagnosis({
            studentMessageId: input.studentMessageId,
            studentMessage: input.studentMessage,
            language,
          })

    const stored = await this.repository.store({
      attemptId: input.attemptId,
      studentMessageId: input.studentMessageId,
      diagnosis: resolution.diagnosis,
      fallbackReason: resolution.fallbackReason,
      provenance: resolution.provenance,
    })
    if (stored.kind === 'relationship_mismatch') {
      return {
        success: false,
        errorCode: 'DEBUGGING_DIAGNOSIS_RELATIONSHIP_MISMATCH',
      }
    }
    return {
      success: true,
      diagnosis: stored.diagnosis,
      reused: stored.kind === 'reused',
    }
  }

  private async modelDiagnosis(input: {
    studentMessageId: string
    studentMessage: string
    language: string | null
  }): Promise<DiagnosisResolution> {
    const content = extractDiagnosisContent(input.studentMessage)
    if (this.modelPort === undefined) {
      return uncertainDiagnosis(
        input.studentMessageId,
        input.language,
        FALLBACK_REASON.MODEL_UNAVAILABLE,
      )
    }

    const request = buildDebuggingDiagnosisModelRequest({
      language: input.language,
      code: content.code,
      symptom: content.symptom,
      codeLineCount: content.codeLineCount,
    })

    let retriesUsed = 0
    let response: DebuggingDiagnosisModelResponse
    for (;;) {
      try {
        response = await this.modelPort.diagnose(request)
        break
      } catch (error) {
        const upstreamFailure = readUpstreamFailure(error, Date.now())
        if (
          upstreamFailure.retryable &&
          this.retryPolicy.canRetry(error, retriesUsed)
        ) {
          retriesUsed += 1
          await waitForRetry(
            upstreamFailure.retryDelayMs,
            new AbortController().signal,
            () =>
              new DebuggingDiagnosisModelError(
                DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.CANCELLED,
              ),
          )
          continue
        }

        return uncertainDiagnosis(
          input.studentMessageId,
          input.language,
          fallbackReasonFromModelError(error),
          provenanceFromModelError(error, retriesUsed),
        )
      }
    }

    const parsed = debuggingDiagnosisModelOutputSchema.safeParse(
      response.rawOutput,
    )
    if (!parsed.success) {
      return uncertainDiagnosis(
        input.studentMessageId,
        input.language,
        FALLBACK_REASON.MODEL_MALFORMED,
        provenanceFromResponse(response, retriesUsed),
      )
    }
    if (parsed.data.status === 'UNCERTAIN') {
      return uncertainDiagnosis(
        input.studentMessageId,
        input.language,
        FALLBACK_REASON.MODEL_UNCERTAIN,
        provenanceFromResponse(response, retriesUsed),
      )
    }

    const violations = validateDebuggingDiagnosisModelOutput(
      parsed.data,
      content,
    )
    if (violations.length > 0) {
      return uncertainDiagnosis(
        input.studentMessageId,
        input.language,
        parsed.data.evidenceReferences.length === 0
          ? FALLBACK_REASON.MODEL_LOW_CONFIDENCE
          : FALLBACK_REASON.MODEL_VALIDATION_FAILED,
        provenanceFromResponse(response, retriesUsed),
      )
    }

    const location = mapEvidenceReference(
      input.studentMessageId,
      parsed.data.location.lineStart,
      parsed.data.location.lineEnd,
      parsed.data.location.kind,
      content,
    )
    const evidence = parsed.data.evidenceReferences.map((reference) =>
      mapEvidenceReference(
        input.studentMessageId,
        reference.lineStart,
        reference.lineEnd,
        reference.source,
        content,
      ),
    )
    return {
      diagnosis: parseDebuggingDiagnosis({
        schemaVersion: DEBUGGING_DIAGNOSIS_SCHEMA_VERSION,
        status: 'RESOLVED',
        source: 'MODEL',
        language: input.language,
        category: parsed.data.category,
        confidence: 'MEDIUM',
        likelyDefect: parsed.data.likelyDefect,
        location,
        evidence,
        underlyingConcept: parsed.data.underlyingConcept,
        requiresRuntimeEvidence: parsed.data.requiresRuntimeEvidence,
        runtimeEvidenceNeeded: parsed.data.runtimeEvidenceNeeded,
        inspectionGoal: parsed.data.inspectionGoal,
      }),
      fallbackReason: null,
      provenance: provenanceFromResponse(response, retriesUsed),
    }
  }
}

interface DiagnosisResolution {
  readonly diagnosis: DebuggingDiagnosis
  readonly fallbackReason: string | null
  readonly provenance: DiagnosisProvenance
}

interface DiagnosisProvenance {
  readonly provider: string | null
  readonly model: string | null
  readonly promptVersion: string | null
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly infrastructureRetryCount: number
}

function deterministicDiagnosis(
  messageId: string,
  studentMessage: string,
  input: {
    likelyDefect: string
    category: DebuggingDiagnosis['category']
    concept: string
    inspectionGoal: string
    location: string
  },
): DiagnosisResolution {
  const line = lineFromLocation(studentMessage, input.location)
  const location = evidenceReference(messageId, line, line, 'CODE')
  return {
    diagnosis: parseDebuggingDiagnosis({
      schemaVersion: DEBUGGING_DIAGNOSIS_SCHEMA_VERSION,
      status: 'RESOLVED',
      source: 'DETERMINISTIC',
      language: languageFromStudentMessage(studentMessage),
      category: input.category,
      confidence: 'HIGH',
      likelyDefect: input.likelyDefect,
      location,
      evidence: [location],
      underlyingConcept: input.concept,
      requiresRuntimeEvidence: false,
      runtimeEvidenceNeeded: 'NONE',
      inspectionGoal: input.inspectionGoal,
    }),
    fallbackReason: null,
    provenance: emptyProvenance(),
  }
}

function uncertainDiagnosis(
  messageId: string,
  language: string | null,
  fallbackReason: (typeof FALLBACK_REASON)[keyof typeof FALLBACK_REASON],
  provenance: DiagnosisProvenance = emptyProvenance(),
): DiagnosisResolution {
  const location = evidenceReference(messageId, null, null, 'SYMPTOM')
  return {
    diagnosis: parseDebuggingDiagnosis({
      schemaVersion: DEBUGGING_DIAGNOSIS_SCHEMA_VERSION,
      status: 'UNCERTAIN',
      source: 'FALLBACK',
      language,
      category: 'UNKNOWN',
      confidence: 'LOW',
      likelyDefect: null,
      location,
      evidence: [location],
      underlyingConcept: null,
      requiresRuntimeEvidence: true,
      runtimeEvidenceNeeded: 'TRACE_VALUES',
      inspectionGoal:
        'Trace one input that shows the reported behavior and identify the first value that differs from the expected result.',
    }),
    fallbackReason,
    provenance,
  }
}

function provenanceFromResponse(
  response: DebuggingDiagnosisModelResponse,
  infrastructureRetryCount: number,
): DiagnosisProvenance {
  return {
    provider: response.provider,
    model: response.model,
    promptVersion: response.promptVersion,
    inputTokens: response.inputTokens ?? null,
    outputTokens: response.outputTokens ?? null,
    infrastructureRetryCount,
  }
}

function provenanceFromModelError(
  error: unknown,
  infrastructureRetryCount: number,
): DiagnosisProvenance {
  if (error instanceof DebuggingDiagnosisModelError) {
    return {
      provider: error.provider ?? null,
      model: error.model ?? null,
      promptVersion: 'debugging-diagnosis.v1',
      inputTokens: null,
      outputTokens: null,
      infrastructureRetryCount,
    }
  }
  return provenanceFromRetryCount(infrastructureRetryCount)
}

function provenanceFromRetryCount(
  infrastructureRetryCount: number,
): DiagnosisProvenance {
  return {
    ...emptyProvenance(),
    infrastructureRetryCount,
  }
}

function emptyProvenance(): DiagnosisProvenance {
  return {
    provider: null,
    model: null,
    promptVersion: null,
    inputTokens: null,
    outputTokens: null,
    infrastructureRetryCount: 0,
  }
}

function fallbackReasonFromModelError(
  error: unknown,
): (typeof FALLBACK_REASON)[keyof typeof FALLBACK_REASON] {
  if (!(error instanceof DebuggingDiagnosisModelError)) {
    return FALLBACK_REASON.MODEL_TRANSPORT_FAILURE
  }
  switch (error.code) {
    case DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.RATE_LIMITED:
      return FALLBACK_REASON.MODEL_RATE_LIMITED
    case DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.MALFORMED_OUTPUT:
    case DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.UNSUPPORTED_RESPONSE:
      return FALLBACK_REASON.MODEL_MALFORMED
    case DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE:
    case DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.CANCELLED:
    case DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.CONFIGURATION_INVALID:
      return FALLBACK_REASON.MODEL_UNAVAILABLE
    case DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.TIMEOUT:
    case DEBUGGING_DIAGNOSIS_MODEL_ERROR_CODE.TRANSPORT_FAILURE:
      return FALLBACK_REASON.MODEL_TRANSPORT_FAILURE
  }
}

function evidenceReference(
  messageId: string,
  lineStart: number | null,
  lineEnd: number | null,
  kind: EvidenceReference['kind'],
): EvidenceReference {
  return { messageId, lineStart, lineEnd, kind }
}

function mapEvidenceReference(
  messageId: string,
  lineStart: number | null,
  lineEnd: number | null,
  kind: EvidenceReference['kind'],
  content: ExtractedDiagnosisContent,
): EvidenceReference {
  if (lineStart === null || lineEnd === null) {
    return { messageId, lineStart: null, lineEnd: null, kind }
  }
  const offset =
    kind === 'CODE' ? content.codeLineOffset : content.symptomLineOffset
  return {
    messageId,
    lineStart: lineStart + offset,
    lineEnd: lineEnd + offset,
    kind,
  }
}

export interface ExtractedDiagnosisContent {
  readonly code: string
  readonly symptom: string
  readonly codeLineCount: number
  readonly codeLineOffset: number
  readonly symptomLineOffset: number
}

function extractDiagnosisContent(
  studentMessage: string,
): ExtractedDiagnosisContent {
  const normalized = studentMessage
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
  const fencedMatch = /```[^\r\n`]*\n([\s\S]*?)```/u.exec(normalized)

  if (fencedMatch !== null) {
    const rawCode = fencedMatch[1]
    const codeIndex = normalized.indexOf(rawCode, fencedMatch.index)
    const codeLineOffset = normalized.slice(0, codeIndex).split('\n').length - 1
    const code = rawCode.trimEnd()
    const codeLines = code.split('\n')

    const symptomText = (
      normalized.slice(0, fencedMatch.index) +
      normalized.slice(fencedMatch.index + fencedMatch[0].length)
    ).trim()

    const symptomIndex =
      symptomText.length > 0 ? normalized.indexOf(symptomText) : -1
    const symptomLineOffset =
      symptomIndex >= 0
        ? normalized.slice(0, symptomIndex).split('\n').length - 1
        : 0

    return {
      code,
      symptom: symptomText !== '' ? symptomText : normalized,
      codeLineCount: codeLines.length,
      codeLineOffset,
      symptomLineOffset,
    }
  }

  const lines = normalized.split('\n')
  const codeLineIndices: number[] = []
  const symptomLineIndices: number[] = []

  for (let i = 0; i < lines.length; i++) {
    if (isCodeLine(lines[i])) {
      codeLineIndices.push(i)
    } else if (lines[i].trim() !== '') {
      symptomLineIndices.push(i)
    }
  }

  if (codeLineIndices.length === 0) {
    return {
      code: normalized,
      symptom: normalized,
      codeLineCount: lines.length,
      codeLineOffset: 0,
      symptomLineOffset: 0,
    }
  }

  const firstCodeIdx = codeLineIndices[0]
  const lastCodeIdx = codeLineIndices[codeLineIndices.length - 1]
  const codeLines: string[] = []
  for (let i = firstCodeIdx; i <= lastCodeIdx; i++) {
    codeLines.push(lines[i])
  }

  const codeText = codeLines.join('\n')
  const symptomText = symptomLineIndices
    .map((i) => lines[i])
    .join('\n')
    .trim()
  const symptomFirstIdx =
    symptomLineIndices.length > 0 ? symptomLineIndices[0] : 0

  return {
    code: codeText,
    symptom: symptomText !== '' ? symptomText : normalized,
    codeLineCount: codeLines.length,
    codeLineOffset: firstCodeIdx,
    symptomLineOffset: symptomFirstIdx,
  }
}

function isCodeLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed === '') return false
  if (/^\s+/u.test(line)) return true
  if (
    /^\s*(?:def|class|import|from|return|for|while|if|elif|else|try|except|finally|with|raise|pass|break|continue|yield|async|await)\b/u.test(
      line,
    )
  ) {
    return true
  }
  if (/^\s*#\s*/u.test(line)) return true
  if (/^\s*[\w.]+\s*=/u.test(line)) return true
  if (/:\s*$/u.test(trimmed)) return true
  if (/^\s*[}\])]/.test(line)) return true
  return false
}

function categoryFor(category: string): DebuggingDiagnosis['category'] {
  switch (category) {
    case 'SYNTAX':
      return 'SYNTAX'
    case 'NAME_LOOKUP':
      return 'NAME_REFERENCE'
    case 'INDEX_ACCESS':
      return 'COLLECTION_INDEX'
    case 'LOOP_OR_INDENTATION':
      return 'NESTED_CONTROL_FLOW'
    case 'FUNCTION_USAGE':
      return 'CALL_SIGNATURE'
    case 'DICTIONARY_ACCESS':
      return 'COLLECTION_INDEX'
    case 'STRING_HANDLING':
      return 'TYPE_COMPATIBILITY'
    case 'FILE_HANDLING':
      return 'SYNTAX'
    default:
      return 'UNKNOWN'
  }
}

function lineFromLocation(
  studentMessage: string,
  location: string,
): number | null {
  const match = /\bLine\s+(\d+)/u.exec(location)
  if (match !== null) {
    const line = Number(match[1])
    return Number.isSafeInteger(line) && line > 0 ? line : null
  }
  const lines = studentMessage.replaceAll('\r\n', '\n').split('\n')
  if (location.includes('return expression'))
    return lineContaining(lines, /\breturn\b/u)
  if (location.includes('function header'))
    return lineContaining(lines, /^\s*(?:async\s+)?def\s+/u)
  if (location.includes('loop body'))
    return lineContaining(lines, /^\s*(?:for|while)\b/u)
  return null
}

function lineContaining(
  lines: readonly string[],
  pattern: RegExp,
): number | null {
  const index = lines.findIndex((line) => pattern.test(line))
  return index < 0 ? null : index + 1
}

function languageFromStudentMessage(studentMessage: string): string | null {
  const match = /```([^\r\n`]*)\r?\n/u.exec(studentMessage)
  const language = match?.[1]?.trim().toLowerCase()
  return language === undefined || language === '' ? null : language
}

export { FALLBACK_REASON, extractDiagnosisContent }
