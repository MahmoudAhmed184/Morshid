import { Injectable } from '@nestjs/common'

import {
  EducationalAnalysisEvidenceKind,
  Prisma,
} from '../../../generated/prisma/client'
import { PrismaService } from '../../../platform/database/prisma.service'
import type { AnalysisModelResponse } from './analysis-model.port'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
  type EducationalAnalysisFallbackReason,
  type EducationalAnalysisResult,
  type EducationalAnalysisSource,
} from './educational-analysis.types'

export interface EducationalAnalysisIdentity {
  attemptId: string
  topicId: string
  studentMessageId: string
}

export interface PersistEducationalAnalysisMetadata {
  analysisSource: EducationalAnalysisSource
  fallbackReason: EducationalAnalysisFallbackReason | null
  failureCategory: string | null
  confidencePolicyVersion: string | null
  infrastructureRetryCount: number
}

export interface PersistEducationalAnalysisInput extends EducationalAnalysisIdentity {
  result: EducationalAnalysisResult
  modelResponse: AnalysisModelResponse
  forceReanalysis: boolean
  metadata?: PersistEducationalAnalysisMetadata
}

export interface PersistedEducationalAnalysisRecord extends EducationalAnalysisIdentity {
  id: string
  attempt: number
  result: EducationalAnalysisResult
  provider: string
  model: string
  modelVersion: string | null
  promptVersion: string
  schemaVersion: string
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number | null
  analysisSource: EducationalAnalysisSource
  fallbackReason: EducationalAnalysisFallbackReason | null
  failureCategory: string | null
  confidencePolicyVersion: string | null
  infrastructureRetryCount: number
  evidenceLinks: PersistedEducationalAnalysisEvidenceLink[]
  misconceptionRecords: PersistedEducationalAnalysisMisconception[]
  createdAt: Date
}

export interface PersistedEducationalAnalysisEvidenceLink {
  id: string
  messageId: string
  kind: EducationalAnalysisEvidenceKind
  ordinal: number
}

export interface PersistedEducationalAnalysisMisconception {
  id: string
  code: string
  description: string
  confidence: number
  evidenceMessageId: string
}

export type StoreEducationalAnalysisResult =
  | {
      readonly kind: 'created'
      readonly analysis: PersistedEducationalAnalysisRecord
    }
  | {
      readonly kind: 'reused'
      readonly analysis: PersistedEducationalAnalysisRecord
    }

export abstract class EducationalAnalysisRepository {
  abstract findLatestAccepted(
    input: EducationalAnalysisIdentity,
  ): Promise<PersistedEducationalAnalysisRecord | null>

  abstract storeAccepted(
    input: PersistEducationalAnalysisInput,
  ): Promise<StoreEducationalAnalysisResult>
}

const educationalAnalysisInclude = {
  evidenceLinks: {
    orderBy: [{ kind: 'asc' }, { ordinal: 'asc' }],
  },
  misconceptions: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.EducationalAnalysisInclude

type EducationalAnalysisWithChildren = Prisma.EducationalAnalysisGetPayload<{
  include: typeof educationalAnalysisInclude
}>

@Injectable()
export class PrismaEducationalAnalysisRepository extends EducationalAnalysisRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async findLatestAccepted(
    input: EducationalAnalysisIdentity,
  ): Promise<PersistedEducationalAnalysisRecord | null> {
    const existing = await this.prismaService.educationalAnalysis.findFirst({
      where: identityWhere(input),
      include: educationalAnalysisInclude,
      orderBy: [{ attempt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    })

    return existing === null ? null : mapEducationalAnalysis(existing)
  }

  async storeAccepted(
    input: PersistEducationalAnalysisInput,
  ): Promise<StoreEducationalAnalysisResult> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        if (!input.forceReanalysis) {
          const existing = await tx.educationalAnalysis.findFirst({
            where: identityWhere(input),
            include: educationalAnalysisInclude,
            orderBy: [
              { attempt: 'desc' },
              { createdAt: 'desc' },
              { id: 'desc' },
            ],
          })

          if (existing !== null) {
            return {
              kind: 'reused',
              analysis: mapEducationalAnalysis(existing),
            } as const
          }
        }

        const latest = await tx.educationalAnalysis.aggregate({
          where: {
            attemptId: input.attemptId,
          },
          _max: {
            attempt: true,
          },
        })
        const attempt = (latest._max.attempt ?? 0) + 1
        const created = await tx.educationalAnalysis.create({
          data: {
            attemptId: input.attemptId,
            topicId: input.topicId,
            studentMessageId: input.studentMessageId,
            attempt,
            requestKind: input.result.requestKind,
            studentState: input.result.studentState,
            effortPresent: input.result.effortEvidence.present,
            effortQuality: input.result.effortEvidence.quality,
            effortType: input.result.effortEvidence.type,
            effortAddressesPreviousTutorAction:
              input.result.effortEvidence.addressesPreviousTutorAction,
            effortIsRepeated: input.result.effortEvidence.isRepeated,
            learningEvidencePresent: input.result.learningEvidence.present,
            learningEvidenceStrength: input.result.learningEvidence.strength,
            topicRelation: input.result.topicRelation,
            recommendedStrategy: input.result.recommendedStrategy,
            recommendedTechnique: input.result.recommendedTechnique,
            recommendedGuidanceLevel: input.result.recommendedGuidanceLevel,
            confidence: input.result.confidence,
            provider: input.modelResponse.provider,
            model: input.modelResponse.model,
            modelVersion: input.modelResponse.modelVersion,
            promptVersion: input.modelResponse.promptVersion,
            schemaVersion: EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
            inputTokens: input.modelResponse.inputTokens,
            outputTokens: input.modelResponse.outputTokens,
            latencyMs: input.modelResponse.latencyMs,
            analysisSource:
              input.metadata?.analysisSource ??
              EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
            fallbackReason: input.metadata?.fallbackReason,
            failureCategory: input.metadata?.failureCategory,
            confidencePolicyVersion: input.metadata?.confidencePolicyVersion,
            infrastructureRetryCount:
              input.metadata?.infrastructureRetryCount ?? 0,
            evidenceLinks: {
              create: evidenceLinkCreates(input.result),
            },
            misconceptions: {
              create: input.result.misconceptions.map((misconception) => ({
                code: misconception.code,
                description: misconception.description,
                confidence: misconception.confidence,
                evidenceMessageId: misconception.evidenceMessageId,
              })),
            },
          },
          include: educationalAnalysisInclude,
        })
        return {
          kind: 'created',
          analysis: mapEducationalAnalysis(created),
        } as const
      })
    } catch (error) {
      if (isUniqueConstraintError(error) && !input.forceReanalysis) {
        const existing = await this.findLatestAccepted(input)
        if (existing !== null) {
          return { kind: 'reused', analysis: existing }
        }
      }
      throw error
    }
  }
}

function identityWhere(input: EducationalAnalysisIdentity) {
  return {
    attemptId: input.attemptId,
    topicId: input.topicId,
    studentMessageId: input.studentMessageId,
  } satisfies Prisma.EducationalAnalysisWhereInput
}

function evidenceLinkCreates(result: EducationalAnalysisResult) {
  return [
    ...result.evidenceReferences.map((messageId, ordinal) => ({
      messageId,
      kind: EducationalAnalysisEvidenceKind.TOP_LEVEL,
      ordinal,
    })),
    ...result.effortEvidence.evidenceMessageIds.map((messageId, ordinal) => ({
      messageId,
      kind: EducationalAnalysisEvidenceKind.EFFORT,
      ordinal,
    })),
    ...result.learningEvidence.evidenceMessageIds.map((messageId, ordinal) => ({
      messageId,
      kind: EducationalAnalysisEvidenceKind.LEARNING,
      ordinal,
    })),
  ]
}

function mapEducationalAnalysis(
  record: EducationalAnalysisWithChildren,
): PersistedEducationalAnalysisRecord {
  return {
    id: record.id,
    attemptId: record.attemptId,
    topicId: record.topicId,
    studentMessageId: record.studentMessageId,
    attempt: record.attempt,
    result: {
      requestKind: record.requestKind,
      studentState: record.studentState,
      effortEvidence: {
        present: record.effortPresent,
        quality:
          record.effortQuality as EducationalAnalysisResult['effortEvidence']['quality'],
        type: record.effortType as EducationalAnalysisResult['effortEvidence']['type'],
        addressesPreviousTutorAction: record.effortAddressesPreviousTutorAction,
        isRepeated: record.effortIsRepeated,
        evidenceMessageIds: evidenceMessageIds(
          record.evidenceLinks,
          EducationalAnalysisEvidenceKind.EFFORT,
        ),
      },
      learningEvidence: {
        present: record.learningEvidencePresent,
        strength:
          record.learningEvidenceStrength as EducationalAnalysisResult['learningEvidence']['strength'],
        evidenceMessageIds: evidenceMessageIds(
          record.evidenceLinks,
          EducationalAnalysisEvidenceKind.LEARNING,
        ),
      },
      misconceptions: record.misconceptions.map((misconception) => ({
        code: misconception.code,
        description: misconception.description,
        confidence: misconception.confidence,
        evidenceMessageId: misconception.evidenceMessageId,
      })),
      topicRelation:
        record.topicRelation as EducationalAnalysisResult['topicRelation'],
      recommendedStrategy: record.recommendedStrategy,
      recommendedTechnique: record.recommendedTechnique,
      recommendedGuidanceLevel: record.recommendedGuidanceLevel,
      confidence: record.confidence,
      evidenceReferences: evidenceMessageIds(
        record.evidenceLinks,
        EducationalAnalysisEvidenceKind.TOP_LEVEL,
      ),
    },
    provider: record.provider,
    model: record.model,
    modelVersion: record.modelVersion,
    promptVersion: record.promptVersion,
    schemaVersion: record.schemaVersion,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    latencyMs: record.latencyMs,
    analysisSource: record.analysisSource as EducationalAnalysisSource,
    fallbackReason:
      record.fallbackReason as EducationalAnalysisFallbackReason | null,
    failureCategory: record.failureCategory,
    confidencePolicyVersion: record.confidencePolicyVersion,
    infrastructureRetryCount: record.infrastructureRetryCount,
    evidenceLinks: record.evidenceLinks.map((link) => ({
      id: link.id,
      messageId: link.messageId,
      kind: link.kind,
      ordinal: link.ordinal,
    })),
    misconceptionRecords: record.misconceptions.map((misconception) => ({
      id: misconception.id,
      code: misconception.code,
      description: misconception.description,
      confidence: misconception.confidence,
      evidenceMessageId: misconception.evidenceMessageId,
    })),
    createdAt: record.createdAt,
  }
}

function evidenceMessageIds(
  links: EducationalAnalysisWithChildren['evidenceLinks'],
  kind: EducationalAnalysisEvidenceKind,
): string[] {
  return links
    .filter((link) => link.kind === kind)
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((link) => link.messageId)
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}
