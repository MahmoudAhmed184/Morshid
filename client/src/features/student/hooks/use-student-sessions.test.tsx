import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  createStudentSession,
  deleteStudentSession,
  getStudentSessionMessages,
  listStudentSessions,
  renameStudentSession,
} from '@/features/student/data/student-sessions.api'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import type {
  ChatMessageHistoryResponse,
  ChatSession,
  ChatSessionListResponse,
} from '@/features/student/schemas/student-chat.schema'
import {
  chatMessageHistoryResponseFixture,
  otherChatSessionFixture,
  primaryChatSessionFixture,
  studentChatIds,
} from '@/features/student/testing/student-chat.fixtures'

import {
  useCreateStudentSession,
  useDeleteStudentSession,
  useRenameStudentSession,
  useStudentSessionMessages,
  useStudentSessions,
} from './use-student-sessions'

vi.mock('@/features/student/data/student-sessions.api')

const createStudentSessionMock = vi.mocked(createStudentSession)
const deleteStudentSessionMock = vi.mocked(deleteStudentSession)
const getStudentSessionMessagesMock = vi.mocked(getStudentSessionMessages)
const listStudentSessionsMock = vi.mocked(listStudentSessions)
const renameStudentSessionMock = vi.mocked(renameStudentSession)

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
  queryClient.setQueryData(key, sessionList(session))
  return key
}

function seedHistory(
  queryClient: QueryClient,
  scope: CourseScope,
  sessionId: string = studentChatIds.primarySession,
  firstMessageContent?: string,
) {
  const key = studentSessionKeys.messageList({ ...scope, sessionId })
  queryClient.setQueryData(key, messageHistory(firstMessageContent))
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
    const createSession = renderHook(
      () => useCreateStudentSession({ courseId: studentChatIds.primaryCourse }),
      { wrapper },
    )

    expect(sessions.result.current.fetchStatus).toBe('idle')
    expect(messages.result.current.fetchStatus).toBe('idle')
    await act(async () => {
      await expect(
        createSession.result.current.mutateAsync({ title: 'Blocked request' }),
      ).rejects.toThrow('Choose an assigned course first.')
    })
    expect(listStudentSessionsMock).not.toHaveBeenCalled()
    expect(getStudentSessionMessagesMock).not.toHaveBeenCalled()
    expect(createStudentSessionMock).not.toHaveBeenCalled()
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

    expect(result.current.sessions.data?.sessions[0]?.id).toBe(
      studentChatIds.primarySession,
    )
    expect(result.current.history.data?.messages[0]?.content).toBe(
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
      expect(result.current.sessions.data?.sessions[0]?.id).toBe(
        studentChatIds.otherSession,
      ),
    )
    expect(result.current.history.data?.messages[0]?.content).toBe(
      'Other Student history',
    )

    rerender({
      courseId: studentChatIds.otherCourse,
      sessionId: studentChatIds.otherSession,
    })
    await waitFor(() =>
      expect(result.current.sessions.data?.sessions[0]?.courseId).toBe(
        studentChatIds.otherCourse,
      ),
    )
    expect(result.current.history.data?.messages[0]?.content).toBe(
      'Other course history',
    )
  })

  it('invalidates only the mutation-start Student and course after create', async () => {
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

    expect(queryClient.getQueryState(primaryKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false)
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
      queryClient.getQueryData<ChatSessionListResponse>(primaryKey)?.sessions[0]
        ?.title,
    ).toBe('Renamed session')
    expect(
      queryClient.getQueryData<ChatSessionListResponse>(otherKey)?.sessions[0]
        ?.title,
    ).toBe(otherStudentSession.title)
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
      queryClient.getQueryData<ChatSessionListResponse>(primaryListKey)
        ?.sessions,
    ).toEqual([])
    expect(
      queryClient.getQueryData<ChatSessionListResponse>(otherListKey)?.sessions,
    ).toEqual(sessionList(otherStudentSession).sessions)
    expect(queryClient.getQueryData(primaryHistoryKey)).toBeUndefined()
    expect(queryClient.getQueryData(otherHistoryKey)).toEqual(messageHistory())
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

    expect(queryClient.getQueryData(primaryKey)).toEqual(sessionList())
  })
})
