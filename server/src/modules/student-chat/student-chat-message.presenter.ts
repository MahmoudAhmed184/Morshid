import { Inject, Injectable } from '@nestjs/common'

import { MaterialStatus } from '../../generated/prisma/client'
import { PDF_STORAGE, type PdfStorage } from '../pdf-storage/pdf-storage'
import type {
  ChatCitationDto,
  ChatCitationEvidenceDto,
  ChatMessageDto,
} from './student-chat.dto'
import type {
  ChatMessageCitationRecord,
  ChatMessageRecord,
} from './student-chat.repository.types'

const MAX_EXCERPT_CODE_POINTS = 240

@Injectable()
export class StudentChatMessagePresenter {
  constructor(@Inject(PDF_STORAGE) private readonly pdfStorage: PdfStorage) {}

  present(record: ChatMessageRecord): Promise<ChatMessageDto> {
    return this.presentWithCache(record, new Map())
  }

  presentMany(
    records: readonly ChatMessageRecord[],
  ): Promise<ChatMessageDto[]> {
    const availabilityByStoragePath = new Map<string, Promise<boolean>>()
    return Promise.all(
      records.map((record) =>
        this.presentWithCache(record, availabilityByStoragePath),
      ),
    )
  }

  private async presentWithCache(
    record: ChatMessageRecord,
    availabilityByStoragePath: Map<string, Promise<boolean>>,
  ): Promise<ChatMessageDto> {
    const citations = await Promise.all(
      record.citations.map((citation) =>
        this.presentCitation(record, citation, availabilityByStoragePath),
      ),
    )

    return {
      id: record.id,
      sequence: record.sequence,
      role: record.role,
      responseToMessageId: record.responseToMessageId,
      content: record.content,
      status: record.status,
      requestKind: record.requestKind,
      guidanceLabel: record.guidanceLabel,
      hintLevel: record.hintLevel,
      errorCode: record.errorCode,
      createdAt: record.createdAt.toISOString(),
      completedAt: record.completedAt?.toISOString() ?? null,
      citations,
    }
  }

  private async presentCitation(
    message: ChatMessageRecord,
    citation: ChatMessageCitationRecord,
    availabilityByStoragePath: Map<string, Promise<boolean>>,
  ): Promise<ChatCitationDto> {
    const evidence = message.retrievals
      .filter(
        (retrieval) =>
          retrieval.chunk?.materialId === citation.material.id &&
          retrieval.similarityScore !== null,
      )
      .map<ChatCitationEvidenceDto>((retrieval) => {
        const chunk = retrieval.chunk
        if (chunk === null || retrieval.similarityScore === null) {
          throw new Error('Unreachable citation evidence state')
        }

        return {
          rank: retrieval.rank,
          similarityScore: retrieval.similarityScore.toNumber(),
          chunkId: chunk.id,
          chunkNumber: chunk.chunkIndex + 1,
          excerpt: takeCodePoints(
            normalizeExcerpt(chunk.content),
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
      (await this.getBackingFileAvailability(
        citation.material.storagePath,
        availabilityByStoragePath,
      ))

    return {
      order: citation.citationOrder,
      materialId: citation.material.id,
      materialTitle: citation.material.title,
      sourceAvailable,
      evidence: sourceAvailable ? evidence : [],
    }
  }

  private getBackingFileAvailability(
    storagePath: string,
    availabilityByStoragePath: Map<string, Promise<boolean>>,
  ): Promise<boolean> {
    const cached = availabilityByStoragePath.get(storagePath)
    if (cached !== undefined) {
      return cached
    }

    const availability = this.isBackingFileAvailable(storagePath)
    availabilityByStoragePath.set(storagePath, availability)
    return availability
  }

  private async isBackingFileAvailable(storagePath: string): Promise<boolean> {
    try {
      return await this.pdfStorage.exists(storagePath)
    } catch {
      return false
    }
  }
}

function normalizeExcerpt(content: string): string {
  return content.replace(/\s+/gu, ' ').trim()
}

function takeCodePoints(content: string, limit: number): string {
  return Array.from(content).slice(0, limit).join('')
}
