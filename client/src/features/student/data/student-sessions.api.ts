import { apiFetch, apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import {
  chatMessageHistoryResponseSchema,
  chatSessionListResponseSchema,
  chatSessionResponseSchema,
  createChatSessionRequestSchema,
  deleteChatSessionResponseSchema,
  listChatMessagesInputSchema,
  listChatSessionsInputSchema,
  renameChatSessionRequestSchema,
} from '@/features/student/schemas/student-chat.schema'
import type {
  CreateChatSessionInput,
  ListChatMessagesInput,
  ListChatSessionsInput,
  RenameChatSessionInput,
} from '@/features/student/schemas/student-chat.schema'

export type {
  ChatMessage,
  ChatMessageHistoryResponse,
  ChatSession,
  ChatSessionListResponse,
} from '@/features/student/schemas/student-chat.schema'

interface ListStudentSessionsParams {
  courseId: string
  input?: ListChatSessionsInput
  options?: ApiFetchOptions
}

interface CreateStudentSessionParams {
  courseId: string
  input?: CreateChatSessionInput
  options?: ApiFetchOptions
}

interface RenameStudentSessionParams {
  courseId: string
  sessionId: string
  input: RenameChatSessionInput
  options?: ApiFetchOptions
}

interface DeleteStudentSessionParams {
  courseId: string
  sessionId: string
  options?: ApiFetchOptions
}

interface GetStudentSessionMessagesParams {
  courseId: string
  sessionId: string
  input?: ListChatMessagesInput
  options?: ApiFetchOptions
}

function sessionsPath(courseId: string) {
  return `/api/v1/courses/${courseId}/chat-sessions`
}

function sessionPath(courseId: string, sessionId: string) {
  return `${sessionsPath(courseId)}/${sessionId}`
}

function jsonRequestOptions(
  method: 'PATCH' | 'POST',
  body: unknown,
  options: ApiFetchOptions,
): ApiFetchOptions {
  return {
    ...options,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    method,
  }
}

function withSearchParams(
  path: string,
  params: Record<string, number | string | undefined>,
) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value))
    }
  }

  const query = searchParams.toString()
  return query ? `${path}?${query}` : path
}

export async function listStudentSessions({
  courseId,
  input = {},
  options = {},
}: ListStudentSessionsParams) {
  const query = listChatSessionsInputSchema.parse(input)
  const response = await apiJson<unknown>(
    withSearchParams(sessionsPath(courseId), query),
    { ...options, method: 'GET' },
  )

  return chatSessionListResponseSchema.parse(response)
}

export async function createStudentSession({
  courseId,
  input = {},
  options = {},
}: CreateStudentSessionParams) {
  const body = createChatSessionRequestSchema.parse(input)
  const response = await apiJson<unknown>(
    sessionsPath(courseId),
    jsonRequestOptions('POST', body, options),
  )

  return chatSessionResponseSchema.parse(response).session
}

export async function renameStudentSession({
  courseId,
  sessionId,
  input,
  options = {},
}: RenameStudentSessionParams) {
  const body = renameChatSessionRequestSchema.parse(input)
  const response = await apiJson<unknown>(
    sessionPath(courseId, sessionId),
    jsonRequestOptions('PATCH', body, options),
  )

  return chatSessionResponseSchema.parse(response).session
}

export async function deleteStudentSession({
  courseId,
  sessionId,
  options = {},
}: DeleteStudentSessionParams) {
  await apiFetch(sessionPath(courseId, sessionId), {
    ...options,
    method: 'DELETE',
  })

  return deleteChatSessionResponseSchema.parse(undefined)
}

export async function getStudentSessionMessages({
  courseId,
  sessionId,
  input = {},
  options = {},
}: GetStudentSessionMessagesParams) {
  const query = listChatMessagesInputSchema.parse(input)
  const response = await apiJson<unknown>(
    withSearchParams(`${sessionPath(courseId, sessionId)}/messages`, query),
    { ...options, method: 'GET' },
  )

  return chatMessageHistoryResponseSchema.parse(response)
}
