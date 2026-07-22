import { apiFetch, apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import {
  chatMessageHistoryResponseSchema,
  groundedChatTurnResponseSchema,
  chatSessionListResponseSchema,
  chatSessionResponseSchema,
  createChatSessionRequestSchema,
  deleteChatSessionResponseSchema,
  listChatMessagesInputSchema,
  listChatSessionsInputSchema,
  renameChatSessionRequestSchema,
  sendStudentChatMessageRequestSchema,
} from '@/features/student/schemas/student-chat.schema'
import type {
  CreateChatSessionInput,
  GroundedChatTurnResponse,
  ListChatMessagesInput,
  ListChatSessionsInput,
  RenameChatSessionInput,
  SendStudentChatMessageInput,
} from '@/features/student/schemas/student-chat.schema'

export type {
  ChatMessage,
  ChatMessageHistoryResponse,
  ChatSession,
  ChatSessionListResponse,
  GroundedChatTurnResponse,
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

interface GetStudentSessionParams {
  courseId: string
  sessionId: string
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

interface SendStudentChatMessageParams {
  courseId: string
  sessionId: string
  input: SendStudentChatMessageInput
  options?: ApiFetchOptions
}

interface RetryStudentChatMessageParams {
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

export async function getStudentSession({
  courseId,
  sessionId,
  options = {},
}: GetStudentSessionParams) {
  const response = await apiJson<unknown>(sessionPath(courseId, sessionId), {
    ...options,
    method: 'GET',
  })

  return chatSessionResponseSchema.parse(response).session
}

export async function deleteStudentSession({
  courseId,
  sessionId,
  options = {},
}: DeleteStudentSessionParams) {
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

export async function sendStudentChatMessage({
  courseId,
  sessionId,
  input,
  options = {},
}: SendStudentChatMessageParams): Promise<GroundedChatTurnResponse> {
  const body = sendStudentChatMessageRequestSchema.parse(input)
  const response = await apiJson<unknown>(
    `${sessionPath(courseId, sessionId)}/messages`,
    jsonRequestOptions('POST', body, options),
  )

  return groundedChatTurnResponseSchema.parse(response)
}

export async function retryStudentChatMessage({
  courseId,
  sessionId,
  studentMessageId,
  options = {},
}: RetryStudentChatMessageParams): Promise<GroundedChatTurnResponse> {
  const response = await apiJson<unknown>(
    `${sessionPath(courseId, sessionId)}/messages/${studentMessageId}/retry`,
    { ...options, method: 'POST' },
  )

  return groundedChatTurnResponseSchema.parse(response)
}
