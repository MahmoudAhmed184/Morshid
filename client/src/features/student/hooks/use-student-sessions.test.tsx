import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  createStudentSession,
  deleteStudentSession,
  getStudentSession,
  getStudentSessionMessages,
  listStudentSessions,
  renameStudentSession,
  retryStudentChatMessage,
  sendStudentChatMessage,
} from '@/features/student/data/student-sessions.api'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import type {
  ChatMessageHistoryResponse,
  ChatSession,
  ChatSessionListResponse,
} from '@/features/student/schemas/student-chat.schema'
import {
  chatMessageHistoryResponseFixture,
  groundedChatTurnResponseFixture,
  otherChatSessionFixture,
  primaryChatSessionFixture,
  studentChatIds,
} from '@/features/student/testing/student-chat.fixtures'

import {
  useCreateStudentSession,
  useDeleteStudentSession,
  useRenameStudentSession,
  useRetryStudentChatMessage,
  useSendStudentChatMessage,
  useStudentSession,
  useStudentSessionMessages,
  useStudentSessions,
} from './use-student-sessions'

vi.mock('@/features/student/data/student-sessions.api')

const createStudentSessionMock = vi.mocked(createStudentSession)
const deleteStudentSessionMock = vi.mocked(deleteStudentSession)
const getStudentSessionMock = vi.mocked(getStudentSession)
const getStudentSessionMessagesMock = vi.mocked(getStudentSessionMessages)
const listStudentSessionsMock = vi.mocked(listStudentSessions)
const renameStudentSessionMock = vi.mocked(renameStudentSession)
const retryStudentChatMessageMock = vi.mocked(retryStudentChatMessage)
const sendStudentChatMessageMock = vi.mocked(sendStudentChatMessage)

interface CourseScope {
  studentId: string
  courseId: string
}

const primaryScope = {
  studentId: studentChatIds.primaryStudent,
  courseId: studentChatIds.primaryCourse,
} satisfies CourseScope

const otherStudentScope = {
  studentId: studentChatIds.otherStudent,
  courseId: studentChatIds.primaryCourse,
} satisfies CourseScope

const otherCourseScope = {
  studentId: studentChatIds.otherStudent,
  courseId: studentChatIds.otherCourse,
} satisfies CourseScope

const otherStudentSession: ChatSession = {
  ...primaryChatSessionFixture,
  id: studentChatIds.otherSession,
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
      courses: [],
    },
    accessToken: `access-${studentId}`,
    accessTokenExpiresAt: '2027-07-17T12:00:00.000Z',
    refreshToken: `refresh-${studentId}`,
    refreshTokenExpiresAt: '2027-07-24T12:00:00.000Z',
  }
}

function authenticate(studentId: string = studentChatIds.primaryStudent) {
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
  const key = studentSessionKeys.sessionList(scope)
  queryClient.setQueryData(key, {
    pages: [sessionList(session)],
    pageParams: [undefined],
  })
  return key
}

function seedHistory(
  queryClient: QueryClient,
  scope: CourseScope,
  sessionId: string = studentChatIds.primarySession,
  firstMessageContent?: string,
) {
  const key = studentSessionKeys.messageList({ ...scope, sessionId })
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
      () => useStudentSessions({ courseId: studentChatIds.primaryCourse }),
      { wrapper },
    )
    const messages = renderHook(
      () =>
        useStudentSessionMessages({
          courseId: studentChatIds.primaryCourse,
        }),
      { wrapper },
    )
    const session = renderHook(
      () =>
        useStudentSession({
          courseId: studentChatIds.primaryCourse,
        }),
      { wrapper },
    )
    const createSession = renderHook(
      () => useCreateStudentSession({ courseId: studentChatIds.primaryCourse }),
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
        useStudentSession({
          courseId: primaryScope.courseId,
          sessionId: studentChatIds.primarySession,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() =>
      expect(result.current.data).toEqual(primaryChatSessionFixture),
    )
    expect(getStudentSessionMock).toHaveBeenCalledWith({
      courseId: primaryScope.courseId,
      sessionId: studentChatIds.primarySession,
    })
    expect(
      queryClient.getQueryData(
        studentSessionKeys.detail({
          ...primaryScope,
          sessionId: studentChatIds.primarySession,
        }),
      ),
    ).toEqual(primaryChatSessionFixture)
    expect(
      queryClient.getQueryData(
        studentSessionKeys.detail({
          ...otherStudentScope,
          sessionId: studentChatIds.primarySession,
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
      studentChatIds.primarySession,
      'Primary Student history',
    )
    seedHistory(
      queryClient,
      otherStudentScope,
      studentChatIds.otherSession,
      'Other Student history',
    )
    seedHistory(
      queryClient,
      otherCourseScope,
      studentChatIds.otherSession,
      'Other course history',
    )
    getStudentSessionMessagesMock.mockRejectedValue(new Error('Denied scope'))
    authenticate()

    const { result, rerender } = renderHook(
      ({ courseId, sessionId }: { courseId: string; sessionId: string }) => ({
        sessions: useStudentSessions({ courseId }),
        history: useStudentSessionMessages({ courseId, sessionId }),
      }),
      {
        initialProps: {
          courseId: String(primaryScope.courseId),
          sessionId: String(studentChatIds.primarySession),
        },
        wrapper: createWrapper(queryClient),
      },
    )

    expect(result.current.sessions.data?.pages[0]?.sessions[0]?.id).toBe(
      studentChatIds.primarySession,
    )
    expect(result.current.history.data?.pages[0]?.messages[0]?.content).toBe(
      'Primary Student history',
    )

    act(() => useAuthStore.getState().clearSession())
    await waitFor(() => expect(result.current.sessions.data).toBeUndefined())
    expect(result.current.history.data).toBeUndefined()

    act(() => authenticate(studentChatIds.otherStudent))
    expect(result.current.history.data).toBeUndefined()
    rerender({
      courseId: studentChatIds.primaryCourse,
      sessionId: studentChatIds.otherSession,
    })
    await waitFor(() =>
      expect(result.current.sessions.data?.pages[0]?.sessions[0]?.id).toBe(
        studentChatIds.otherSession,
      ),
    )
    expect(result.current.history.data?.pages[0]?.messages[0]?.content).toBe(
      'Other Student history',
    )

    rerender({
      courseId: studentChatIds.otherCourse,
      sessionId: studentChatIds.otherSession,
    })
    await waitFor(() =>
      expect(
        result.current.sessions.data?.pages[0]?.sessions[0]?.courseId,
      ).toBe(studentChatIds.otherCourse),
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
      () => useCreateStudentSession({ courseId: primaryScope.courseId }),
      { wrapper: createWrapper(queryClient) },
    )

    let mutation: Promise<ChatSession> | undefined
    act(() => {
      mutation = result.current.mutateAsync({ title: 'Python lists' })
    })
    await waitFor(() => expect(resolveSession).toBeTypeOf('function'))
    act(() => authenticate(studentChatIds.otherStudent))

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
        studentSessionKeys.messageList({
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
        studentSessionKeys.detail({
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
      studentSessionKeys.detail({
        ...primaryScope,
        sessionId: primaryChatSessionFixture.id,
      }),
      primaryChatSessionFixture,
    )
    renameStudentSessionMock.mockResolvedValue(renamedSession)
    authenticate()
    const { result } = renderHook(
      () => useRenameStudentSession({ courseId: primaryScope.courseId }),
      { wrapper: createWrapper(queryClient) },
    )

    await act(() =>
      result.current.mutateAsync({
        sessionId: studentChatIds.primarySession,
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
        studentSessionKeys.detail({
          ...primaryScope,
          sessionId: primaryChatSessionFixture.id,
        }),
      ),
    ).toEqual(renamedSession)
  })

  it('updates a session stored on a later cached page', async () => {
    const queryClient = createQueryClient()
    const primaryKey = studentSessionKeys.sessionList(primaryScope)
    const firstPageSession = {
      ...primaryChatSessionFixture,
      id: studentChatIds.otherSession,
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
      () => useRenameStudentSession({ courseId: primaryScope.courseId }),
      { wrapper: createWrapper(queryClient) },
    )

    await act(() =>
      result.current.mutateAsync({
        sessionId: studentChatIds.primarySession,
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
    const primaryDetailKey = studentSessionKeys.detail({
      ...primaryScope,
      sessionId: studentChatIds.primarySession,
    })
    queryClient.setQueryData(primaryDetailKey, primaryChatSessionFixture)
    const otherHistoryKey = seedHistory(
      queryClient,
      otherStudentScope,
      studentChatIds.otherSession,
    )
    deleteStudentSessionMock.mockResolvedValue(undefined)
    authenticate()
    const { result } = renderHook(
      () => useDeleteStudentSession({ courseId: primaryScope.courseId }),
      { wrapper: createWrapper(queryClient) },
    )

    await act(() => result.current.mutateAsync(studentChatIds.primarySession))

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
      () => useRenameStudentSession({ courseId: primaryScope.courseId }),
      { wrapper: createWrapper(queryClient) },
    )

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          sessionId: studentChatIds.primarySession,
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
      studentChatIds.otherSession,
      'Other Student history',
    )
    let resolveTurn:
      ((turn: typeof groundedChatTurnResponseFixture) => void) | undefined
    sendStudentChatMessageMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTurn = resolve
        }),
    )
    authenticate()
    const { result } = renderHook(
      () =>
        useSendStudentChatMessage({
          courseId: primaryScope.courseId,
          sessionId: studentChatIds.primarySession,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    let mutation: Promise<unknown> | undefined
    act(() => {
      mutation = result.current.mutateAsync({
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

    resolveTurn(groundedChatTurnResponseFixture)
    await act(async () => mutation)

    const persisted =
      queryClient.getQueryData<
        InfiniteData<ChatMessageHistoryResponse, number | undefined>
      >(historyKey)
    expect(
      persisted?.pages[0]?.messages.filter(
        ({ id }) => id === studentChatIds.studentMessage,
      ),
    ).toHaveLength(1)
    expect(
      persisted?.pages[0]?.messages.filter(
        ({ id }) => id === studentChatIds.assistantMessage,
      ),
    ).toHaveLength(1)
    expect(persisted?.pages[0]?.messages).toHaveLength(2)
  })

  it('rolls back an optimistic send after a transport failure', async () => {
    const queryClient = createQueryClient()
    const historyKey = seedHistory(queryClient, primaryScope)
    const previousHistory = queryClient.getQueryData(historyKey)
    sendStudentChatMessageMock.mockRejectedValue(
      new TypeError('Failed to fetch'),
    )
    authenticate()
    const { result } = renderHook(
      () =>
        useSendStudentChatMessage({
          courseId: primaryScope.courseId,
          sessionId: studentChatIds.primarySession,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    await act(async () => {
      await expect(
        result.current.mutateAsync({ content: 'Keep this draft' }),
      ).rejects.toThrow('Failed to fetch')
    })

    expect(queryClient.getQueryData(historyKey)).toEqual(previousHistory)
  })

  it('retries a failed persisted turn by replacing the same message ids', async () => {
    const queryClient = createQueryClient()
    const failedHistory: ChatMessageHistoryResponse = {
      messages: [
        { ...groundedChatTurnResponseFixture.studentMessage },
        {
          ...groundedChatTurnResponseFixture.assistantMessage,
          content: 'I could not complete that response.',
          status: 'FAILED',
          guidanceLabel: null,
          errorCode: 'GROUNDING_RESPONSE_FAILED',
          citations: [],
        },
      ],
      nextCursor: null,
    }
    const historyKey = studentSessionKeys.messageList({
      ...primaryScope,
      sessionId: studentChatIds.primarySession,
    })
    queryClient.setQueryData(historyKey, {
      pages: [failedHistory],
      pageParams: [undefined],
    })
    let resolveTurn:
      ((turn: typeof groundedChatTurnResponseFixture) => void) | undefined
    retryStudentChatMessageMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTurn = resolve
        }),
    )
    authenticate()
    const { result } = renderHook(
      () =>
        useRetryStudentChatMessage({
          courseId: primaryScope.courseId,
          sessionId: studentChatIds.primarySession,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    let mutation: Promise<unknown> | undefined
    act(() => {
      mutation = result.current.mutateAsync(studentChatIds.studentMessage)
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

    resolveTurn(groundedChatTurnResponseFixture)
    await act(async () => mutation)

    const retried =
      queryClient.getQueryData<
        InfiniteData<ChatMessageHistoryResponse, number | undefined>
      >(historyKey)?.pages[0]?.messages
    expect(retried).toHaveLength(2)
    expect(retried?.map(({ id }) => id)).toEqual([
      studentChatIds.studentMessage,
      studentChatIds.assistantMessage,
    ])
    expect(retried?.[1]?.status).toBe('COMPLETED')
    expect(retryStudentChatMessageMock).toHaveBeenCalledWith({
      courseId: primaryScope.courseId,
      sessionId: studentChatIds.primarySession,
      studentMessageId: studentChatIds.studentMessage,
    })
  })
})
