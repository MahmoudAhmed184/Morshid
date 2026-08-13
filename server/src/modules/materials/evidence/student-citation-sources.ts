import { Inject, Injectable } from '@nestjs/common'

import {
  PDF_STORAGE,
  type PdfStorage,
} from '../../../platform/document-storage/pdf-storage'
import { PrismaService } from '../../../platform/database/prisma.service'
import { MaterialStatus } from '../interface/material-status'
import {
  StudentCitationSources,
  type StudentCitationSource,
  type MessagePolicyEvidenceSource,
} from '../interface/student-citation-sources'

const MAX_EXCERPT_CODE_POINTS = 240

@Injectable()
export class PrismaStudentCitationSources extends StudentCitationSources {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(PDF_STORAGE) private readonly pdfStorage: PdfStorage,
  ) {
    super()
  }

  async loadForMessages(
    messageIds: readonly string[],
  ): Promise<readonly StudentCitationSource[]> {
    if (messageIds.length === 0) {
      return []
    }
    const citations = await this.prismaService.messageCitation.findMany({
      where: { messageId: { in: [...messageIds] } },
      select: {
        messageId: true,
        citationOrder: true,
        material: {
          select: {
            id: true,
            title: true,
            storagePath: true,
            status: true,
            deletedAt: true,
            extractedTextLength: true,
            chunkCount: true,
          },
        },
      },
      orderBy: [{ messageId: 'asc' }, { citationOrder: 'asc' }],
    })
    const retrievals = await this.prismaService.messageRetrieval.findMany({
      where: {
        messageId: { in: [...messageIds] },
        similarityScore: { not: null },
        chunkId: { not: null },
      },
      select: {
        messageId: true,
        rank: true,
        similarityScore: true,
        chunk: {
          select: {
            id: true,
            materialId: true,
            chunkIndex: true,
            content: true,
          },
        },
      },
      orderBy: [{ messageId: 'asc' }, { rank: 'asc' }],
    })
    const availability = new Map<string, Promise<boolean>>()

    return Promise.all(
      citations.map(async (citation) => {
        const evidence = retrievals
          .filter(
            (retrieval) =>
              retrieval.messageId === citation.messageId &&
              retrieval.chunk?.materialId === citation.material.id &&
              retrieval.similarityScore !== null,
          )
          .map((retrieval) => {
            if (
              retrieval.chunk === null ||
              retrieval.similarityScore === null
            ) {
              throw new Error('Unreachable citation evidence state')
            }
            return {
              rank: retrieval.rank,
              similarityScore: retrieval.similarityScore.toNumber(),
              chunkId: retrieval.chunk.id,
              chunkNumber: retrieval.chunk.chunkIndex + 1,
              excerpt: takeCodePoints(
                normalizeExcerpt(retrieval.chunk.content),
                MAX_EXCERPT_CODE_POINTS,
              ),
            }
          })
        const databaseAvailable =
          citation.material.deletedAt === null &&
          (citation.material.status === MaterialStatus.READY ||
            citation.material.status === MaterialStatus.WARNING) &&
          (citation.material.extractedTextLength ?? 0) > 0 &&
          (citation.material.chunkCount ?? 0) > 0 &&
          evidence.length > 0
        const sourceAvailable =
          databaseAvailable &&
          (await backingFileExists(
            this.pdfStorage,
            citation.material.storagePath,
            availability,
          ))

        return {
          messageId: citation.messageId,
          order: citation.citationOrder,
          materialId: citation.material.id,
          materialTitle: citation.material.title,
          sourceAvailable,
          evidence: sourceAvailable ? evidence : [],
        }
      }),
    )
  }

  async loadPolicyEvidence(
    messageId: string,
  ): Promise<readonly MessagePolicyEvidenceSource[]> {
    const retrievals = await this.prismaService.messageRetrieval.findMany({
      where: { messageId, chunkId: { not: null } },
      select: {
        rank: true,
        similarityScore: true,
        chunk: {
          select: {
            id: true,
            materialId: true,
            chunkIndex: true,
            content: true,
            embeddingModel: true,
            material: { select: { title: true } },
          },
        },
      },
      orderBy: { rank: 'asc' },
    })

    return retrievals.flatMap((retrieval) => {
      if (retrieval.chunk === null) {
        return []
      }
      return [
        {
          materialId: retrieval.chunk.materialId,
          materialTitle: retrieval.chunk.material.title,
          chunkId: retrieval.chunk.id,
          chunkIndex: retrieval.chunk.chunkIndex,
          excerpt: retrieval.chunk.content,
          rank: retrieval.rank,
          ...(retrieval.similarityScore === null
            ? {}
            : { score: retrieval.similarityScore.toNumber() }),
          embeddingModel: retrieval.chunk.embeddingModel,
        },
      ]
    })
  }
}

function backingFileExists(
  storage: PdfStorage,
  storagePath: string,
  cache: Map<string, Promise<boolean>>,
): Promise<boolean> {
  const cached = cache.get(storagePath)
  if (cached !== undefined) {
    return cached
  }
  const result = storage.exists(storagePath).catch(() => false)
  cache.set(storagePath, result)
  return result
}

function normalizeExcerpt(content: string): string {
  return content.replace(/\s+/gu, ' ').trim()
}

function takeCodePoints(content: string, limit: number): string {
  return Array.from(content).slice(0, limit).join('')
}
