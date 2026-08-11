import type { ChatMessage } from '@/features/chat/messages/chat-message.schema'

export const chatIds = {
  primaryStudent: '8f9c19d1-eed5-43de-8bd9-995919825f9f',
  otherStudent: '96f2fa84-7cd0-4488-8b18-439b0ce7a0f8',
  primaryCourse: '17d1a78d-60be-4f5f-a03d-e3ee326ec796',
  otherCourse: '5cf0a2f6-f1ab-4b83-971a-fcd4cd6a92ee',
  primarySession: 'eff4bf27-cce3-45d9-b245-4f1d913f0a27',
  otherSession: '1ba7b947-84c6-42eb-94d6-3f1bb7b5d3a5',
  primaryTurn: '90607abd-59ff-44e1-b0e7-33e19f6270a7',
  primaryTopic: 'eebc988f-e3bc-4a69-9340-afcfbd60ddc5',
  studentMessage: 'c139776a-0c68-44fe-97f8-e9128aa40458',
  assistantMessage: '25587e6e-4e6a-4533-9d4f-97be9e63bd96',
  primaryMaterial: 'ac06fd75-b2d8-4770-8b36-a3ceaf129fe7',
  primaryChunk: '94d07771-9cf6-43a1-b9f6-7183f85a82a3',
} as const

export const primaryStudentFixture = {
  id: chatIds.primaryStudent,
  email: 'student.one@morshid.test',
  displayName: 'Student One',
  role: 'STUDENT',
  status: 'ACTIVE',
} as const

export const otherStudentFixture = {
  id: chatIds.otherStudent,
  email: 'student.two@morshid.test',
  displayName: 'Student Two',
  role: 'STUDENT',
  status: 'ACTIVE',
} as const

export const primaryChatSessionFixture = {
  id: chatIds.primarySession,
  courseId: chatIds.primaryCourse,
  title: 'Python lists',
  lastMessageAt: '2026-07-17T09:02:00.000Z',
  createdAt: '2026-07-17T09:00:00.000Z',
  updatedAt: '2026-07-17T09:02:00.000Z',
} as const

export const otherChatSessionFixture = {
  id: chatIds.otherSession,
  courseId: chatIds.otherCourse,
  title: 'Private session from another scope',
  lastMessageAt: null,
  createdAt: '2026-07-17T10:00:00.000Z',
  updatedAt: '2026-07-17T10:00:00.000Z',
} as const

export const orderedChatMessagesFixture = [
  {
    id: chatIds.studentMessage,
    sequence: 1,
    role: 'STUDENT',
    attemptId: chatIds.primaryTurn,
    topicId: chatIds.primaryTopic,
    responseToMessageId: null,
    content: 'How do Python lists work?',
    status: 'COMPLETED',
    requestKind: 'CONCEPTUAL',
    guidanceLabel: null,
    hintLevel: null,
    promptVersion: null,
    errorCode: null,
    createdAt: '2026-07-17T09:01:00.000Z',
    completedAt: '2026-07-17T09:01:00.000Z',
    citations: [] as ChatMessage['citations'],
    reviewSummary: null,
  },
  {
    id: chatIds.assistantMessage,
    sequence: 2,
    role: 'ASSISTANT',
    attemptId: chatIds.primaryTurn,
    topicId: chatIds.primaryTopic,
    responseToMessageId: chatIds.studentMessage,
    content: 'A list is an ordered, mutable collection.',
    status: 'COMPLETED',
    requestKind: 'CONCEPTUAL',
    guidanceLabel: 'COURSE_GROUNDED',
    hintLevel: 1,
    promptVersion: 'tutor-generation.mvp.v3',
    errorCode: null,
    createdAt: '2026-07-17T09:02:00.000Z',
    completedAt: '2026-07-17T09:02:00.000Z',
    citations: [
      {
        order: 1,
        materialId: chatIds.primaryMaterial,
        materialTitle: 'Python lists',
        sourceAvailable: true,
        evidence: [
          {
            rank: 1,
            similarityScore: 0.94,
            chunkId: chatIds.primaryChunk,
            chunkNumber: 1,
            excerpt: 'Python lists are ordered and mutable collections.',
          },
        ],
      },
    ] as ChatMessage['citations'],
    reviewSummary: null,
  },
] as const

export const chatSessionListResponseFixture = {
  sessions: [primaryChatSessionFixture],
  nextCursor: null,
} as const

export const chatMessageHistoryResponseFixture = {
  messages: orderedChatMessagesFixture,
  nextCursor: null,
} as const

export const chatTurnResponseFixture = {
  studentMessage: orderedChatMessagesFixture[0],
  assistantMessage: orderedChatMessagesFixture[1],
} as const

export const emptyChatSessionListResponseFixture = {
  sessions: [],
  nextCursor: null,
} as const

export const emptyChatMessageHistoryResponseFixture = {
  messages: [],
  nextCursor: null,
} as const

export const malformedChatSessionResponseFixture = {
  session: {
    ...primaryChatSessionFixture,
    studentId: chatIds.primaryStudent,
  },
} as const
