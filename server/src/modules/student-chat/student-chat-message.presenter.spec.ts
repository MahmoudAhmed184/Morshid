import {
  MaterialStatus,
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  Prisma,
} from '../../generated/prisma/client'
import type { PdfStorage } from '../pdf-storage/pdf-storage'
import type { ChatMessageRecord } from './student-chat.repository.types'
import { StudentChatMessagePresenter } from './student-chat-message.presenter'

const createdAt = new Date('2026-07-21T12:00:00.000Z')

describe('StudentChatMessagePresenter', () => {
  let exists: jest.Mock
  let presenter: StudentChatMessagePresenter

  beforeEach(() => {
    exists = jest.fn().mockResolvedValue(true)
    presenter = new StudentChatMessagePresenter({
      exists,
    } as unknown as PdfStorage)
  })

  it('reconstructs ordered citation evidence with one-based chunks and bounded normalized excerpts', async () => {
    const longExcerpt = `  first\n\tchunk   ${'😀'.repeat(260)} trailing  `
    const message = makeMessage({
      citations: [
        citation(1, 'material-a', 'Lists', 'shared.pdf'),
        citation(2, 'material-b', 'Loops', 'shared.pdf'),
      ],
      retrievals: [
        retrieval(1, 0.95, 'chunk-a', 'material-a', 0, longExcerpt),
        retrieval(2, 0.85, 'chunk-b', 'material-b', 3, '  loop   text  '),
        retrieval(3, 0.8, 'chunk-c', 'material-a', 1, 'second list text'),
      ],
    })

    const result = await presenter.present(message)

    expect(
      result.citations.map(({ order, materialId }) => ({ order, materialId })),
    ).toEqual([
      { order: 1, materialId: 'material-a' },
      { order: 2, materialId: 'material-b' },
    ])
    expect(result.citations[0]).toMatchObject({
      materialTitle: 'Lists',
      sourceAvailable: true,
      evidence: [
        {
          rank: 1,
          similarityScore: 0.95,
          chunkId: 'chunk-a',
          chunkNumber: 1,
        },
        {
          rank: 3,
          similarityScore: 0.8,
          chunkId: 'chunk-c',
          chunkNumber: 2,
          excerpt: 'second list text',
        },
      ],
    })
    expect(Array.from(result.citations[0].evidence[0].excerpt)).toHaveLength(
      240,
    )
    expect(result.citations[0].evidence[0].excerpt).not.toMatch(/\s{2,}/)
    expect(result.citations[1].evidence[0]).toMatchObject({
      rank: 2,
      chunkNumber: 4,
      excerpt: 'loop text',
    })
    expect(exists).toHaveBeenCalledTimes(1)
  })

  it('retains citation titles but hides evidence when chunks or backing files are unavailable', async () => {
    exists.mockResolvedValue(false)
    const withMissingChunk = makeMessage({
      citations: [citation(1, 'material-a', 'Retained title', 'missing.pdf')],
      retrievals: [
        {
          rank: 1,
          similarityScore: new Prisma.Decimal(0.9),
          chunk: null,
        },
      ],
    })
    const withMissingFile = makeMessage({
      citations: [citation(1, 'material-b', 'Still titled', 'missing.pdf')],
      retrievals: [
        retrieval(1, 0.9, 'chunk-b', 'material-b', 0, 'must be hidden'),
      ],
    })

    const result = await presenter.presentMany([
      withMissingChunk,
      withMissingFile,
    ])

    expect(result.map((message) => message.citations[0])).toEqual([
      {
        order: 1,
        materialId: 'material-a',
        materialTitle: 'Retained title',
        sourceAvailable: false,
        evidence: [],
      },
      {
        order: 1,
        materialId: 'material-b',
        materialTitle: 'Still titled',
        sourceAvailable: false,
        evidence: [],
      },
    ])
    expect(exists).toHaveBeenCalledTimes(1)
  })
})

function makeMessage(
  overrides: Partial<ChatMessageRecord> = {},
): ChatMessageRecord {
  return {
    id: 'message-id',
    sequence: 2,
    role: MessageRole.ASSISTANT,
    authorUserId: null,
    responseToMessageId: 'student-message-id',
    content: 'Grounded answer',
    status: MessageStatus.COMPLETED,
    requestKind: MessageRequestKind.CONCEPTUAL,
    guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
    hintLevel: null,
    errorCode: null,
    createdAt,
    completedAt: createdAt,
    citations: [],
    retrievals: [],
    ...overrides,
  }
}

function citation(
  citationOrder: number,
  materialId: string,
  title: string,
  storagePath: string,
): ChatMessageRecord['citations'][number] {
  return {
    citationOrder,
    material: {
      id: materialId,
      title,
      storagePath,
      status: MaterialStatus.READY,
      deletedAt: null,
      extractedTextLength: 100,
      chunkCount: 2,
    },
  }
}

function retrieval(
  rank: number,
  similarityScore: number,
  chunkId: string,
  materialId: string,
  chunkIndex: number,
  content: string,
): ChatMessageRecord['retrievals'][number] {
  return {
    rank,
    similarityScore: new Prisma.Decimal(similarityScore),
    chunk: {
      id: chunkId,
      materialId,
      chunkIndex,
      content,
    },
  }
}
