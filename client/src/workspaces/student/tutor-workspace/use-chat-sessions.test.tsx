import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/session/session.schema'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  getChatMessages,
  listChatSessions,
  renameChatSession,
  retryChatMessage,
  sendChatMessage,
} from '@/features/chat/sessions/chat-sessions.api'
import { chatSessionKeys } from '@/features/chat/sessions/chat-sessions.queries'
import type {
  ChatMessageHistoryResponse,
  ChatTurnResponse,
} from '@/features/chat/messages/chat-message.schema'
import type {
  ChatSession,
  ChatSessionListResponse,
} from '@/features/chat/sessions/chat-session.schema'
import {
  chatMessageHistoryResponseFixture,
  chatTurnResponseFixture,
  otherChatSessionFixture,
  primaryChatSessionFixture,
  chatIds,
} from '@/features/chat/testing/chat.fixtures'

import {
  useCreateChatSession,
  useDeleteChatSession,
  useRenameChatSession,
  useChatSession,
  useChatMessages,
  useChatSessions,
} from './use-chat-sessions'
import {
  useRetryChatMessage,
  useSendChatMessage,
} from '@/workspaces/student/tutor-workspace/use-chat-messages'

vi.mock('@/features/chat/sessions/chat-sessions.api')

const createStudentSessionMock = vi.mocked(createChatSession)
const deleteStudentSessionMock = vi.mocked(deleteChatSession)
const getStudentSessionMock = vi.mocked(getChatSession)
const getStudentSessionMessagesMock = vi.mocked(getChatMessages)
const listStudentSessionsMock = vi.mocked(listChatSessions)
const renameStudentSessionMock = vi.mocked(renameChatSession)
const retryChatMessageMock = vi.mocked(retryChatMessage)
const sendChatMessageMock = vi.mocked(sendChatMessage)

interface CourseScope {
  studentId: string
  courseId: string
}

const primaryScope = {
  studentId: chatIds.primaryStudent,
  courseId: chatIds.primaryCourse,
} satisfies CourseScope

const otherStudentScope = {
  studentId: chatIds.otherStudent,
  courseId: chatIds.primaryCourse,
} satisfies CourseScope

const otherCourseScope = {
  studentId: chatIds.otherStudent,
  courseId: chatIds.otherCourse,
} satisfies CourseScope

const otherStudentSession: ChatSession = {
  ...primaryChatSessionFixture,
  id: chatIds.otherSession,
  title: 'Other Student private session',
}

function createStudentAuthSession(studentId: string): AuthSession {
  return {
    tokenType: 'Bearer',
    user: {
      id: studentId,
      email: `${studentId}@morshid.test`,
      displayName: 'Test Student',
      role: 'STUDENT',
      status: 'ACTIVE',
    },
    accessToken: `access-${studentId}`,
    accessTokenExpiresAt: '2027-07-17T12:00:00.000Z',
  }
}

function authenticate(studentId: string = chatIds.primaryStudent) {
  useAuthStore.getState().setSession(createStudentAuthSession(studentId))
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function sessionList(
  session: ChatSession = primaryChatSessionFixture,
): ChatSessionListResponse {
  return { sessions: [session], nextCursor: null }
}

function messageHistory(
  firstMessageContent: string = chatMessageHistoryResponseFixture.messages[0]
    .content,
): ChatMessageHistoryResponse {
  return {
    messages: chatMessageHistoryResponseFixture.messages.map(
      (message, index) => ({
        ...message,
        content: index === 0 ? firstMessageContent : message.content,
      }),
    ),
    nextCursor: null,
  }
}

function seedSessionList(
  queryClient: QueryClient,
  scope: CourseScope,
  session: ChatSession = primaryChatSessionFixture,
) {
  const key = chatSessionKeys.sessionList(scope)
  queryClient.setQueryData(key, {
    pages: [sessionList(session)],
    pageParams: [undefined],
  })
  return key
}

function seedHistory(
  queryClient: QueryClient,
  scope: CourseScope,
  sessionId: string = chatIds.primarySession,
  firstMessageContent?: string,
) {
  const key = chatSessionKeys.messageList({ ...scope, sessionId })
  queryClient.setQueryData(key, {
    pages: [messageHistory(firstMessageContent)],
    pageParams: [undefined],
  })
  return key
}

describe('Student session hooks', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('does not query or mutate without authenticated course/session scope', async () => {
    const wrapper = createWrapper(createQueryClient())
    const sessions = renderHook(
      () => useChatSessions({ courseId: chatIds.primaryCourse }),
      { wrapper },
    )
    const messages = renderHook(
      () =>
        useChatMessages({
          courseId: chatIds.primaryCourse,
        }),
      { wrapper },
    )
    const session = renderHook(
      () =>
        useChatSession({
          courseId: chatIds.primaryCourse,
        }),
      { wrapper },
    )
    const createSession = renderHook(
      () => useCreateChatSession({ courseId: chatIds.primaryCourse }),
      { wrapper },
    )

    expect(sessions.result.current.fetchStatus).toBe('idle')
    expect(messages.result.current.fetchStatus).toBe('idle')
    expect(session.result.current.fetchStatus).toBe('idle')
    await act(async () => {
      await expect(
        createSession.result.current.mutateAsync({ title: 'Blocked request' }),
      ).rejects.toThrow('Choose an assigned course first.')
    })
    expect(listStudentSessionsMock).not.toHaveBeenCalled()
    expect(getStudentSessionMessagesMock).not.toHaveBeenCalled()
    expect(getStudentSessionMock).not.toHaveBeenCalled()
    expect(createStudentSessionMock).not.toHaveBeenCalled()
  })

  it('loads one routed session through its Student and course cache scope', async () => {
    const queryClient = createQueryClient()
    getStudentSessionMock.mockResolvedValue(primaryChatSessionFixture)
    authenticate()

    const { result } = renderHook(
      () =>
        useChatSession({
          courseId: primaryScope.courseId,
          sessionId: chatIds.primarySession,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() =>
      expect(result.current.data).toEqual(primaryChatSessionFixture),
    )
    expect(getStudentSessionMock).toHaveBeenCalledWith({
      courseId: primaryScope.courseId,
      sessionId: chatIds.primarySession,
    })
    expect(
      queryClient.getQueryData(
        chatSessionKeys.detail({
          ...primaryScope,
          sessionId: chatIds.primarySession,
        }),
      ),
    ).toEqual(primaryChatSessionFixture)
    expect(
      queryClient.getQueryData(
        chatSessionKeys.detail({
          ...otherStudentScope,
          sessionId: chatIds.primarySession,
        }),
      ),
    ).toBeUndefined()
  })

  it('isolates sessions and history through logout, login, and course switches', async () => {
    const queryClient = createQueryClient()
    seedSessionList(queryClient, primaryScope)
    seedSessionList(queryClient, otherStudentScope, otherStudentSession)
    seedSessionList(queryClient, otherCourseScope, otherChatSessionFixture)
    seedHistory(
      queryClient,
      primaryScope,
      chatIds.primarySession,
      'Primary Student history',
    )
    seedHistory(
      queryClient,
      otherStudentScope,
      chatIds.otherSession,
      'Other Student history',
    )
    seedHistory(
      queryClient,
      otherCourseScope,
      chatIds.otherSession,
      'Other course history',
    )
    getStudentSessionMessagesMock.mockRejectedValue(new Error('Denied scope'))
    authenticate()

    const { result, rerender } = renderHook(
      ({ courseId, sessionId }: { courseId: string; sessionId: string }) => ({
        sessions: useChatSessions({ courseId }),
        history: useChatMessages({ courseId, sessionId }),
      }),
      {
        initialProps: {
          courseId: String(primaryScope.courseId),
          sessionId: String(chatIds.primarySession),
        },
        wrapper: createWrapper(queryClient),
      },
    )

    expect(result.current.sessions.data?.pages[0]?.sessions[0]?.id).toBe(
      chatIds.primarySession,
    )
    expect(result.current.history.data?.pages[0]?.messages[0]?.content).toBe(
      'Primary Student history',
    )

    act(() => useAuthStore.getState().clearSession())
    await waitFor(() => expect(result.current.sessions.data).toBeUndefined())
    expect(result.current.history.data).toBeUndefined()

    act(() => authenticate(chatIds.otherStudent))
    expect(result.current.history.data).toBeUndefined()
    rerender({
      courseId: chatIds.primaryCourse,
      sessionId: chatIds.otherSession,
    })
    await waitFor(() =>
      expect(result.current.sessions.data?.pages[0]?.sessions[0]?.id).toBe(
        chatIds.otherSession,
      ),
    )
    expect(result.current.history.data?.pages[0]?.messages[0]?.content).toBe(
      'Other Student history',
    )

    rerender({
      courseId: chatIds.otherCourse,
      sessionId: chatIds.otherSession,
    })
    await waitFor(() =>
      expect(
        result.current.sessions.data?.pages[0]?.sessions[0]?.courseId,
      ).toBe(chatIds.otherCourse),
    )
    expect(result.current.history.data?.pages[0]?.messages[0]?.content).toBe(
      'Other course history',
    )
  })

  it('caches a created empty session only for the mutation-start scope', async () => {
    const queryClient = createQueryClient()
    const primaryKey = seedSessionList(queryClient, primaryScope)
    const otherKey = seedSessionList(
      queryClient,
      otherStudentScope,
      otherStudentSession,
    )
    let resolveSession: ((session: ChatSession) => void) | undefined
    createStudentSessionMock.mockImplementation(
      () =>
        new Promise<ChatSession>((resolve) => {
          resolveSession = resolve
        }),
    )
    authenticate()
    const { result } = renderHook(
      () => useCreateChatSession({ courseId: primaryScope.courseId }),
      { wrapper: createWrapper(queryClient) },
    )

    let mutation: Promise<ChatSession> | undefined
    act(() => {
      mutation = result.current.mutateAsync({ title: 'Python lists' })
    })
    await waitFor(() => expect(resolveSession).toBeTypeOf('function'))
    act(() => authenticate(chatIds.otherStudent))

    if (!resolveSession || !mutation) {
      throw new Error('Expected the create request to be pending')
    }

    resolveSession(primaryChatSessionFixture)
    await act(async () => mutation)

    expect(
      queryClient.getQueryData<
        InfiniteData<ChatSessionListResponse, string | undefined>
      >(primaryKey)?.pages[0]?.sessions,
    ).toEqual([primaryChatSessionFixture])
    expect(queryClient.getQueryData(otherKey)).toEqual({
      pages: [sessionList(otherStudentSession)],
      pageParams: [undefined],
    })
    expect(
      queryClient.getQueryData(
        chatSessionKeys.messageList({
          ...primaryScope,
          sessionId: primaryChatSessionFixture.id,
        }),
      ),
    ).toEqual({
      pages: [{ messages: [], nextCursor: null }],
      pageParams: [undefined],
    })
    expect(
      queryClient.getQueryData(
        chatSessionKeys.detail({
          ...primaryScope,
          sessionId: primaryChatSessionFixture.id,
        }),
      ),
    ).toEqual(primaryChatSessionFixture)
  })

  it('renames only the owning Student session cache', async () => {
    const queryClient = createQueryClient()
    const primaryKey = seedSessionList(queryClient, primaryScope)
    const otherKey = seedSessionList(
      queryClient,
      otherStudentScope,
      otherStudentSession,
    )
    const renamedSession = {
      ...primaryChatSessionFixture,
      title: 'Renamed session',
    }
    queryClient.setQueryData(
      chatSessionKeys.detail({
        ...primaryScope,
        sessionId: primaryChatSessionFixture.id,
      }),
      primaryChatSessionFixture,
    )
    renameStudentSessionMock.mockResolvedValue(renamedSession)
    authenticate()
    const { result } = renderHook(
      () => useRenameChatSession({ courseId: primaryScope.courseId }),
      { wrapper: createWrapper(queryClient) },
    )

    await act(() =>
      result.current.mutateAsync({
        sessionId: chatIds.primarySession,
        input: { title: 'Renamed session' },
      }),
    )

    expect(
      queryClient.getQueryData<
        InfiniteData<ChatSessionListResponse, string | undefined>
      >(primaryKey)?.pages[0]?.sessions[0]?.title,
    ).toBe('Renamed session')
    expect(
      queryClient.getQueryData<
        InfiniteData<ChatSessionListResponse, string | undefined>
      >(otherKey)?.pages[0]?.sessions[0]?.title,
    ).toBe(otherStudentSession.title)
    expect(
      queryClient.getQueryData(
        chatSessionKeys.detail({
          ...primaryScope,
          sessionId: primaryChatSessionFixture.id,
        }),
      ),
    ).toEqual(renamedSession)
  })

  it('updates a session stored on a later cached page', async () => {
    const queryClient = createQueryClient()
    const primaryKey = chatSessionKeys.sessionList(primaryScope)
    const firstPageSession = {
      ...primaryChatSessionFixture,
      id: chatIds.otherSession,
      title: 'Earlier session page',
    }
    queryClient.setQueryData(primaryKey, {
      pages: [
        { sessions: [firstPageSession], nextCursor: 'next-page' },
        { sessions: [primaryChatSessionFixture], nextCursor: null },
      ],
      pageParams: [undefined, 'next-page'],
    })
    const renamedSession = {
      ...primaryChatSessionFixture,
      title: 'Renamed later-page session',
    }
    renameStudentSessionMock.mockResolvedValue(renamedSession)
    authenticate()
    const { result } = renderHook(
      () => useRenameChatSession({ courseId: primaryScope.courseId }),
      { wrapper: createWrapper(queryClient) },
    )

    await act(() =>
      result.current.mutateAsync({
        sessionId: chatIds.primarySession,
        input: { title: renamedSession.title },
      }),
    )

    const cached =
      queryClient.getQueryData<
        InfiniteData<ChatSessionListResponse, string | undefined>
      >(primaryKey)
    expect(cached?.pages[0]?.sessions[0]).toEqual(firstPageSession)
    expect(cached?.pages[1]?.sessions[0]).toEqual(renamedSession)
  })

  it('deletes only the owning session list and history caches', async () => {
    const queryClient = createQueryClient()
    const primaryListKey = seedSessionList(queryClient, primaryScope)
    const otherListKey = seedSessionList(
      queryClient,
      otherStudentScope,
      otherStudentSession,
    )
    const primaryHistoryKey = seedHistory(queryClient, primaryScope)
    const primaryDetailKey = chatSessionKeys.detail({
      ...primaryScope,
      sessionId: chatIds.primarySession,
    })
    queryClient.setQueryData(primaryDetailKey, primaryChatSessionFixture)
    const otherHistoryKey = seedHistory(
      queryClient,
      otherStudentScope,
      chatIds.otherSession,
    )
    deleteStudentSessionMock.mockResolvedValue(undefined)
    authenticate()
    const { result } = renderHook(
      () => useDeleteChatSession({ courseId: primaryScope.courseId }),
      { wrapper: createWrapper(queryClient) },
    )

    await act(() => result.current.mutateAsync(chatIds.primarySession))

    expect(
      queryClient.getQueryData<
        InfiniteData<ChatSessionListResponse, string | undefined>
      >(primaryListKey)?.pages[0]?.sessions,
    ).toEqual([])
    expect(
      queryClient.getQueryData<
        InfiniteData<ChatSessionListResponse, string | undefined>
      >(otherListKey)?.pages[0]?.sessions,
    ).toEqual(sessionList(otherStudentSession).sessions)
    expect(queryClient.getQueryData(primaryHistoryKey)).toBeUndefined()
    expect(queryClient.getQueryData(primaryDetailKey)).toBeUndefined()
    expect(queryClient.getQueryData(otherHistoryKey)).toEqual({
      pages: [messageHistory()],
      pageParams: [undefined],
    })
  })

  it('preserves cached data when a mutation fails', async () => {
    const queryClient = createQueryClient()
    const primaryKey = seedSessionList(queryClient, primaryScope)
    renameStudentSessionMock.mockRejectedValue(new Error('Server unavailable'))
    authenticate()
    const { result } = renderHook(
      () => useRenameChatSession({ courseId: primaryScope.courseId }),
      { wrapper: createWrapper(queryClient) },
    )

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          sessionId: chatIds.primarySession,
          input: { title: 'Should not be cached' },
        }),
      ).rejects.toThrow('Server unavailable')
    })

    expect(queryClient.getQueryData(primaryKey)).toEqual({
      pages: [sessionList()],
      pageParams: [undefined],
    })
  })

  it('optimistically sends within one Student, course, and session cache', async () => {
    const queryClient = createQueryClient()
    const historyKey = seedHistory(queryClient, primaryScope)
    const otherHistoryKey = seedHistory(
      queryClient,
      otherStudentScope,
      chatIds.otherSession,
      'Other Student history',
    )
    const clientMessageId = chatIds.primaryMaterial
    const assistantMessageId = chatIds.primaryChunk
    const persistedTurn: ChatTurnResponse = {
      studentMessage: {
        ...chatTurnResponseFixture.studentMessage,
        id: clientMessageId,
        sequence: 3,
      },
      assistantMessage: {
        ...chatTurnResponseFixture.assistantMessage,
        id: assistantMessageId,
        sequence: 4,
        responseToMessageId: clientMessageId,
      },
    }
    let resolveTurn: ((turn: ChatTurnResponse) => void) | undefined
    sendChatMessageMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTurn = resolve
        }),
    )
    authenticate()
    const { result } = renderHook(
      () =>
        useSendChatMessage({
          courseId: primaryScope.courseId,
          sessionId: chatIds.primarySession,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    let mutation: Promise<unknown> | undefined
    act(() => {
      mutation = result.current.mutateAsync({
        clientMessageId,
        content: 'How do Python lists work?',
      })
    })
    await waitFor(() => expect(resolveTurn).toBeTypeOf('function'))

    const optimistic =
      queryClient.getQueryData<
        InfiniteData<ChatMessageHistoryResponse, number | undefined>
      >(historyKey)
    expect(optimistic?.pages[0]?.messages).toHaveLength(3)
    expect(optimistic?.pages[0]?.messages.at(-1)).toMatchObject({
      content: 'How do Python lists work?',
      role: 'STUDENT',
      status: 'PENDING',
    })
    expect(queryClient.getQueryData(otherHistoryKey)).toEqual({
      pages: [messageHistory('Other Student history')],
      pageParams: [undefined],
    })

    if (!resolveTurn || !mutation) {
      throw new Error('Expected the grounded turn request to be pending')
    }

    resolveTurn(persistedTurn)
    await act(async () => mutation)

    const persisted =
      queryClient.getQueryData<
        InfiniteData<ChatMessageHistoryResponse, number | undefined>
      >(historyKey)
    expect(
      persisted?.pages[0]?.messages.filter(({ id }) => id === clientMessageId),
    ).toHaveLength(1)
    expect(
      persisted?.pages[0]?.messages.filter(
        ({ id }) => id === assistantMessageId,
      ),
    ).toHaveLength(1)
    expect(persisted?.pages[0]?.messages).toHaveLength(4)
  })

  it('rolls back an optimistic send after a transport failure', async () => {
    const queryClient = createQueryClient()
    const historyKey = seedHistory(queryClient, primaryScope)
    const previousHistory = queryClient.getQueryData(historyKey)
    sendChatMessageMock.mockRejectedValue(new TypeError('Failed to fetch'))
    authenticate()
    const { result } = renderHook(
      () =>
        useSendChatMessage({
          courseId: primaryScope.courseId,
          sessionId: chatIds.primarySession,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          clientMessageId: chatIds.studentMessage,
          content: 'Keep this draft',
        }),
      ).rejects.toThrow('Failed to fetch')
    })

    expect(queryClient.getQueryData(historyKey)).toEqual(previousHistory)
  })

  it('retries a failed persisted turn by replacing the same message ids', async () => {
    const queryClient = createQueryClient()
    const failedHistory: ChatMessageHistoryResponse = {
      messages: [
        { ...chatTurnResponseFixture.studentMessage },
        {
          ...chatTurnResponseFixture.assistantMessage,
          content: 'I could not complete that response.',
          status: 'FAILED',
          guidanceLabel: null,
          errorCode: 'GROUNDING_RESPONSE_FAILED',
          citations: [],
        },
      ],
      nextCursor: null,
    }
    const historyKey = chatSessionKeys.messageList({
      ...primaryScope,
      sessionId: chatIds.primarySession,
    })
    queryClient.setQueryData(historyKey, {
      pages: [failedHistory],
      pageParams: [undefined],
    })
    let resolveTurn:
      ((turn: typeof chatTurnResponseFixture) => void) | undefined
    retryChatMessageMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTurn = resolve
        }),
    )
    authenticate()
    const { result } = renderHook(
      () =>
        useRetryChatMessage({
          courseId: primaryScope.courseId,
          sessionId: chatIds.primarySession,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    let mutation: Promise<unknown> | undefined
    act(() => {
      mutation = result.current.mutateAsync({
        attemptId: chatIds.primaryTurn,
        studentMessageId: chatIds.studentMessage,
      })
    })
    await waitFor(() => expect(resolveTurn).toBeTypeOf('function'))
    expect(
      queryClient.getQueryData<
        InfiniteData<ChatMessageHistoryResponse, number | undefined>
      >(historyKey)?.pages[0]?.messages[1]?.status,
    ).toBe('PENDING')

    if (!resolveTurn || !mutation) {
      throw new Error('Expected the grounded retry request to be pending')
    }

    resolveTurn(chatTurnResponseFixture)
    await act(async () => mutation)

    const retried =
      queryClient.getQueryData<
        InfiniteData<ChatMessageHistoryResponse, number | undefined>
      >(historyKey)?.pages[0]?.messages
    expect(retried).toHaveLength(2)
    expect(retried?.map(({ id }) => id)).toEqual([
      chatIds.studentMessage,
      chatIds.assistantMessage,
    ])
    expect(retried?.[1]?.status).toBe('COMPLETED')
    expect(retryChatMessageMock).toHaveBeenCalledWith({
      courseId: primaryScope.courseId,
      sessionId: chatIds.primarySession,
      attemptId: chatIds.primaryTurn,
    })
  })
})
