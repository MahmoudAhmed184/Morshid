import {
  apiFetch,
  apiJson,
} from '@/features/auth/session/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/authenticated-api-client'
import {
  chatMessageHistoryResponseSchema,
  chatTurnResponseSchema,
  listChatMessagesInputSchema,
  sendChatMessageRequestSchema,
} from '@/features/chat/messages/chat-message.schema'
import type {
  ChatTurnResponse,
  ListChatMessagesInput,
  SendChatMessageInput,
} from '@/features/chat/messages/chat-message.schema'
import {
  chatSessionListResponseSchema,
  chatSessionResponseSchema,
  createChatSessionRequestSchema,
  deleteChatSessionResponseSchema,
  listChatSessionsInputSchema,
  renameChatSessionRequestSchema,
} from '@/features/chat/sessions/chat-session.schema'
import type {
  CreateChatSessionInput,
  ListChatSessionsInput,
  RenameChatSessionInput,
} from '@/features/chat/sessions/chat-session.schema'

export type {
  ChatMessage,
  ChatMessageHistoryResponse,
  ChatTurnResponse,
} from '@/features/chat/messages/chat-message.schema'
export type {
  ChatSession,
  ChatSessionListResponse,
} from '@/features/chat/sessions/chat-session.schema'

interface ListChatSessionsParams {
  courseId: string
  input?: ListChatSessionsInput
  options?: ApiFetchOptions
}

interface CreateChatSessionParams {
  courseId: string
  input?: CreateChatSessionInput
  options?: ApiFetchOptions
}

interface RenameChatSessionParams {
  courseId: string
  sessionId: string
  input: RenameChatSessionInput
  options?: ApiFetchOptions
}

interface GetChatSessionParams {
  courseId: string
  sessionId: string
  options?: ApiFetchOptions
}

interface DeleteChatSessionParams {
  courseId: string
  sessionId: string
  options?: ApiFetchOptions
}

interface GetChatMessagesParams {
  courseId: string
  sessionId: string
  input?: ListChatMessagesInput
  options?: ApiFetchOptions
}

interface SendChatMessageParams {
  courseId: string
  sessionId: string
  input: SendChatMessageInput
  options?: ApiFetchOptions
}

interface RetryChatMessageParams {
  courseId: string
  sessionId: string
  studentMessageId: string
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

export async function listChatSessions({
  courseId,
  input = {},
  options = {},
}: ListChatSessionsParams) {
  const query = listChatSessionsInputSchema.parse(input)
  const response = await apiJson<unknown>(
    withSearchParams(sessionsPath(courseId), query),
    { ...options, method: 'GET' },
  )

  return chatSessionListResponseSchema.parse(response)
}

export async function createChatSession({
  courseId,
  input = {},
  options = {},
}: CreateChatSessionParams) {
  const body = createChatSessionRequestSchema.parse(input)
  const response = await apiJson<unknown>(
    sessionsPath(courseId),
    jsonRequestOptions('POST', body, options),
  )

  return chatSessionResponseSchema.parse(response).session
}

export async function renameChatSession({
  courseId,
  sessionId,
  input,
  options = {},
}: RenameChatSessionParams) {
  const body = renameChatSessionRequestSchema.parse(input)
  const response = await apiJson<unknown>(
    sessionPath(courseId, sessionId),
    jsonRequestOptions('PATCH', body, options),
  )

  return chatSessionResponseSchema.parse(response).session
}

export async function getChatSession({
  courseId,
  sessionId,
  options = {},
}: GetChatSessionParams) {
  const response = await apiJson<unknown>(sessionPath(courseId, sessionId), {
    ...options,
    method: 'GET',
  })

  return chatSessionResponseSchema.parse(response).session
}

export async function deleteChatSession({
  courseId,
  sessionId,
  options = {},
}: DeleteChatSessionParams) {
  const response = await apiFetch(sessionPath(courseId, sessionId), {
    ...options,
    method: 'DELETE',
  })

  if (response.status !== 204 || (await response.text()).length > 0) {
    throw new Error(
      'Expected DELETE chat session to return 204 No Content with an empty body',
    )
  }

  return deleteChatSessionResponseSchema.parse(undefined)
}

export async function getChatMessages({
  courseId,
  sessionId,
  input = {},
  options = {},
}: GetChatMessagesParams) {
  const query = listChatMessagesInputSchema.parse(input)
  const response = await apiJson<unknown>(
    withSearchParams(`${sessionPath(courseId, sessionId)}/messages`, query),
    { ...options, method: 'GET' },
  )

  return chatMessageHistoryResponseSchema.parse(response)
}

export async function sendChatMessage({
  courseId,
  sessionId,
  input,
  options = {},
}: SendChatMessageParams): Promise<ChatTurnResponse> {
  const body = sendChatMessageRequestSchema.parse(input)
  const response = await apiJson<unknown>(
    `${sessionPath(courseId, sessionId)}/messages`,
    jsonRequestOptions('POST', body, options),
  )

  return chatTurnResponseSchema.parse(response)
}

export async function retryChatMessage({
  courseId,
  sessionId,
  studentMessageId,
  options = {},
}: RetryChatMessageParams): Promise<ChatTurnResponse> {
  const response = await apiJson<unknown>(
    `${sessionPath(courseId, sessionId)}/messages/${studentMessageId}/retry`,
    { ...options, method: 'POST' },
  )

  return chatTurnResponseSchema.parse(response)
}
