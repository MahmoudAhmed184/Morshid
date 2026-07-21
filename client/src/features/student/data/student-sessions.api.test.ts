import { describe, expect, it, vi } from 'vitest'

import type { ApiError } from '@/features/auth/api/authenticated-api-client'
import {
  chatMessageHistoryResponseFixture,
  chatSessionListResponseFixture,
  primaryChatSessionFixture,
  studentChatIds,
} from '@/features/student/testing/student-chat.fixtures'

import {
  createStudentSession,
  deleteStudentSession,
  getStudentSession,
  getStudentSessionMessages,
  listStudentSessions,
  renameStudentSession,
} from './student-sessions.api'

describe('Student session API', () => {
  it('lists course-scoped sessions with cursor pagination', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${studentChatIds.primaryCourse}/chat-sessions?limit=25&cursor=${studentChatIds.primarySession}`,
        )
        expect(init?.method).toBe('GET')

        return Response.json(chatSessionListResponseFixture)
      },
    )

    await expect(
      listStudentSessions({
        courseId: studentChatIds.primaryCourse,
        input: { limit: 25, cursor: studentChatIds.primarySession },
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(chatSessionListResponseFixture)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('creates a session without sending a client-selected owner', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${studentChatIds.primaryCourse}/chat-sessions`,
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
      createStudentSession({
        courseId: studentChatIds.primaryCourse,
        input: { title: 'Python lists' },
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(primaryChatSessionFixture)
  })

  it('rejects a client-selected owner before making a request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const unsafeInput: unknown = {
      title: 'Python lists',
      ownerId: studentChatIds.otherStudent,
    }

    await expect(
      createStudentSession({
        courseId: studentChatIds.primaryCourse,
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
          `http://localhost:4000/api/v1/courses/${studentChatIds.primaryCourse}/chat-sessions/${studentChatIds.primarySession}`,
        )
        expect(init?.method).toBe('PATCH')
        expect(JSON.parse(String(init?.body))).toEqual({
          title: 'Renamed session',
        })

        return Response.json({ session: renamedSession })
      },
    )

    await expect(
      renameStudentSession({
        courseId: studentChatIds.primaryCourse,
        sessionId: studentChatIds.primarySession,
        input: { title: 'Renamed session' },
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(renamedSession)
  })

  it('loads and validates one course-scoped session', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${studentChatIds.primaryCourse}/chat-sessions/${studentChatIds.primarySession}`,
        )
        expect(init?.method).toBe('GET')

        return Response.json({ session: primaryChatSessionFixture })
      },
    )

    await expect(
      getStudentSession({
        courseId: studentChatIds.primaryCourse,
        sessionId: studentChatIds.primarySession,
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(primaryChatSessionFixture)
  })

  it('soft-deletes the course-scoped session through DELETE', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${studentChatIds.primaryCourse}/chat-sessions/${studentChatIds.primarySession}`,
        )
        expect(init?.method).toBe('DELETE')

        return new Response(null, { status: 204 })
      },
    )

    await expect(
      deleteStudentSession({
        courseId: studentChatIds.primaryCourse,
        sessionId: studentChatIds.primarySession,
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toBeUndefined()
  })

  it('rejects a successful delete response that is not empty 204', async () => {
    const wrongStatusFetch = vi.fn(async () =>
      Response.json({ deleted: true }, { status: 200 }),
    )

    await expect(
      deleteStudentSession({
        courseId: studentChatIds.primaryCourse,
        sessionId: studentChatIds.primarySession,
        options: { fetchImpl: wrongStatusFetch },
      }),
    ).rejects.toThrow('Expected DELETE chat session to return 204 No Content')
  })

  it('loads and validates ordered history through the owning session', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/courses/${studentChatIds.primaryCourse}/chat-sessions/${studentChatIds.primarySession}/messages?limit=50&after=0`,
        )
        expect(init?.method).toBe('GET')

        return Response.json(chatMessageHistoryResponseFixture)
      },
    )

    await expect(
      getStudentSessionMessages({
        courseId: studentChatIds.primaryCourse,
        sessionId: studentChatIds.primarySession,
        input: { limit: 50, after: 0 },
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(chatMessageHistoryResponseFixture)
  })

  it('rejects malformed and cross-shaped responses', async () => {
    const malformedFetch = vi.fn(async () =>
      Response.json({ courses: [], nextCursor: null }),
    )

    await expect(
      listStudentSessions({
        courseId: studentChatIds.primaryCourse,
        options: { fetchImpl: malformedFetch },
      }),
    ).rejects.toThrow()
  })

  it('preserves the approved Student chat error contract', async () => {
    const deniedFetch = vi.fn(async () =>
      Response.json(
        {
          code: 'STUDENT_CHAT_ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
          message: 'Active student course membership is required',
        },
        { status: 403 },
      ),
    )

    await expect(
      listStudentSessions({
        courseId: studentChatIds.primaryCourse,
        options: { fetchImpl: deniedFetch },
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({
        status: 403,
        code: 'STUDENT_CHAT_ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      }),
    )
  })
})
