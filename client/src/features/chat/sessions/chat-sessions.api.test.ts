import { describe, expect, it, vi } from 'vitest'

import type { ApiError } from '@/lib/http/http'
import {
  chatMessageHistoryResponseFixture,
  chatSessionListResponseFixture,
  chatTurnResponseFixture,
  primaryChatSessionFixture,
  chatIds,
} from '@/features/chat/testing/chat.fixtures'

import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  getChatMessages,
  listChatSessions,
  renameChatSession,
  retryChatMessage,
  sendChatMessage,
} from './chat-sessions.api'

describe('Student session API', () => {
  it('lists course-scoped sessions with cursor pagination', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${chatIds.primaryCourse}/chat-sessions?limit=25&cursor=${chatIds.primarySession}`,
        )
        expect(init?.method).toBe('GET')

        return Response.json(chatSessionListResponseFixture)
      },
    )

    await expect(
      listChatSessions({
        courseId: chatIds.primaryCourse,
        input: { limit: 25, cursor: chatIds.primarySession },
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(chatSessionListResponseFixture)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('creates a session without sending a client-selected owner', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${chatIds.primaryCourse}/chat-sessions`,
        )
        expect(init?.method).toBe('POST')
        expect(new Headers(init?.headers).get('Content-Type')).toBe(
          'application/json',
        )
        expect(JSON.parse(String(init?.body))).toEqual({
          title: 'Python lists',
        })

        return Response.json(
          { session: primaryChatSessionFixture },
          { status: 201 },
        )
      },
    )

    await expect(
      createChatSession({
        courseId: chatIds.primaryCourse,
        input: { title: 'Python lists' },
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(primaryChatSessionFixture)
  })

  it('rejects a client-selected owner before making a request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const unsafeInput: unknown = {
      title: 'Python lists',
      ownerId: chatIds.otherStudent,
    }

    await expect(
      createChatSession({
        courseId: chatIds.primaryCourse,
        input: unsafeInput as { title: string },
        options: { fetchImpl: fetchMock },
      }),
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renames only the course-scoped session with PATCH', async () => {
    const renamedSession = {
      ...primaryChatSessionFixture,
      title: 'Renamed session',
    }
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${chatIds.primaryCourse}/chat-sessions/${chatIds.primarySession}`,
        )
        expect(init?.method).toBe('PATCH')
        expect(JSON.parse(String(init?.body))).toEqual({
          title: 'Renamed session',
        })

        return Response.json({ session: renamedSession })
      },
    )

    await expect(
      renameChatSession({
        courseId: chatIds.primaryCourse,
        sessionId: chatIds.primarySession,
        input: { title: 'Renamed session' },
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(renamedSession)
  })

  it('loads and validates one course-scoped session', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${chatIds.primaryCourse}/chat-sessions/${chatIds.primarySession}`,
        )
        expect(init?.method).toBe('GET')

        return Response.json({ session: primaryChatSessionFixture })
      },
    )

    await expect(
      getChatSession({
        courseId: chatIds.primaryCourse,
        sessionId: chatIds.primarySession,
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(primaryChatSessionFixture)
  })

  it('soft-deletes the course-scoped session through DELETE', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${chatIds.primaryCourse}/chat-sessions/${chatIds.primarySession}`,
        )
        expect(init?.method).toBe('DELETE')

        return new Response(null, { status: 204 })
      },
    )

    await expect(
      deleteChatSession({
        courseId: chatIds.primaryCourse,
        sessionId: chatIds.primarySession,
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toBeUndefined()
  })

  it('rejects a successful delete response that is not empty 204', async () => {
    const wrongStatusFetch = vi.fn(async () =>
      Response.json({ deleted: true }, { status: 200 }),
    )

    await expect(
      deleteChatSession({
        courseId: chatIds.primaryCourse,
        sessionId: chatIds.primarySession,
        options: { fetchImpl: wrongStatusFetch },
      }),
    ).rejects.toThrow('Expected DELETE chat session to return 204 No Content')
  })

  it('loads and validates ordered history through the owning session', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${chatIds.primaryCourse}/chat-sessions/${chatIds.primarySession}/messages?limit=50&after=0`,
        )
        expect(init?.method).toBe('GET')

        return Response.json(chatMessageHistoryResponseFixture)
      },
    )

    await expect(
      getChatMessages({
        courseId: chatIds.primaryCourse,
        sessionId: chatIds.primarySession,
        input: { limit: 50, after: 0 },
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(chatMessageHistoryResponseFixture)
  })

  it('requests the newest message page through the explicit latest contract', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        `http://localhost:4000/api/v1/courses/${chatIds.primaryCourse}/chat-sessions/${chatIds.primarySession}/messages?limit=50&page=latest`,
      )

      return Response.json(chatMessageHistoryResponseFixture)
    })

    await expect(
      getChatMessages({
        courseId: chatIds.primaryCourse,
        sessionId: chatIds.primarySession,
        input: { limit: 50, page: 'latest' },
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(chatMessageHistoryResponseFixture)
  })

  it('sends only validated message content to the tutoring endpoint', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${chatIds.primaryCourse}/chat-sessions/${chatIds.primarySession}/messages`,
        )
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toEqual({
          clientMessageId: chatIds.studentMessage,
          content: 'Explain Python lists',
        })

        return Response.json(chatTurnResponseFixture, { status: 201 })
      },
    )

    await expect(
      sendChatMessage({
        courseId: chatIds.primaryCourse,
        sessionId: chatIds.primarySession,
        input: {
          clientMessageId: chatIds.studentMessage,
          content: '  Explain Python lists  ',
        },
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(chatTurnResponseFixture)
  })

  it('rejects orchestration overrides before sending a grounded message', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const unsafeInput: unknown = {
      content: 'Question',
      provider: 'client-provider',
      citations: [],
    }

    await expect(
      sendChatMessage({
        courseId: chatIds.primaryCourse,
        sessionId: chatIds.primarySession,
        input: unsafeInput as {
          clientMessageId: string
          content: string
        },
        options: { fetchImpl: fetchMock },
      }),
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retries a failed response without sending a request body', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${chatIds.primaryCourse}/chat-sessions/${chatIds.primarySession}/tutoring-attempts/${chatIds.primaryTurn}/retry`,
        )
        expect(init?.method).toBe('POST')
        expect(init?.body).toBeUndefined()
        expect(new Headers(init?.headers).get('Content-Type')).toBeNull()

        return Response.json(chatTurnResponseFixture)
      },
    )

    await expect(
      retryChatMessage({
        courseId: chatIds.primaryCourse,
        sessionId: chatIds.primarySession,
        attemptId: chatIds.primaryTurn,
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(chatTurnResponseFixture)
  })

  it('rejects malformed and cross-shaped responses', async () => {
    const malformedFetch = vi.fn(async () =>
      Response.json({ courses: [], nextCursor: null }),
    )

    await expect(
      listChatSessions({
        courseId: chatIds.primaryCourse,
        options: { fetchImpl: malformedFetch },
      }),
    ).rejects.toThrow()
  })

  it('preserves the approved Student chat error contract', async () => {
    const deniedFetch = vi.fn(async () =>
      Response.json(
        {
          code: 'CONVERSATION_ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
          message: 'Active student course membership is required',
        },
        { status: 403 },
      ),
    )

    await expect(
      listChatSessions({
        courseId: chatIds.primaryCourse,
        options: { fetchImpl: deniedFetch },
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({
        status: 403,
        code: 'CONVERSATION_ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      }),
    )
  })
})
