import { Injectable } from '@nestjs/common'

import { Prisma } from '../../../../generated/prisma/client'
import { PrismaService } from '../../../../platform/database/prisma.service'
import {
  parseDebuggingDiagnosis,
  type DebuggingDiagnosis,
} from './debugging-diagnosis.contract'

export interface PersistedDebuggingDiagnosis extends DebuggingDiagnosis {
  readonly id: string
  readonly tutoringAttemptId: string
  readonly fallbackReason: string | null
  readonly provider: string | null
  readonly model: string | null
  readonly promptVersion: string | null
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly infrastructureRetryCount: number
  readonly createdAt: Date
}

export type StoreDebuggingDiagnosisResult =
  | {
      readonly kind: 'created'
      readonly diagnosis: PersistedDebuggingDiagnosis
    }
  | { readonly kind: 'reused'; readonly diagnosis: PersistedDebuggingDiagnosis }
  | { readonly kind: 'relationship_mismatch' }

export abstract class DebuggingDiagnosisRepository {
  abstract findByAttemptId(
    attemptId: string,
  ): Promise<PersistedDebuggingDiagnosis | null>

  abstract store(input: {
    attemptId: string
    studentMessageId: string
    diagnosis: DebuggingDiagnosis
    fallbackReason: string | null
    provenance: {
      provider: string | null
      model: string | null
      promptVersion: string | null
      inputTokens: number | null
      outputTokens: number | null
      infrastructureRetryCount: number
    }
  }): Promise<StoreDebuggingDiagnosisResult>
}

const diagnosisSelect = {
  id: true,
  tutoringAttemptId: true,
  schemaVersion: true,
  status: true,
  source: true,
  language: true,
  category: true,
  confidence: true,
  likelyDefect: true,
  locationMessageId: true,
  lineStart: true,
  lineEnd: true,
  locationKind: true,
  evidence: true,
  underlyingConcept: true,
  requiresRuntimeEvidence: true,
  runtimeEvidenceNeeded: true,
  inspectionGoal: true,
  fallbackReason: true,
  provider: true,
  model: true,
  promptVersion: true,
  inputTokens: true,
  outputTokens: true,
  infrastructureRetryCount: true,
  createdAt: true,
} satisfies Prisma.DebuggingDiagnosisSelect

type DebuggingDiagnosisSelected = Prisma.DebuggingDiagnosisGetPayload<{
  select: typeof diagnosisSelect
}>

@Injectable()
export class PrismaDebuggingDiagnosisRepository extends DebuggingDiagnosisRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async findByAttemptId(
    attemptId: string,
  ): Promise<PersistedDebuggingDiagnosis | null> {
    const record = await this.prismaService.debuggingDiagnosis.findUnique({
      where: { tutoringAttemptId: attemptId },
      select: diagnosisSelect,
    })
    return record === null ? null : mapDebuggingDiagnosis(record)
  }

  async store(input: {
    attemptId: string
    studentMessageId: string
    diagnosis: DebuggingDiagnosis
    fallbackReason: string | null
    provenance: {
      provider: string | null
      model: string | null
      promptVersion: string | null
      inputTokens: number | null
      outputTokens: number | null
      infrastructureRetryCount: number
    }
  }): Promise<StoreDebuggingDiagnosisResult> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const attempt = await tx.tutoringAttempt.findUnique({
          where: { id: input.attemptId },
          select: { studentMessageId: true },
        })
        if (attempt?.studentMessageId !== input.studentMessageId) {
          return { kind: 'relationship_mismatch' } as const
        }

        const existing = await tx.debuggingDiagnosis.findUnique({
          where: { tutoringAttemptId: input.attemptId },
          select: diagnosisSelect,
        })
        if (existing !== null) {
          return {
            kind: 'reused',
            diagnosis: mapDebuggingDiagnosis(existing),
          } as const
        }

        const created = await tx.debuggingDiagnosis.create({
          data: {
            tutoringAttemptId: input.attemptId,
            schemaVersion: input.diagnosis.schemaVersion,
            status: input.diagnosis.status,
            source: input.diagnosis.source,
            language: input.diagnosis.language,
            category: input.diagnosis.category,
            confidence: input.diagnosis.confidence,
            likelyDefect: input.diagnosis.likelyDefect,
            locationMessageId: input.diagnosis.location.messageId,
            lineStart: input.diagnosis.location.lineStart,
            lineEnd: input.diagnosis.location.lineEnd,
            locationKind: input.diagnosis.location.kind,
            evidence: input.diagnosis.evidence,
            underlyingConcept: input.diagnosis.underlyingConcept,
            requiresRuntimeEvidence: input.diagnosis.requiresRuntimeEvidence,
            runtimeEvidenceNeeded: input.diagnosis.runtimeEvidenceNeeded,
            inspectionGoal: input.diagnosis.inspectionGoal,
            fallbackReason: input.fallbackReason,
            provider: input.provenance.provider,
            model: input.provenance.model,
            promptVersion: input.provenance.promptVersion,
            inputTokens: input.provenance.inputTokens,
            outputTokens: input.provenance.outputTokens,
            infrastructureRetryCount: input.provenance.infrastructureRetryCount,
          },
          select: diagnosisSelect,
        })
        return {
          kind: 'created',
          diagnosis: mapDebuggingDiagnosis(created),
        } as const
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await this.prismaService.debuggingDiagnosis.findUnique(
          {
            where: { tutoringAttemptId: input.attemptId },
            select: diagnosisSelect,
          },
        )
        if (existing !== null) {
          return { kind: 'reused', diagnosis: mapDebuggingDiagnosis(existing) }
        }
      }
      throw error
    }
  }
}

function mapDebuggingDiagnosis(
  record: DebuggingDiagnosisSelected,
): PersistedDebuggingDiagnosis {
  return Object.freeze({
    id: record.id,
    tutoringAttemptId: record.tutoringAttemptId,
    ...parseDebuggingDiagnosis({
      schemaVersion: record.schemaVersion,
      status: record.status,
      source: record.source,
      language: record.language,
      category: record.category,
      confidence: record.confidence,
      likelyDefect: record.likelyDefect,
      location: {
        messageId: record.locationMessageId,
        lineStart: record.lineStart,
        lineEnd: record.lineEnd,
        kind: record.locationKind,
      },
      evidence: record.evidence,
      underlyingConcept: record.underlyingConcept,
      requiresRuntimeEvidence: record.requiresRuntimeEvidence,
      runtimeEvidenceNeeded: record.runtimeEvidenceNeeded,
      inspectionGoal: record.inspectionGoal,
    }),
    fallbackReason: record.fallbackReason,
    provider: record.provider,
    model: record.model,
    promptVersion: record.promptVersion,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    infrastructureRetryCount: record.infrastructureRetryCount,
    createdAt: record.createdAt,
  })
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}
